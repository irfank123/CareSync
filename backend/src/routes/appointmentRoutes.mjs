// src/routes/appointmentRoutes.mjs

import express from 'express';
import {
  getAppointmentsWithDI,
  getAppointmentWithDI,
  createAppointmentWithDI,
  updateAppointmentWithDI,
  deleteAppointmentWithDI,
  getPatientAppointmentsWithDI,
  getDoctorAppointmentsWithDI,
  getUpcomingAppointmentsWithDI,
  createAppointmentValidation,
  updateAppointmentValidation,
  getAppointmentTimeslot,
  getMyAppointmentsWithDI,
} from '../controllers/appointmentController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';
import { auditMiddleware, cacheMiddleware } from '../middleware/index.mjs';
import { Appointment, User, Doctor } from '../models/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';
import googleService from '../services/googleService.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);

// Get upcoming appointments for the current user
router.get(
  '/upcoming', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  getUpcomingAppointmentsWithDI
);

// Get my appointments (for patients/doctors to view their own appointments)
router.get(
  '/me',
  authMiddleware.restrictTo('patient', 'doctor'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('my-appointments'),
  getMyAppointmentsWithDI
);

// Patient-specific routes
router.get(
  '/patient/:patientId',
  auditMiddleware.logAccess('patient-appointments'),
  getPatientAppointmentsWithDI
);

// Doctor-specific routes
router.get(
  '/doctor/:doctorId',
  auditMiddleware.logAccess('doctor-appointments'),
  getDoctorAppointmentsWithDI
);

// General appointment routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('appointments'),
    getAppointmentsWithDI
  )
  .post(
    createAppointmentValidation,
    auditMiddleware.logCreation('appointment'),
    createAppointmentWithDI
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(60), // Cache for 1 minute
    auditMiddleware.logAccess('appointment'),
    getAppointmentWithDI
  )
  .put(
    updateAppointmentValidation,
    auditMiddleware.logUpdate('appointment'),
    cacheMiddleware.clearCacheOnWrite('appointments'),
    updateAppointmentWithDI
  )
  .delete(
    authMiddleware.restrictTo('admin'),
    auditMiddleware.logDeletion('appointment'),
    cacheMiddleware.clearCacheOnWrite('appointments'),
    deleteAppointmentWithDI
  );

// Add the route for getting a timeslot
router.get('/timeslot/:id', getAppointmentTimeslot);

// Route to generate Google Meet link for an appointment
router.post(
  '/:appointmentId/generate-meet-link',
  authMiddleware.authenticate, // Use authenticate which attaches user and potentially clinic
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), // Roles allowed to create links
  async (req, res, next) => {
    const { appointmentId } = req.params;
    
    // Ensure user is attached and has clinicId
    if (!req.user || !req.user.clinicId) {
        return next(new AppError('User not authenticated or not associated with a clinic', 401));
    }
    const clinicId = req.user.clinicId.toString();
    const userId = req.user._id.toString(); // For logging

    try {
      console.log(`[Route] Request to generate Meet link for appointment: ${appointmentId} by user: ${userId} in clinic: ${clinicId}`);
      
      // 1. Fetch Appointment Details
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientId', 'email firstName lastName') // Populate necessary fields for event details
        .populate('doctorId', 'email firstName lastName');

      if (!appointment) {
        return next(new AppError('Appointment not found', 404));
      }
      
      // --- Convert to plain object for reliable access ---
      const appointmentObj = appointment.toObject();
      // --- END Convert ---
      
      // --- DETAILED LOGGING (using appointmentObj) --- 
      console.log('[Route] Fetched Appointment Object BEFORE clinicId check (plain obj):\n', JSON.stringify(appointmentObj, null, 2));
      console.log(`[Route] typeof appointmentObj.clinicId: ${typeof appointmentObj.clinicId}`);
      console.log(`[Route] Value of appointmentObj.clinicId:`, appointmentObj.clinicId);
      console.log(`[Route] Truthiness check result (!appointmentObj.clinicId): ${!appointmentObj.clinicId}`);
      // --- END DETAILED LOGGING ---
      
      // Optional: Authorization check: Ensure appointment belongs to the user's clinic 
      // Use the plain object for checks
      if (!appointmentObj.clinicId) { 
        console.error('[Route] CRITICAL: clinicId field is missing or falsy in the plain object!', { 
            appointmentId: appointmentObj._id, // Use plain object ID
            clinicIdValue: appointmentObj.clinicId, 
            clinicIdType: typeof appointmentObj.clinicId
         });
        return next(new AppError('Appointment data (object) is missing clinic association or clinicId is falsy', 500));
      }
      // Now perform the comparison using the plain object
      // Ensure both sides are strings for reliable comparison
      if (appointmentObj.clinicId.toString() !== clinicId.toString()) { 
        console.warn(`[Route] Authorization Failed: Appointment Clinic (${appointmentObj.clinicId}) !== User Clinic (${clinicId})`);
        return next(new AppError('Appointment does not belong to this clinic', 403));
      }

      // Check if a link already exists using the plain object
      if (appointmentObj.googleMeetLink) {
        console.log(`[Route] Meet link already exists for appointment ${appointmentId}`);
        return res.status(200).json({ 
            success: true, 
            message: 'Meet link already exists for this appointment', 
            data: { 
                meetLink: appointmentObj.googleMeetLink,
                eventId: appointmentObj.googleEventId
            }
        });
      }

      // --- Prepare event details using the plain object --- 
      const attendees = [];
      // Make sure populated fields are handled correctly in the plain object
      // Mongoose .toObject() typically keeps populated fields as objects
      if (appointmentObj.patientId?.email) attendees.push({ email: appointmentObj.patientId.email });
      if (appointmentObj.doctorId?.email) attendees.push({ email: appointmentObj.doctorId.email });
      
      // --- Combine Date and Time for Google Calendar --- 
      let startDateTimeISO, endDateTimeISO;
      try {
          // Get the date part (should be like YYYY-MM-DD or a Date object)
          const datePart = new Date(appointmentObj.date).toISOString().split('T')[0]; 
          
          // Combine date with time strings
          const fullStartString = `${datePart}T${appointmentObj.startTime}:00`; // Add seconds
          const fullEndString = `${datePart}T${appointmentObj.endTime}:00`; // Add seconds
          
          console.log('[Route] Combined date/time strings:', { fullStartString, fullEndString });
          
          // Create Date objects from combined strings
          const startDate = new Date(fullStartString);
          const endDate = new Date(fullEndString);
          
          // Check if dates are valid after combining
          if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
              throw new Error('Resulting start or end date is invalid after combining date and time.');
          }

          // Now convert to ISOString
          startDateTimeISO = startDate.toISOString();
          endDateTimeISO = endDate.toISOString();

      } catch(dateError) {
           console.error('[Route] Error processing appointment date/time:', { 
               date: appointmentObj.date, 
               start: appointmentObj.startTime, 
               end: appointmentObj.endTime, 
               error: dateError.message 
            });
           return next(new AppError('Invalid date/time format in appointment data during processing', 500));
      }
      // --- End Date/Time Combining --- 

      const eventDetails = {
          summary: `CareSync Appointment: ${appointmentObj.patientId?.firstName || 'Patient'} with Dr. ${appointmentObj.doctorId?.lastName || 'Doctor'}`,
          description: `Virtual consultation for appointment ID: ${appointmentId}.
Reason: ${appointmentObj.reasonForVisit || 'N/A'}`,
          startDateTime: startDateTimeISO,
          endDateTime: endDateTimeISO,
          attendees: attendees,
      };

      // --- Call googleService (pass clinicId) --- 
      console.log(`[Route] Calling googleService.createCalendarEventWithMeet for clinic ${clinicId}`);
      const googleEvent = await googleService.createCalendarEventWithMeet(clinicId, eventDetails);

      // --- Update the ORIGINAL Mongoose document --- 
      appointment.googleMeetLink = googleEvent.hangoutLink;
      appointment.googleEventId = googleEvent.id;
      appointment.videoConferenceLink = googleEvent.hangoutLink;
      await appointment.save(); // Save the original Mongoose doc
      
      console.log(`[Route] Meet link ${googleEvent.hangoutLink} added to appointment ${appointmentId}`);

      // --- Respond to Frontend --- 
      res.status(200).json({
        success: true,
        message: 'Google Meet link generated successfully',
        data: {
          meetLink: googleEvent.hangoutLink,
          eventId: googleEvent.id
        }
      });

    } catch (error) {
      console.error(`[Route] Error generating Meet link for appointment ${appointmentId}:`, error);
      // Pass the error to the global error handler
      // It will handle AppErrors correctly and log others
      next(error);
    }
  }
);

export default router;