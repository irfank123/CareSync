// src/controllers/appointmentController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';
import mongoose from 'mongoose';

/**
 * @desc    Get all appointments with filtering and pagination
 * @route   GET /api/appointments
 * @access  Private (Admin, Doctor, Staff)
 */
const getAppointments = async (req, res, next, { appointmentService }) => {
  // Extract query parameters for filtering and pagination
  const {
    page,
    limit,
    search,
    sort,
    order,
    status,
    type,
    doctorId,
    patientId,
    startDate,
    endDate
  } = req.query;
  
  // Determine if we should filter by clinic based on user role
  let clinicId = req.query.clinicId;
  if (req.userRole !== 'admin' && req.clinicId) {
    clinicId = req.clinicId;
  }
  
  // Check if user has permission to view all appointments
  if (!['admin', 'doctor', 'staff'].includes(req.userRole)) {
    // If patient, they can only see their own appointments
    if (req.userRole === 'patient') {
      const patientRecord = await getPatientForUser(req.user._id);
      if (!patientRecord) {
        return next(new AppError('Patient record not found', 404));
      }
      return res.redirect(`/api/appointments/patient/${patientRecord._id}`);
    }
    
    return next(new AppError('You are not authorized to view these appointments', 403));
  }

  const result = await appointmentService.getAllAppointments({
    page,
    limit,
    search,
    sort,
    order,
    status,
    type,
    doctorId,
    patientId,
    startDate,
    endDate,
    clinicId
  });
  
  res.status(200).json({
    success: true,
    count: result.appointments.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.appointments
  });
};

/**
 * Helper function to format date fields in appointment objects
 * @param {Object} appointment - Appointment object
 * @returns {Object} Appointment with formatted date
 */
const formatAppointmentDate = (appointment) => {
  if (!appointment) return appointment;
  
  // Create a copy of the appointment to avoid mutations
  const formattedAppointment = { ...appointment };
  
  // Format appointment date
  if (formattedAppointment.date) {
    // If date is an object (MongoDB date), format it as YYYY-MM-DD string
    if (typeof formattedAppointment.date === 'object') {
      // Check if it's a Date object
      if (formattedAppointment.date instanceof Date || 
          (formattedAppointment.date.constructor && formattedAppointment.date.constructor.name === 'Date')) {
        const date = new Date(formattedAppointment.date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedAppointment.date = `${year}-${month}-${day}`;
        } else {
          formattedAppointment.date = ''; // Invalid date
        }
      }
      // If it's an empty object, set to empty string
      else if (Object.keys(formattedAppointment.date).length === 0) {
        formattedAppointment.date = '';
      }
    }
  }
  
  return formattedAppointment;
};

/**
 * @desc    Get single appointment
 * @route   GET /api/appointments/:id
 * @access  Private (Admin, Doctor, Staff, or Involved Patient)
 */
const getAppointment = async (req, res, next, { appointmentService }) => {
  const appointmentId = req.params.id;
  
  const appointment = await appointmentService.getAppointmentById(appointmentId);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }
  
  // Check if user has permission to view this appointment
  const hasPermission = await checkAppointmentPermission(
    appointment, 
    req.user._id, 
    req.userRole
  );
  
  if (!hasPermission) {
    return next(new AppError('You are not authorized to view this appointment', 403));
  }
  
  // Format dates before sending response
  const formattedAppointment = formatAppointmentDate(appointment);
  
  res.status(200).json({
    success: true,
    data: formattedAppointment
  });
};

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (Admin, Staff, or Patient)
 */
const createAppointment = async (req, res, next, { appointmentService, patientService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  let appointmentData = { ...req.body }; // Clone request body

  // If the user is a patient creating their own appointment,
  // make sure patientId matches their own record
  if (req.userRole === 'patient') {
    const patientRecord = await patientService.getByUserId(req.user._id);
    if (!patientRecord) {
      return next(new AppError('Patient record not found', 404));
    }
    // Override patientId in request body
    appointmentData.patientId = patientRecord._id;
  }

  try {
    const { Types } = mongoose;
    const { Doctor } = await import('../models/index.mjs');

    // --- Doctor ID Handling ---
    const doctorIdentifier = appointmentData.doctorId;
    let actualDoctorId = null;

    if (!doctorIdentifier) {
      return next(new AppError('Doctor ID is required', 400));
    }

    if (Types.ObjectId.isValid(doctorIdentifier)) {
      actualDoctorId = doctorIdentifier;
      // Verify doctor exists
      const doctorExists = await Doctor.findById(actualDoctorId);
      if (!doctorExists) {
        return next(new AppError('Doctor not found with the provided ID', 404));
      }
    } else {
      // If not a valid ObjectId, assume it's a license number
      console.log(`Appointment Creation: Identifier ${doctorIdentifier} is not ObjectId, trying as licenseNumber`);
      const doctor = await Doctor.findOne({ licenseNumber: doctorIdentifier });
      if (!doctor) {
        return next(new AppError('Doctor not found with the provided license number', 404));
      }
      actualDoctorId = doctor._id;
      console.log(`Appointment Creation: Found doctor with ID ${actualDoctorId} using licenseNumber`);
    }
    // Update the appointmentData with the actual ObjectId
    appointmentData.doctorId = actualDoctorId;
    // --- End Doctor ID Handling ---

    // Ensure timeSlotId is a valid ObjectId
    if (!appointmentData.timeSlotId || !Types.ObjectId.isValid(appointmentData.timeSlotId)) {
      return next(new AppError('Invalid or missing time slot ID format', 400));
    }
    // Convert timeSlotId to ObjectId type
    appointmentData.timeSlotId = new Types.ObjectId(appointmentData.timeSlotId);

    // Ensure patientId is a valid ObjectId (it should be after the override above)
    if (!appointmentData.patientId || !Types.ObjectId.isValid(appointmentData.patientId)) {
        // If patientId is still invalid here, something went wrong with patient lookup
        return next(new AppError('Invalid or missing patient ID format', 400));
    }
    // Convert patientId to ObjectId type
    appointmentData.patientId = new Types.ObjectId(appointmentData.patientId);

    // Create the appointment using the modified data
    const appointment = await appointmentService.createAppointment(
      appointmentData,
      req.user._id
    );
    
    res.status(201).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return next(new AppError(`Invalid ${error.path}: ${error.value}`, 400));
    }
    console.error('Appointment Creation Error:', error);
    return next(error);
  }
};

/**
 * @desc    Update appointment
 * @route   PUT /api/appointments/:id
 * @access  Private (Admin, Staff, Doctor involved, or Patient involved)
 */
const updateAppointment = async (req, res, next, { appointmentService, patientService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  const appointmentId = req.params.id;
  
  // Get the appointment to check permissions
  const appointment = await appointmentService.getAppointmentById(appointmentId);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }
  
  // Check if user has permission to update this appointment
  const hasPermission = await checkAppointmentPermission(
    appointment, 
    req.user._id, 
    req.userRole
  );
  
  if (!hasPermission) {
    return next(new AppError('You are not authorized to update this appointment', 403));
  }
  
  // Restrict what patients can update
  if (req.userRole === 'patient') {
    // Patients can only cancel or check-in to their appointments
    const allowedUpdates = ['status'];
    const allowedStatus = ['cancelled', 'checked-in'];
    
    if (req.body.status && !allowedStatus.includes(req.body.status)) {
      return next(new AppError(`Patients can only ${allowedStatus.join(' or ')} appointments`, 403));
    }
    
    // Filter update data
    const filteredUpdate = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        filteredUpdate[field] = req.body[field];
      }
    });
    
    req.body = filteredUpdate;
  }
  
  // Update the appointment
  const updatedAppointment = await appointmentService.updateAppointment(
    appointmentId,
    req.body,
    req.user._id
  );
  
  res.status(200).json({
    success: true,
    data: updatedAppointment
  });
};

/**
 * @desc    Delete appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private (Admin only)
 */
const deleteAppointment = async (req, res, next, { appointmentService }) => {
  // Only admins can delete appointments
  if (req.userRole !== 'admin') {
    return next(new AppError('Only administrators can delete appointments', 403));
  }
  
  const appointmentId = req.params.id;
  
  const deleted = await appointmentService.deleteAppointment(
    appointmentId,
    req.user._id
  );
  
  if (!deleted) {
    return next(new AppError('Appointment not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Appointment deleted successfully'
  });
};

/**
 * @desc    Get patient's appointments
 * @route   GET /api/appointments/patient/:patientId
 * @access  Private (Admin, Doctor, Staff, or Patient themselves)
 */
const getPatientAppointments = async (req, res, next, { appointmentService, patientService }) => {
  const patientId = req.params.patientId;
  
  // If patient is accessing, verify it's their own record
  if (req.userRole === 'patient') {
    const patientRecord = await patientService.getByUserId(req.user._id);
    
    if (!patientRecord || patientRecord._id.toString() !== patientId) {
      return next(new AppError('You can only view your own appointments', 403));
    }
  }
  
  // Extract query parameters
  const {
    page = 1,
    limit = 10,
    sort = 'date',
    order = 'desc',
    status,
    startDate,
    endDate
  } = req.query;
  
  const result = await appointmentService.getAllAppointments({
    page,
    limit,
    sort,
    order,
    status,
    patientId,
    startDate,
    endDate
  });
  
  res.status(200).json({
    success: true,
    count: result.appointments.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.appointments
  });
};

/**
 * @desc    Get doctor's appointments
 * @route   GET /api/appointments/doctor/:doctorId
 * @access  Private (Admin, Staff, or Doctor themselves)
 */
const getDoctorAppointments = async (req, res, next, { appointmentService, doctorService }) => {
  try {
    console.log('GET doctor appointments request:', {
      doctorId: req.params.doctorId,
      userId: req.user?._id,
      role: req.userRole
    });
    
    const doctorId = req.params.doctorId;
    
    // Validate doctorId format
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      console.log('Invalid doctorId format:', doctorId);
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }
    
    // If doctor is accessing, verify it's their own record
    if (req.userRole === 'doctor') {
      const doctorRecord = await doctorService.getByUserId(req.user._id);
      
      if (!doctorRecord) {
        console.log('Doctor record not found for user:', req.user._id);
        return res.status(404).json({
          success: false,
          message: 'Doctor record not found for this user'
        });
      }
      
      if (doctorRecord._id.toString() !== doctorId) {
        console.log('Permission denied: Doctor trying to access another doctor\'s appointments');
        return res.status(403).json({
          success: false,
          message: 'You can only view your own appointments'
        });
      }
    }
    
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sort = 'date',
      order = 'desc',
      status,
      startDate,
      endDate
    } = req.query;
    
    console.log('Fetching appointments for doctor:', doctorId);
    
    const result = await appointmentService.getAllAppointments({
      page,
      limit,
      sort,
      order,
      status,
      doctorId,
      startDate,
      endDate
    });
    
    console.log(`Found ${result.appointments?.length || 0} appointments for doctor ${doctorId}`);
    
    res.status(200).json({
      success: true,
      count: result.appointments?.length || 0,
      total: result.total || 0,
      totalPages: result.totalPages || 1,
      currentPage: result.currentPage || 1,
      data: result.appointments || []
    });
  } catch (err) {
    console.error('Error fetching doctor appointments:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointments',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get upcoming appointments for the current user
 * @route   GET /api/appointments/upcoming
 * @access  Private
 */
const getUpcomingAppointments = async (req, res, next, { appointmentService, patientService, doctorService }) => {
  try {
    console.log('GET upcoming appointments request:', {
      userId: req.user._id,
      role: req.userRole
    });
    
    // Simple approach: Query all appointments for this user based on role
    const { Appointment, Patient, Doctor, User } = await import('../models/index.mjs');
    
    let appointments = [];
    
    // Find the user's patient/doctor ID
    if (req.userRole === 'patient') {
      // Get the patient record for this user
      const patient = await Patient.findOne({ userId: req.user._id });
      
      if (!patient) {
        return res.status(404).json({
          success: false,
          message: 'Patient record not found for this user'
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
      // Get the doctor record for this user
      const doctor = await Doctor.findOne({ userId: req.user._id });
      
      if (!doctor) {
        return res.status(404).json({
          success: false,
          message: 'Doctor record not found for this user'
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
        
    } else if (req.userRole === 'admin' || req.userRole === 'staff') {
      // For admin and staff, return all appointments
      appointments = await Appointment.find({}).lean();
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
      message: 'Failed to retrieve appointments',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Helper function to get patient record for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Patient record or null
 */
const getPatientForUser = async (userId) => {
  try {
    // Assuming you have a Patient model with a userId field
    const { Patient } = await import('../models/index.mjs');
    return await Patient.findOne({ userId });
  } catch (error) {
    console.error('Error getting patient record:', error);
    return null;
  }
};

/**
 * Helper function to get doctor record for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Doctor record or null
 */
const getDoctorForUser = async (userId) => {
  try {
    // Assuming you have a Doctor model with a userId field
    const { Doctor } = await import('../models/index.mjs');
    return await Doctor.findOne({ userId });
  } catch (error) {
    console.error('Error getting doctor record:', error);
    return null;
  }
};

/**
 * Helper function to check if a user has permission to access an appointment
 * @param {Object} appointment - Appointment object
 * @param {string} userId - User ID
 * @param {string} userRole - User role
 * @returns {boolean} Has permission
 */
const checkAppointmentPermission = async (appointment, userId, userRole) => {
  try {
    // Admins and staff have access to all appointments
    if (userRole === 'admin' || userRole === 'staff') {
      return true;
    }
    
    // For doctors, check if they are the assigned doctor
    if (userRole === 'doctor') {
      const doctorRecord = await getDoctorForUser(userId);
      return doctorRecord && doctorRecord._id.toString() === appointment.doctorId.toString();
    }
    
    // For patients, check if they are the patient for this appointment
    if (userRole === 'patient') {
      const patientRecord = await getPatientForUser(userId);
      return patientRecord && patientRecord._id.toString() === appointment.patientId.toString();
    }
    
    return false;
  } catch (error) {
    console.error('Error checking appointment permission:', error);
    return false;
  }
};

/**
 * @desc    Get timeslot for an appointment
 * @route   GET /api/appointments/timeslot/:id
 * @access  Private
 */
export const getAppointmentTimeslot = asyncHandler(async (req, res, next) => {
  const timeslotId = req.params.id;
  
  if (!timeslotId || !mongoose.Types.ObjectId.isValid(timeslotId)) {
    return next(new AppError('Invalid timeslot ID format', 400));
  }
  
  try {
    // Import the availability service directly
    const availabilityService = (await import('../services/availabilityService.mjs')).default;
    
    // Use the service to get the timeslot with formatted date
    const timeslot = await availabilityService.getTimeSlotWithFormattedDate(timeslotId);
    
    if (!timeslot) {
      return next(new AppError('Timeslot not found', 404));
    }
    
    console.log('getAppointmentTimeslot: Retrieved timeslot:', JSON.stringify(timeslot));
    
    // Ensure date is properly formatted even if the service method didn't do it
    if (timeslot.date && typeof timeslot.date === 'object') {
      console.log('getAppointmentTimeslot: Date is still an object, formatting manually');
      
      // If it's a Date object
      if (timeslot.date instanceof Date || 
          (timeslot.date.constructor && timeslot.date.constructor.name === 'Date')) {
        const date = new Date(timeslot.date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          timeslot.date = `${year}-${month}-${day}`;
        } else {
          timeslot.date = ''; // Invalid date
        }
      }
      // If it's an empty object, set to empty string
      else if (Object.keys(timeslot.date).length === 0) {
        timeslot.date = '';
      }
    }
    
    console.log('getAppointmentTimeslot: Sending response with formatted date:', 
      timeslot.date, 'type:', typeof timeslot.date);
    
    res.status(200).json({
      success: true,
      data: timeslot
    });
  } catch (error) {
    console.error('Get appointment timeslot error:', error);
    return next(new AppError(`Failed to retrieve timeslot: ${error.message}`, 500));
  }
});

// Define the dependencies for each controller method
const dependencies = {
  getAppointments: ['appointmentService'],
  getAppointment: ['appointmentService'],
  createAppointment: ['appointmentService', 'patientService'],
  updateAppointment: ['appointmentService', 'patientService'],
  deleteAppointment: ['appointmentService'],
  getPatientAppointments: ['appointmentService', 'patientService'],
  getDoctorAppointments: ['appointmentService', 'doctorService'],
  getUpcomingAppointments: ['appointmentService', 'patientService', 'doctorService']
};

// Create the controller object with all methods
const appointmentController = {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getUpcomingAppointments
};

// Apply DI to the controller
const enhancedController = withServicesForController(appointmentController, dependencies);

// Validation middleware
const createAppointmentValidation = [
  check('patientId', 'Patient ID is required').not().isEmpty(),
  check('doctorId', 'Doctor ID is required').not().isEmpty(),
  check('timeSlotId', 'Time slot ID is required').not().isEmpty(),
  check('reasonForVisit', 'Reason for visit is required').not().isEmpty(),
  check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
    .optional()
    .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
  check('isVirtual', 'isVirtual must be a boolean').optional().isBoolean()
];

const updateAppointmentValidation = [
  check('status', 'Status must be one of: scheduled, checked-in, in-progress, completed, cancelled, no-show')
    .optional()
    .isIn(['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show']),
  check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
    .optional()
    .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
  check('notes', 'Notes must be a string').optional().isString(),
  check('reasonForVisit', 'Reason for visit must be a string').optional().isString(),
  check('isVirtual', 'isVirtual must be a boolean').optional().isBoolean(),
  check('timeSlotId', 'Time slot ID must be a valid ID').optional().isMongoId(),
  check('cancelReason', 'Cancel reason is required when status is cancelled')
    .if(check('status').equals('cancelled'))
    .not()
    .isEmpty()
];

// Export the enhanced controller methods
export const {
  getAppointments: getAppointmentsWithDI,
  getAppointment: getAppointmentWithDI,
  createAppointment: createAppointmentWithDI,
  updateAppointment: updateAppointmentWithDI,
  deleteAppointment: deleteAppointmentWithDI,
  getPatientAppointments: getPatientAppointmentsWithDI,
  getDoctorAppointments: getDoctorAppointmentsWithDI,
  getUpcomingAppointments: getUpcomingAppointmentsWithDI
} = enhancedController;

// Export the validation middleware
export {
  createAppointmentValidation,
  updateAppointmentValidation
};

// Default export for compatibility
export default {
  getAppointments: getAppointmentsWithDI,
  getAppointment: getAppointmentWithDI,
  createAppointment: createAppointmentWithDI,
  updateAppointment: updateAppointmentWithDI,
  deleteAppointment: deleteAppointmentWithDI,
  getPatientAppointments: getPatientAppointmentsWithDI,
  getDoctorAppointments: getDoctorAppointmentsWithDI,
  getUpcomingAppointments: getUpcomingAppointmentsWithDI,
  createAppointmentValidation,
  updateAppointmentValidation
};