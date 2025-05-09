// src/services/appointmentService.mjs

import emailService from './emailService.mjs';
import mongoose from 'mongoose';
import config from '../config/config.mjs';
import { AppError } from '../utils/errorHandler.mjs';
import { google } from 'googleapis';
import googleCalendarService from './googleCalendarService.mjs';

// --- Import ALL models from the central index --- 
import {
  Clinic,
  Appointment,
  TimeSlot,
  User,
  Patient,
  Doctor,
  Assessment,
  AuditLog,
  Notification
} from '../models/index.mjs';
// --- END Model Imports ---

/**
 * Appointment Management Service
 */
class AppointmentService {
  constructor(models, googleCalendarService) {
    if (!models || !models.Appointment || !models.TimeSlot || !models.User || !models.Patient || !models.Doctor || !models.AuditLog || !models.Notification || !models.Clinic || !models.Assessment) {
      throw new Error('AppointmentService requires all models (Appointment, TimeSlot, User, Patient, Doctor, AuditLog, Notification, Clinic, Assessment) to be provided.');
    }
    if (!googleCalendarService) {
      throw new Error('AppointmentService requires googleCalendarService to be provided.');
    }
    this.Appointment = models.Appointment;
    this.TimeSlot = models.TimeSlot;
    this.User = models.User;
    this.Patient = models.Patient;
    this.Doctor = models.Doctor;
    this.Clinic = models.Clinic;
    this.AuditLog = models.AuditLog;
    this.Notification = models.Notification;
    this.Assessment = models.Assessment;
    this.googleCalendarService = googleCalendarService;
  }

  /**
   * Get all appointments with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Appointments and pagination info
   */
  async getAllAppointments(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'date',
        order = 'desc',
        status,
        type,
        doctorId,
        patientId,
        startDate,
        endDate,
        clinicId
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build the aggregation pipeline
      const pipeline = [];
      
      // Stage 1: Match conditions
      const matchConditions = {};
      
      // Filter by status if provided
      if (status) {
        matchConditions.status = status;
      }
      
      // Filter by type if provided
      if (type) {
        matchConditions.type = type;
      }
      
      // Filter by doctor if provided
      if (doctorId) {
        try {
          if (mongoose.Types.ObjectId.isValid(doctorId)) {
            matchConditions.doctorId = new mongoose.Types.ObjectId(doctorId);
            console.log('Using doctorId in query:', doctorId);
          } else {
            console.error('Invalid doctorId format in service:', doctorId);
            throw new Error('Invalid doctor ID format');
          }
        } catch (err) {
          console.error('Error converting doctorId to ObjectId:', err);
          throw new Error('Invalid doctor ID format: ' + err.message);
        }
      }
      
      // Filter by patient if provided
      if (patientId) {
        // Ensure patientId is valid before creating ObjectId
        if (mongoose.Types.ObjectId.isValid(patientId)) {
          matchConditions.patientId = new mongoose.Types.ObjectId(patientId);
        } else {
          console.error('Invalid patientId format in service:', patientId);
          throw new Error('Invalid patient ID format');
        }
      }
      
      // Filter by date range
      if (startDate || endDate) {
        matchConditions.date = {};
        
        if (startDate) {
          matchConditions.date.$gte = new Date(startDate);
        }
        
        if (endDate) {
          matchConditions.date.$lte = new Date(endDate);
        }
      }
      
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }
      
      // Stage 2: Join with Patient model
      pipeline.push({
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      });
      
      // Stage 3: Join with Doctor model
      pipeline.push({
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      });
      
      // Stage 4: Unwind the arrays (from lookup)
      pipeline.push({
        $unwind: {
          path: '$patient',
          preserveNullAndEmptyArrays: true
        }
      });
      
      pipeline.push({
        $unwind: {
          path: '$doctor',
          preserveNullAndEmptyArrays: true
        }
      });
      
      // Stage 5: Join with User model for patient
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'patient.userId',
          foreignField: '_id',
          as: 'patientUser'
        }
      });
      
      // Stage 6: Join with User model for doctor
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'doctor.userId',
          foreignField: '_id',
          as: 'doctorUser'
        }
      });
      
      // Stage 7: Unwind the arrays (from lookup)
      pipeline.push({
        $unwind: {
          path: '$patientUser',
          preserveNullAndEmptyArrays: true
        }
      });
      
      pipeline.push({
        $unwind: {
          path: '$doctorUser',
          preserveNullAndEmptyArrays: true
        }
      });
      
      // Filter by clinic if provided
      if (clinicId) {
        pipeline.push({
          $match: {
            '$or': [
              { 'patientUser.clinicId': mongoose.Types.ObjectId(clinicId) },
              { 'doctorUser.clinicId': mongoose.Types.ObjectId(clinicId) }
            ]
          }
        });
      }
      
      // Add search functionality
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { 'patientUser.firstName': { $regex: search, $options: 'i' } },
              { 'patientUser.lastName': { $regex: search, $options: 'i' } },
              { 'doctorUser.firstName': { $regex: search, $options: 'i' } },
              { 'doctorUser.lastName': { $regex: search, $options: 'i' } },
              { reasonForVisit: { $regex: search, $options: 'i' } }
            ]
          }
        });
      }
      
      // Stage 8: Sort the results
      const sortDirection = order === 'desc' ? -1 : 1;
      
      const sortStage = {};
      sortStage[sort] = sortDirection;
      pipeline.push({ $sort: sortStage });
      
      // Stage 9: Count total documents (for pagination)
      const countPipeline = [...pipeline];
      countPipeline.push({ $count: 'total' });
      
      // Stage 10: Skip and limit for pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      // Stage 11: Project the fields we want to return
      // Simplify projection: Keep all fields from previous stages, add virtual 'id'
      pipeline.push({
        $addFields: {
          id: "$_id" 
        }
      });
      
      // Execute the aggregation pipeline
      const [appointments, totalResult] = await Promise.all([
        Appointment.aggregate(pipeline).exec(),
        Appointment.aggregate(countPipeline).exec()
      ]);
      
      // Log raw aggregation results for the first appointment (if any)
      if (appointments && appointments.length > 0) {
          console.log('--- Raw Aggregation Result (getAllAppointments) ---');
          console.log(JSON.stringify(appointments[0], null, 2));
          console.log('--- End Raw Aggregation Result ---');
      }
      
      // Manually format each appointment after aggregation
      const formattedAppointments = appointments.map(appointment => {
        return this.formatAppointmentForResponse(appointment);
      });
      
      // Log formatted results for the first appointment (if any)
      if (formattedAppointments && formattedAppointments.length > 0) {
          console.log('--- Formatted Result (getAllAppointments) ---');
          console.log(JSON.stringify(formattedAppointments[0], null, 2));
          console.log('--- End Formatted Result ---');
      }
      
      const total = totalResult[0]?.total || 0;
      const totalPages = Math.ceil(total / limit);
      
      return {
        appointments: formattedAppointments,
        total,
        totalPages,
        currentPage: page
      };
    } catch (error) {
      console.error('Error in getAllAppointments service:', error);
      throw new Error('Failed to retrieve appointments: ' + error.message);
    }
  }
  
  /**
   * Helper function within the service to format appointment object
   * (Similar to the one in the controller, ensuring consistency)
   */
  formatAppointmentForResponse(appointment) {
    if (!appointment) return null;

    try {
      // Manually construct the response object
      const formattedAppointment = {
        _id: appointment._id?.toString(),
        // Keep original IDs as ObjectIds if they exist, otherwise use strings
        patientId: appointment.patientId?._id ?? appointment.patientId,
        doctorId: appointment.doctorId?._id ?? appointment.doctorId,
        timeSlotId: appointment.timeSlotId?.toString(),
        date: null, // Initialize date, will format below
        startTime: appointment.startTime,
        endTime: appointment.endTime,
        type: appointment.type,
        status: appointment.status,
        notes: appointment.notes,
        reasonForVisit: appointment.reasonForVisit,
        preliminaryAssessmentId: appointment.preliminaryAssessmentId?.toString(),
        isVirtual: appointment.isVirtual,
        videoConferenceLink: appointment.videoConferenceLink,
        createdAt: appointment.createdAt?.toISOString(),
        updatedAt: appointment.updatedAt?.toISOString(),
        cancelledAt: appointment.cancelledAt?.toISOString(),
        cancelReason: appointment.cancelReason,
        remindersSent: appointment.remindersSent, // Assuming this is already ok
        
        // --- MODIFIED: Handle both populated and aggregated user data --- 
        // Determine the source of user data (aggregation vs population)
        patient: appointment.patient || appointment.patientId || null,
        doctor: appointment.doctor || appointment.doctorId || null,
        patientUser: appointment.patientUser || appointment.patientId?.userId || null, 
        doctorUser: appointment.doctorUser || appointment.doctorId?.userId || null,
        // --- END MODIFICATION ---

        // Use the 'id' field added in the aggregation pipeline
        id: appointment.id?.toString() || appointment._id?.toString()
      };
      
      // Format date
      // Use optional chaining for safety
      const dateObj = appointment.date;
      if (dateObj instanceof Date && !isNaN(dateObj?.getTime())) {
         const year = dateObj.getFullYear();
         const month = String(dateObj.getMonth() + 1).padStart(2, '0');
         const day = String(dateObj.getDate()).padStart(2, '0');
         formattedAppointment.date = `${year}-${month}-${day}`;
      } else if (typeof dateObj === 'string') { 
         // Handle case where date might already be a string 'YYYY-MM-DD'
         formattedAppointment.date = dateObj;
      }

      // Clean up the nested objects (optional, but good practice)
      // Remove potentially sensitive or unnecessary fields before sending
      const safeUserProjection = (user) => {
        if (!user) return null;
        return {
          _id: user._id?.toString(),
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email, // Consider if email/phone are needed in lists
          phoneNumber: user.phoneNumber 
        };
      };
      
      formattedAppointment.patientUser = safeUserProjection(formattedAppointment.patientUser);
      formattedAppointment.doctorUser = safeUserProjection(formattedAppointment.doctorUser);

      // Simplify patient/doctor objects if needed
      const safeProfileProjection = (profile) => {
          if (!profile) return null;
          // Ensure we use the correct userId source
          const userId = profile.userId?._id?.toString() || profile.userId?.toString() || profile._id?.toString(); 
          return {
              _id: profile._id?.toString(),
              userId: userId
              // Add other necessary fields from Patient/Doctor models if needed
          };
      };
      // Pass the correct source object to the projection
      formattedAppointment.patient = safeProfileProjection(appointment.patient || appointment.patientId);
      formattedAppointment.doctor = safeProfileProjection(appointment.doctor || appointment.doctorId);

      return formattedAppointment;
    } catch (error) {
      console.error('Error formatting appointment in service:', error);
      // Attempt to return a minimally formatted object on error
      return {
         _id: appointment?._id?.toString(),
         error: "Failed to format appointment data fully"
      };
    }
  }

  /**
   * @desc    Get single appointment by ID
   * @param {string} id - Appointment ID
   * @returns {Object} Appointment or null
   */
  async getAppointmentById(id) {
    try {
      // Validate the ID first
      if (!id || !mongoose.Types.ObjectId.isValid(id)) {
        console.error('Invalid appointment ID passed to getAppointmentById:', id);
        return null;
      }
      
      // Step 1: Fetch the core Appointment document
      let appointment = await Appointment.findById(id).exec();
        
      if (!appointment) {
        return null;
      }
      
      // Step 2: Explicitly populate the necessary fields on the Mongoose document
      // Check if fields are already populated before trying again
      if (!appointment.populated('patientId')) {
          await appointment.populate({
            path: 'patientId',
            model: 'Patient',
            populate: {
              path: 'userId',
              model: 'User',
              select: 'firstName lastName email phoneNumber'
            }
          });
      }
      if (!appointment.populated('doctorId')) {
          await appointment.populate({
            path: 'doctorId',
            model: 'Doctor',
            populate: {
              path: 'userId',
              model: 'User',
              select: 'firstName lastName email phoneNumber'
            }
          });
      }
      
      // --- BEGIN DEBUG LOGGING ---
      console.log(`--- Populated Appointment Data (getAppointmentById: ${id}) ---`);
      // Convert Mongoose doc to plain object for reliable logging
      const appointmentObj = appointment ? appointment.toObject() : null;
      console.log('Appointment Object:', JSON.stringify(appointmentObj, null, 2));
      // Explicitly check populated fields
      console.log('Populated patientId:', JSON.stringify(appointmentObj?.patientId, null, 2));
      console.log('Populated patientId.userId:', JSON.stringify(appointmentObj?.patientId?.userId, null, 2));
      console.log('Populated doctorId:', JSON.stringify(appointmentObj?.doctorId, null, 2));
      console.log('Populated doctorId.userId:', JSON.stringify(appointmentObj?.doctorId?.userId, null, 2));
      console.log('--- End Populated Appointment Data ---');
      // --- END DEBUG LOGGING ---
      
      // Step 3: Format the fully populated Mongoose document
      return this.formatAppointmentForResponse(appointment);
    } catch (error) {
      console.error('Get appointment by ID error:', error);
      throw new Error('Failed to retrieve appointment: ' + error.message);
    }
  }
  
  /**
   * Create a new appointment and handle associated logic (e.g., mark timeslot)
   * @param {Object} appointmentData - Data for the new appointment
   * @param {string} createdByUserId - ID of the user creating the appointment
   * @returns {Promise<Object>} The created appointment document
   */
  async createAppointment(appointmentData, createdByUserId) {
    // Start session using a valid model, e.g., Appointment
    const session = await this.Appointment.startSession();
    session.startTransaction();
    try {
      // --- Fetch the single clinic ---
      const singleClinic = await this.Clinic.findOne().session(session);
      if (!singleClinic) {
        throw new AppError('No clinic found in the database. Cannot create appointment.', 500);
      }
      const clinicId = singleClinic._id;
      console.log(`[CreateAppointment] Found clinic ID: ${clinicId} to associate appointment with.`);
      // --- End Fetch Clinic ---

      // --- Validate and Convert IDs ---
      const objectIdFields = ['patientId', 'doctorId', 'timeSlotId', 'preliminaryAssessmentId'];
      objectIdFields.forEach(field => {
        if (appointmentData[field] && !mongoose.Types.ObjectId.isValid(appointmentData[field])) {
          throw new AppError(`Invalid format for ${field}`, 400);
        }
        if (appointmentData[field]) {
          appointmentData[field] = new mongoose.Types.ObjectId(appointmentData[field]);
        }
      });
      // --- End ID Validation ---

      // --- Fetch and Validate TimeSlot ---
      const timeSlot = await this.TimeSlot.findById(appointmentData.timeSlotId).session(session);
      if (!timeSlot) {
        throw new AppError('Selected time slot not found', 404);
      }
      if (timeSlot.isBooked) {
        throw new AppError('Selected time slot is already booked', 409);
      }
      // --- End TimeSlot Validation ---

      // --- Create the Appointment FIRST ---
      // Pass the data directly to create
      const appointment = await this.Appointment.create([{
        ...appointmentData,
        clinicId: clinicId,
        status: 'scheduled'
      }], { session }); 
      // --- End Appointment Creation ---

      // --- Update TimeSlot AFTER Appointment is created ---
      timeSlot.status = 'booked';
      timeSlot.bookedByAppointmentId = appointment[0]._id;
      await timeSlot.save({ session });
      // --- End TimeSlot update ---

      console.log(`[CreateAppointment] Appointment ${appointment[0]._id} created and linked to clinic ${clinicId}`);

      // --- Create audit log using this.AuditLog ---
      await this.AuditLog.create([{
        userId: createdByUserId,
        action: 'create',
        resource: 'appointment',
        resourceId: appointment[0]._id,
        details: appointmentData, // Consider filtering details
      }], { session });
      // --- End AuditLog ---

      // --- BEGIN Auto Google Meet Link Generation ---
      const createdAppointment = appointment[0]; // Get the created appointment document

      // Check if the appointment is virtual and if the service is available
      if (appointmentData.isVirtual !== false && this.googleCalendarService) { // Default to true if isVirtual is undefined/null
        console.log(`[CreateAppointment] Virtual appointment detected (ID: ${createdAppointment._id}), attempting to generate Meet link.`);
        try {
          // --- Fetch Doctor's User ID for Google Auth --- 
          const doctor = await this.Doctor.findById(createdAppointment.doctorId).select('userId').session(session);
          if (!doctor || !doctor.userId) {
            throw new Error(`Doctor record or associated user ID not found for doctorId: ${createdAppointment.doctorId}`);
          }
          const doctorUserId = doctor.userId.toString();
          console.log(`[CreateAppointment] Found doctor's userId (${doctorUserId}) for Google Meet generation.`);
          // --- End Fetch Doctor's User ID ---
          
          // Call the Google Calendar service to create the event and Meet link
          // Pass the DOCTOR's user ID for authentication AND the current session
          const googleEvent = await this.googleCalendarService.createMeetingForAppointment(
            doctorUserId, // Use the DOCTOR's user ID to find their token
            createdAppointment._id.toString(), // The ID of the appointment just created
            null, // Pass null for tokens parameter (unless needed differently)
            session // Pass the active transaction session
          );

          // If successful, update the appointment record with the Meet link and Event ID
          if (googleEvent && googleEvent.hangoutLink) {
            console.log(`[CreateAppointment] Google Meet link generated: ${googleEvent.hangoutLink}`);
            // Update the document directly within the transaction
            await this.Appointment.updateOne(
              { _id: createdAppointment._id },
              {
                $set: {
                  googleMeetLink: googleEvent.hangoutLink,
                  googleEventId: googleEvent.id
                }
              },
              { session } // Ensure this update is part of the transaction
            );
            console.log(`[CreateAppointment] Appointment ${createdAppointment._id} updated with Google Meet info.`);
          } else {
            console.warn(`[CreateAppointment] Google Meet link generation did not return a link for appointment ${createdAppointment._id}.`);
          }
        } catch (meetError) {
          // Log the error but DO NOT abort the transaction
          // The appointment is created, just the Meet link failed.
          console.error(`[CreateAppointment] Failed to automatically generate Google Meet link for appointment ${createdAppointment._id}:`, meetError);
          // Optionally: Add a notification or specific log entry about the failure
        }
      } else {
        console.log(`[CreateAppointment] Appointment ${createdAppointment._id} is not virtual or Google Calendar Service is unavailable. Skipping Meet link generation.`);
      }
      // --- END Auto Google Meet Link Generation ---

      // console.log('[SERVICE DEBUG] Before commitTransaction'); // DEBUG LINE REMOVED
      await session.commitTransaction();
      // console.log('[SERVICE DEBUG] After commitTransaction'); // DEBUG LINE REMOVED

      // Populate necessary fields before returning
      // console.log(`[SERVICE DEBUG] Before getAppointmentById for ID: ${appointment[0]._id}`); // DEBUG LINE REMOVED
      const populatedAppointment = await this.getAppointmentById(appointment[0]._id);
      // console.log('[SERVICE DEBUG] After getAppointmentById'); // DEBUG LINE REMOVED
      return populatedAppointment;

    } catch (error) {
      await session.abortTransaction();
      console.error('Error creating appointment:', error);
      // --- FIX Error Handling ---
      // Rethrow specific AppErrors, wrap others
      if (error instanceof AppError) {
          throw error;
      }
      // Wrap other errors in AppError for consistent handling
      throw new AppError(`Failed to create appointment: ${error.message}`, 500);
      // --- END Fix Error Handling ---
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Validate the appointment input data
   * @param {Object} appointmentData - Appointment data
   * @private
   */
  async _validateAppointmentInputData(appointmentData) {
    // Check required fields
    if (!appointmentData.patientId || !mongoose.Types.ObjectId.isValid(appointmentData.patientId)) {
      throw new Error('Valid patient ID is required');
    }
    
    if (!appointmentData.doctorId || !mongoose.Types.ObjectId.isValid(appointmentData.doctorId)) {
      throw new Error('Valid doctor ID is required');
    }
    
    if (!appointmentData.timeSlotId || !mongoose.Types.ObjectId.isValid(appointmentData.timeSlotId)) {
      throw new Error('Valid time slot ID is required');
    }
    
    // Check if patient exists
    const patient = await Patient.findById(appointmentData.patientId);
    if (!patient) {
      throw new Error('Patient not found');
    }
    
    // Check if doctor exists
    const doctor = await Doctor.findById(appointmentData.doctorId);
    if (!doctor) {
      throw new Error('Doctor not found');
    }
    
    // Check if time slot exists and is available
    const timeSlot = await TimeSlot.findById(appointmentData.timeSlotId);
    if (!timeSlot) {
      throw new Error('Time slot not found');
    }
    
    if (timeSlot.status !== 'available') {
      throw new Error('Time slot is not available');
    }
  }
  
  /**
   * Create assessment record if provided in appointment data
   * @param {Object} appointmentData - Appointment data containing assessment details
   * @param {ObjectId} appointmentId - The ID of the already created appointment
   * @param {Object} session - MongoDB session
   * @returns {ObjectId|null} Assessment ID or null
   * @private
   */
  async _createAssessmentIfProvided(appointmentData, appointmentId, session) {
    if (!appointmentData.assessment) {
      return null;
    }

    if (!appointmentId) {
      throw new Error('Cannot create assessment without a valid appointmentId');
    }
    
    console.log('Creating assessment with data:', appointmentData.assessment);
    
    // Format responses properly to include both question and answer
    const formattedResponses = appointmentData.assessment.responses || [];
    
    // Store the questions directly if provided
    const generatedQuestions = appointmentData.assessment.generatedQuestions || [];
    
    // Ensure each response includes the question field
    const validResponses = formattedResponses.map(response => {
      // If response already has both questionId and question, use as is
      if (response.questionId && response.question) {
        return response;
      }
      
      // If response has questionId but no question field, try to find it
      // This handles the case where frontend sends only questionId and answer
      if (response.questionId && !response.question && response.answer) {
        // Look for the question in the generatedQuestions array
        const questionObj = generatedQuestions.find(q => q.questionId === response.questionId);
        if (questionObj && questionObj.question) {
          return {
            questionId: response.questionId,
            question: questionObj.question,
            answer: response.answer
          };
        }
        
        // Fallback if question text not found
        return {
          questionId: response.questionId,
          question: `Question ${response.questionId}`, // Fallback text
          answer: response.answer
        };
      }
      
      return response;
    }).filter(r => r.questionId && r.answer !== null && r.answer !== undefined);
    
    console.log('Formatted responses for assessment:', validResponses);
    console.log('Generated questions for assessment:', generatedQuestions);
    
    // Now we have the appointmentId, include it directly
    const assessment = await Assessment.create([{
      patientId: appointmentData.patientId,
      appointmentId: appointmentId, // Use the provided appointmentId
      symptoms: appointmentData.assessment.symptoms || [],
      generatedQuestions: generatedQuestions,
      responses: validResponses,
      aiGeneratedReport: appointmentData.assessment.aiGeneratedReport,
      severity: appointmentData.assessment.severity || 'low', // Default to low if not provided
      status: 'completed',
      completionDate: new Date()
    }], { session });
    
    return assessment[0]._id;
  }
  
  /**
   * Create the appointment record
   * @param {Object} appointmentData - Appointment data (WITHOUT assessment sub-object)
   * @param {ObjectId|null} assessmentId - Should be null here, will be updated later
   * @param {Object} session - MongoDB session
   * @returns {Array} Created appointment document(s)
   * @private
   */
  async _createAppointmentRecord(appointmentData, assessmentId, session) {
    // Get time slot details
    const timeSlot = await TimeSlot.findById(appointmentData.timeSlotId);
    
    // Create appointment
    const appointment = await Appointment.create([{
      patientId: appointmentData.patientId,
      doctorId: appointmentData.doctorId,
      timeSlotId: appointmentData.timeSlotId,
      date: timeSlot.date,
      startTime: timeSlot.startTime,
      endTime: timeSlot.endTime,
      type: appointmentData.type || 'virtual',
      status: 'scheduled',
      notes: appointmentData.notes || '',
      reasonForVisit: appointmentData.reasonForVisit,
      preliminaryAssessmentId: assessmentId, // Will be null initially
      isVirtual: appointmentData.isVirtual !== false,
      videoConferenceLink: null,
      googleMeetLink: null,
      googleEventId: null,
      createdBy: appointmentData.createdBy
    }], { session });
    
    // DO NOT Update assessment here - it's handled in the main createAppointment flow
    // if (assessmentId) { ... }
    
    return appointment;
  }
  
  /**
   * Update time slot status
   * @param {string} timeSlotId - Time slot ID
   * @param {string} status - New status
   * @param {Object} session - MongoDB session
   * @private
   */
  async _updateTimeSlotStatus(timeSlotId, status, session) {
    await TimeSlot.findByIdAndUpdate(
      timeSlotId,
      { status },
      { session }
    );
  }
  
  /**
   * Create audit log for appointment creation
   * @param {string} userId - User ID 
   * @param {string} appointmentId - Appointment ID
   * @param {Object} appointmentData - Appointment data
   * @param {Object} session - MongoDB session
   * @private
   */
  async _createAppointmentAuditLog(userId, appointmentId, appointmentData, session) {
    await AuditLog.create([{
      userId: userId,
      action: 'create',
      resource: 'appointment',
      resourceId: appointmentId,
      details: {
        patientId: appointmentData.patientId,
        doctorId: appointmentData.doctorId,
        timeSlotId: appointmentData.timeSlotId,
        type: appointmentData.type || 'virtual'
      }
    }], { session });
  }
  
  /**
   * Get patient and doctor participants for an appointment
   * @param {string} patientId - Patient ID
   * @param {string} doctorId - Doctor ID
   * @returns {Object} Patient and doctor objects
   * @private
   */
  async _getParticipants(patientId, doctorId) {
    const [patient, doctor] = await Promise.all([
      Patient.findById(patientId),
      Doctor.findById(doctorId)
    ]);
    
    return { patient, doctor };
  }
  
  /**
   * Update appointment
   * @param {string} appointmentId - Appointment ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User updating the appointment
   * @returns {Object} Updated appointment
   */
  async updateAppointment(appointmentId, updateData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      // Create update object
      const updateObj = {};
      
      // Process specific fields
      if (updateData.status) {
        // Validate status transition
        if (!this._isValidStatusTransition(appointment.status, updateData.status)) {
          throw new Error(`Invalid status transition from ${appointment.status} to ${updateData.status}`);
        }
        
        updateObj.status = updateData.status;
        
        // Handle cancellation
        if (updateData.status === 'cancelled') {
          updateObj.cancelledAt = new Date();
          updateObj.cancelReason = updateData.cancelReason || 'No reason provided';
        }
      }
      
      // Add other updateable fields
      ['notes', 'type', 'reasonForVisit', 'isVirtual'].forEach(field => {
        if (updateData[field] !== undefined) {
          updateObj[field] = updateData[field];
        }
      });
      
      // Update videoConferenceLink based on isVirtual change if needed
      if (updateData.isVirtual !== undefined && updateData.isVirtual !== appointment.isVirtual) {
        // Don't generate a video link here, we'll use Google Meet integration instead
        if (updateData.isVirtual) {
          console.log('Appointment changed to virtual, video link will be generated via Google Calendar API');
          // videoConferenceLink will be set when doctor uses the generateMeetingLink endpoint
        } else {
          updateObj.videoConferenceLink = null;
          updateObj.googleMeetLink = null;
          updateObj.googleEventId = null;
        }
      }
      
      // Handle time slot changes
      if (updateData.timeSlotId && updateData.timeSlotId !== appointment.timeSlotId.toString()) {
        // Validate new time slot
        const newTimeSlot = await TimeSlot.findById(updateData.timeSlotId);
        if (!newTimeSlot) {
          throw new Error('New time slot not found');
        }
        
        if (newTimeSlot.status !== 'available') {
          throw new Error('New time slot is not available');
        }
        
        // Update the appointment with new slot info
        updateObj.timeSlotId = updateData.timeSlotId;
        updateObj.date = newTimeSlot.date;
        updateObj.startTime = newTimeSlot.startTime;
        updateObj.endTime = newTimeSlot.endTime;
        
        // Update time slots
        await TimeSlot.findByIdAndUpdate(
          appointment.timeSlotId,
          { status: 'available' },
          { session }
        );
        
        await TimeSlot.findByIdAndUpdate(
          updateData.timeSlotId,
          { status: 'booked' },
          { session }
        );
      }
      
      // Update the appointment
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: updateObj },
        { new: true, session }
      );
      
      // Create audit log
      await AuditLog.create([{
        userId: userId,
        action: 'update',
        resource: 'appointment',
        resourceId: appointmentId,
        details: {
          updatedFields: Object.keys(updateObj),
          previousStatus: appointment.status,
          newStatus: updateObj.status
        }
      }], { session });
      
      // Get patient and doctor for notifications
      const patient = await Patient.findById(appointment.patientId);
      const doctor = await Doctor.findById(appointment.doctorId);
      
      // Send notifications if status changed
      if (updateObj.status && updateObj.status !== appointment.status) {
        await this._sendAppointmentNotifications(
          updatedAppointment,
          patient,
          doctor,
          updateObj.status,
          session
        );
      }
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Get the complete updated appointment with related data
      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Update appointment error:', error);
      throw new Error(`Failed to update appointment: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Delete appointment
   * @param {string} appointmentId - Appointment ID
   * @param {string} userId - User deleting the appointment
   * @returns {boolean} Success status
   */
  async deleteAppointment(appointmentId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return false;
      }
      
      // Free up the time slot
      await TimeSlot.findByIdAndUpdate(
        appointment.timeSlotId,
        { status: 'available' },
        { session }
      );
      
      // Delete the appointment
      await Appointment.findByIdAndDelete(appointmentId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: userId,
        action: 'delete',
        resource: 'appointment',
        resourceId: appointmentId,
        details: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          date: appointment.date,
          status: appointment.status
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Delete appointment error:', error);
      throw new Error('Failed to delete appointment');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get patient's upcoming appointments
   * @param {string} patientId - Patient ID
   * @returns {Array} Upcoming appointments
   */
  async getPatientUpcomingAppointments(patientId) {
    try {
      // Current date
      const currentDate = new Date();
      
      // Ensure patientId is a valid ObjectId
      const patId = mongoose.Types.ObjectId(patientId);
      
      // Use aggregate for consistent result format
      const appointments = await Appointment.aggregate([
        {
          $match: {
            patientId: patId,
            date: { $gte: currentDate },
            status: { $in: ['scheduled', 'checked-in'] }
          }
        },
        {
          $sort: { date: 1, startTime: 1 }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $unwind: {
            path: '$doctor',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'doctor.userId',
            foreignField: '_id',
            as: 'doctorUser'
          }
        },
        {
          $unwind: {
            path: '$doctorUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            patientId: 1,
            doctorId: 1,
            timeSlotId: 1, 
            date: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            status: 1,
            notes: 1,
            reasonForVisit: 1,
            isVirtual: 1,
            videoConferenceLink: 1,
            'doctor._id': 1,
            'doctorUser._id': 1,
            'doctorUser.firstName': 1,
            'doctorUser.lastName': 1,
            'doctorUser.email': 1
          }
        }
      ]);
      
      return appointments;
    } catch (error) {
      console.error('Get patient upcoming appointments error:', error);
      throw new Error('Failed to retrieve upcoming appointments');
    }
  }
  
  /**
   * Get doctor's upcoming appointments
   * @param {string} doctorId - Doctor ID
   * @returns {Array} Upcoming appointments
   */
  async getDoctorUpcomingAppointments(doctorId) {
    try {
      // Current date
      const currentDate = new Date();
      
      // Ensure doctorId is a valid ObjectId
      const docId = mongoose.Types.ObjectId(doctorId);
      
      // Use aggregate for consistent result format
      const appointments = await Appointment.aggregate([
        {
          $match: {
            doctorId: docId,
            date: { $gte: currentDate },
            status: { $in: ['scheduled', 'checked-in'] }
          }
        },
        {
          $sort: { date: 1, startTime: 1 }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $unwind: {
            path: '$patient',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'patient.userId',
            foreignField: '_id',
            as: 'patientUser'
          }
        },
        {
          $unwind: {
            path: '$patientUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $project: {
            _id: 1,
            patientId: 1,
            doctorId: 1,
            timeSlotId: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            status: 1,
            notes: 1,
            reasonForVisit: 1,
            isVirtual: 1,
            videoConferenceLink: 1,
            'patient._id': 1,
            'patientUser._id': 1,
            'patientUser.firstName': 1,
            'patientUser.lastName': 1,
            'patientUser.email': 1
          }
        }
      ]);
      
      return appointments;
    } catch (error) {
      console.error('Get doctor upcoming appointments error:', error);
      throw new Error('Failed to retrieve upcoming appointments');
    }
  }
  
  /**
   * Get today's appointments for clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Array} Today's appointments
   */
  async getClinicTodayAppointments(clinicId) {
    try {
      // Get start and end of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Convert clinicId to ObjectId
      const clinicObjId = mongoose.Types.ObjectId(clinicId);
      
      // Use aggregation to get appointments with clinic filter
      const appointments = await Appointment.aggregate([
        {
          $match: {
            date: { $gte: today, $lt: tomorrow },
            status: { $in: ['scheduled', 'checked-in', 'in-progress'] }
          }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $unwind: {
            path: '$doctor',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$patient',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'doctor.userId',
            foreignField: '_id',
            as: 'doctorUser'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'patient.userId',
            foreignField: '_id',
            as: 'patientUser'
          }
        },
        {
          $unwind: {
            path: '$doctorUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$patientUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            $or: [
              { 'doctorUser.clinicId': clinicObjId },
              { 'patientUser.clinicId': clinicObjId }
            ]
          }
        },
        {
          $sort: { startTime: 1 }
        },
        {
          $project: {
            _id: 1,
            patientId: 1,
            doctorId: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            status: 1,
            reasonForVisit: 1,
            isVirtual: 1,
            'doctor._id': 1,
            'patient._id': 1,
            'doctorUser.firstName': 1,
            'doctorUser.lastName': 1,
            'patientUser.firstName': 1,
            'patientUser.lastName': 1
          }
        }
      ]);
      
      return appointments;
    } catch (error) {
      console.error('Get clinic today appointments error:', error);
      throw new Error('Failed to retrieve today\'s appointments');
    }
  }
  
  /**
   * Validate if a status transition is allowed
   * @param {string} currentStatus - Current appointment status
   * @param {string} newStatus - New appointment status
   * @returns {boolean} Is transition valid
   * @private
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'scheduled': ['checked-in', 'cancelled', 'no-show'],
      'checked-in': ['in-progress', 'cancelled'],
      'in-progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
      'no-show': []
    };
    
    return validTransitions[currentStatus] && validTransitions[currentStatus].includes(newStatus);
  }
  
  /**
   * Send notifications for appointment events
   * @param {Object} appointment - Appointment object
   * @param {Object} patient - Patient object
   * @param {Object} doctor - Doctor object
   * @param {string} eventType - Event type (created, cancelled, etc.)
   * @param {Object} session - Mongoose session
   * @private
   */
  async _sendAppointmentNotifications(appointment, patient, doctor, eventType, session) {
    try {
      // Get user data for notifications
      const patientUser = await User.findById(patient.userId);
      const doctorUser = await User.findById(doctor.userId);
      
      if (!patientUser || !doctorUser) {
        console.error('Failed to find users for appointment notifications');
        return;
      }
      
      // Determine notification content based on event type
      let title, patientMessage, doctorMessage;
      
      switch(eventType) {
        case 'created':
          title = 'New Appointment Scheduled';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been scheduled.`;
          doctorMessage = `New appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        case 'cancelled':
          title = 'Appointment Cancelled';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been cancelled.`;
          doctorMessage = `Appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been cancelled.`;
          break;
        case 'checked-in':
          title = 'Patient Checked In';
          patientMessage = `You have checked in for your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          doctorMessage = `${patientUser.firstName} ${patientUser.lastName} has checked in for the appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        case 'in-progress':
          title = 'Appointment In Progress';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} is now in progress.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} is now in progress.`;
          break;
        case 'completed':
          title = 'Appointment Completed';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been completed.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been completed.`;
          break;
        case 'no-show':
          title = 'Missed Appointment';
          patientMessage = `You missed your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          doctorMessage = `${patientUser.firstName} ${patientUser.lastName} did not show up for the appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        default:
          title = 'Appointment Update';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been updated.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been updated.`;
      }
      
      // Create in-app notification for patient
      await Notification.create([{
        userId: patient.userId,
        type: 'appointment',
        title,
        message: patientMessage,
        relatedTo: {
          model: 'Appointment',
          id: appointment._id
        },
        isRead: false,
        deliveryChannels: ['in-app'],
        deliveryStatus: [{
          channel: 'in-app',
          status: 'sent',
          sentAt: new Date()
        }]
      }], { session });
      
      // Create in-app notification for doctor
      await Notification.create([{
        userId: doctor.userId,
        type: 'appointment',
        title,
        message: doctorMessage,
        relatedTo: {
          model: 'Appointment',
          id: appointment._id
        },
        isRead: false,
        deliveryChannels: ['in-app'],
        deliveryStatus: [{
          channel: 'in-app',
          status: 'sent',
          sentAt: new Date()
        }]
      }], { session });
      
      // Send email notifications (outside of transaction to prevent rollback on email failure)
      if (eventType === 'created' || eventType === 'cancelled') {
        try {
          // Send appointment confirmation or cancellation email
          await emailService.sendAppointmentConfirmation({
            appointment,
            patient: {
              firstName: patientUser.firstName,
              lastName: patientUser.lastName,
              email: patientUser.email
            },
            doctor: {
              firstName: doctorUser.firstName,
              lastName: doctorUser.lastName
            },
            status: eventType
          });
        } catch (emailError) {
          console.error('Failed to send appointment notification email:', emailError);
          // Continue without failing the transaction
        }
      }
    } catch (error) {
      console.error('Send appointment notifications error:', error);
      // Don't throw here to prevent transaction rollback
    }
  }
  
  /**
   * Schedule appointment reminders
   * @returns {number} Number of reminders sent
   */
  async scheduleAppointmentReminders() {
    try {
      // Get appointments coming up in the next 24 hours that haven't had reminders sent
      const nextDay = new Date();
      nextDay.setHours(nextDay.getHours() + 24);
      
      const today = new Date();
      
      const upcomingAppointments = await Appointment.find({
        date: { $gte: today, $lte: nextDay },
        status: 'scheduled',
        'remindersSent.0': { $exists: false } // No reminders sent yet
      })
      .populate({
        path: 'patientId',
        populate: {
          path: 'userId'
        }
      })
      .populate({
        path: 'doctorId',
        populate: {
          path: 'userId'
        }
      });
      
      let remindersSent = 0;
      
      for (const appointment of upcomingAppointments) {
        try {
          const patientUser = appointment.patientId.userId;
          
          // Create in-app notification
          await Notification.create({
            userId: patientUser._id,
            type: 'reminder',
            title: 'Upcoming Appointment Reminder',
            message: `You have an appointment with Dr. ${appointment.doctorId.userId.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`,
            relatedTo: {
              model: 'Appointment',
              id: appointment._id
            },
            isRead: false,
            deliveryChannels: ['in-app', 'email'],
            deliveryStatus: [{
              channel: 'in-app',
              status: 'sent',
              sentAt: new Date()
            }]
          });
          
          // Send email reminder
          try {
            await emailService.sendAppointmentReminder(
              appointment, 
              {
                firstName: patientUser.firstName,
                lastName: patientUser.lastName,
                email: patientUser.email
              },
              {
                firstName: appointment.doctorId.userId.firstName,
                lastName: appointment.doctorId.userId.lastName
              }
            );
          } catch (emailError) {
            console.error('Failed to send reminder email:', emailError);
          }
          
          // Update appointment with reminder record
          await Appointment.findByIdAndUpdate(appointment._id, {
            $push: {
              remindersSent: {
                type: 'email',
                sentAt: new Date(),
                status: 'sent'
              }
            }
          });
          
          remindersSent++;
        } catch (reminderError) {
          console.error(`Failed to send reminder for appointment ${appointment._id}:`, reminderError);
        }
      }
      
      return remindersSent;
    } catch (error) {
      console.error('Schedule appointment reminders error:', error);
      throw new Error('Failed to schedule appointment reminders');
    }
  }
  
  /**
   * Handle no-show appointments
   * @returns {number} Number of appointments updated
   */
  async handleNoShowAppointments() {
    try {
      // Get appointments that were scheduled for earlier today but not checked in
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      // Appointments that were scheduled to start at least 30 minutes ago
      const thirtyMinutesAgo = new Date(now);
      thirtyMinutesAgo.setMinutes(now.getMinutes() - 30);
      
      // Convert time to HH:MM for comparison
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
      
      // Find scheduled appointments that should have started already
      const overdueAppointments = await Appointment.find({
        date: { $gte: startOfDay, $lte: now },
        startTime: { $lte: currentTime },
        status: 'scheduled'
      });
      
      let noShowCount = 0;
      
      for (const appointment of overdueAppointments) {
        try {
          // If appointment start time was more than 30 minutes ago, mark as no-show
          const appointmentHour = parseInt(appointment.startTime.split(':')[0]);
          const appointmentMinute = parseInt(appointment.startTime.split(':')[1]);
          const appointmentDate = new Date(appointment.date);
          appointmentDate.setHours(appointmentHour, appointmentMinute);
          
          if (appointmentDate < thirtyMinutesAgo) {
            await this.updateAppointment(appointment._id, { 
              status: 'no-show' 
            }, 'system');
            
            noShowCount++;
          }
        } catch (updateError) {
          console.error(`Failed to update no-show appointment ${appointment._id}:`, updateError);
        }
      }
      
      return noShowCount;
    } catch (error) {
      console.error('Handle no-show appointments error:', error);
      throw new Error('Failed to handle no-show appointments');
    }
  }
}

// Instantiate the service with the imported models
const models = {
  Appointment,
  TimeSlot,
  User,
  Patient,
  Doctor,
  Clinic,
  AuditLog,
  Notification,
  Assessment
};

// --- ADD LOGGING HERE ---
console.log('[AppointmentService Instantiation] Models being passed to constructor:', 
  Object.keys(models).reduce((acc, key) => {
    acc[key] = models[key] ? `Defined (Name: ${models[key].modelName})` : 'UNDEFINED';
    return acc;
  }, {}));
// --- END LOGGING ---

export default new AppointmentService(models, googleCalendarService);