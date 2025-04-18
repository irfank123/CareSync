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
  getAppointmentTimeslot
} from '../controllers/appointmentController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';
import { auditMiddleware, cacheMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);

// Get upcoming appointments for the current user
router.get(
  '/upcoming', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  getUpcomingAppointmentsWithDI
);

// Get my appointments (for patients to view their own appointments)
router.get(
  '/me',
  authMiddleware.restrictTo('patient', 'doctor'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('my-appointments'),
  async (req, res) => {
    try {
      console.log('GET my appointments request:', {
        userId: req.user._id,
        role: req.userRole
      });
      
      const { Appointment, Patient, Doctor, User } = await import('../models/index.mjs');
      let appointments = [];
      
      // Simplified approach: direct database queries based on role
      if (req.userRole === 'patient') {
        // Get patient record for this user
        const patient = await Patient.findOne({ userId: req.user._id });
        
        if (!patient) {
          return res.status(404).json({
            success: false,
            message: 'Patient profile not found for this user'
          });
        }
        
        console.log(`Found patient with ID ${patient._id} for user ${req.user._id}`);
        
        // Get all appointments in database (we can filter later)
        appointments = await Appointment.find({}).lean();
        console.log(`Total appointments in database: ${appointments.length}`);
        
        // Convert to string for comparison
        const patientIdStr = patient._id.toString();
        
        // Filter the appointments client-side to find all that have this patient
        appointments = appointments.filter(appt => {
          const hasPatientField = appt.patient && (
            (typeof appt.patient === 'string' && appt.patient === patientIdStr) ||
            (appt.patient._id && appt.patient._id.toString() === patientIdStr)
          );
          
          const hasPatientIdField = appt.patientId && (
            (typeof appt.patientId === 'string' && appt.patientId === patientIdStr) ||
            (appt.patientId._id && appt.patientId._id.toString() === patientIdStr)
          );
          
          return hasPatientField || hasPatientIdField;
        });
        
        console.log(`Found ${appointments.length} appointments for patient ${patientIdStr}`);
        
      } else if (req.userRole === 'doctor') {
        // Get doctor record for this user
        const doctor = await Doctor.findOne({ userId: req.user._id });
        
        if (!doctor) {
          return res.status(404).json({
            success: false,
            message: 'Doctor profile not found for this user'
          });
        }
        
        console.log(`Found doctor with ID ${doctor._id} for user ${req.user._id}`);
        
        // Get all appointments in database (we can filter later)
        appointments = await Appointment.find({}).lean();
        
        // Convert to string for comparison
        const doctorIdStr = doctor._id.toString();
        
        // Filter the appointments client-side to find all that have this doctor
        appointments = appointments.filter(appt => {
          const hasDoctorField = appt.doctor && (
            (typeof appt.doctor === 'string' && appt.doctor === doctorIdStr) ||
            (appt.doctor._id && appt.doctor._id.toString() === doctorIdStr)
          );
          
          const hasDoctorIdField = appt.doctorId && (
            (typeof appt.doctorId === 'string' && appt.doctorId === doctorIdStr) ||
            (appt.doctorId._id && appt.doctorId._id.toString() === doctorIdStr)
          );
          
          return hasDoctorField || hasDoctorIdField;
        });
        
        console.log(`Found ${appointments.length} appointments for doctor ${doctorIdStr}`);
      }
      
      // Now process each appointment to add doctor name if needed
      if (appointments.length > 0) {
        console.log('Found appointments, retrieving doctor information');
        
        // Get all doctor IDs
        const doctorIds = appointments.map(appointment => {
          if (appointment.doctor) {
            return typeof appointment.doctor === 'string' 
              ? appointment.doctor 
              : appointment.doctor._id?.toString();
          } else if (appointment.doctorId) {
            return typeof appointment.doctorId === 'string'
              ? appointment.doctorId
              : appointment.doctorId._id?.toString();
          }
          return null;
        }).filter(id => id !== null);
        
        console.log(`Found ${doctorIds.length} unique doctor IDs to look up`);
        
        // Fetch all doctors in one query
        const doctors = await Doctor.find({
          _id: { $in: doctorIds }
        }).lean();
        
        console.log(`Retrieved ${doctors.length} doctors from database`);
        
        // Get all user IDs from doctors
        const userIds = doctors.map(doc => doc.userId?.toString()).filter(id => id);
        
        // Fetch all users in one query
        const users = await User.find({
          _id: { $in: userIds }
        }).lean();
        
        console.log(`Retrieved ${users.length} doctor users from database`);
        
        // Create lookup maps for fast access
        const doctorMap = {};
        doctors.forEach(doc => {
          doctorMap[doc._id.toString()] = doc;
        });
        
        const userMap = {};
        users.forEach(user => {
          userMap[user._id.toString()] = user;
        });
        
        // Now add doctor info to each appointment
        for (const appointment of appointments) {
          let doctorId = null;
          
          // Find the doctor ID
          if (appointment.doctor) {
            doctorId = typeof appointment.doctor === 'string' 
              ? appointment.doctor 
              : appointment.doctor._id?.toString();
          } else if (appointment.doctorId) {
            doctorId = typeof appointment.doctorId === 'string'
              ? appointment.doctorId
              : appointment.doctorId._id?.toString();
          }
          
          if (doctorId) {
            const doctor = doctorMap[doctorId];
            if (doctor && doctor.userId) {
              const user = userMap[doctor.userId.toString()];
              if (user) {
                appointment.doctorName = `Dr. ${user.firstName} ${user.lastName}`;
                appointment.doctorSpecialty = doctor.specialization || 'General Practitioner';
                console.log(`Added doctor name: ${appointment.doctorName} for appointment ${appointment._id}`);
              }
            }
          }
        }
      }
      
      // Return the appointments
      res.status(200).json({
        success: true,
        count: appointments.length,
        data: appointments
      });
    } catch (err) {
      console.error('Error fetching appointments:', err);
      res.status(500).json({
        success: false,
        message: 'Error fetching appointments',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
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

export default router;