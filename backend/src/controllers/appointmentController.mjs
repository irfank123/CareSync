// src/controllers/appointmentController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import appointmentService from '../services/appointmentService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all appointments with filtering and pagination
 * @route   GET /api/appointments
 * @access  Private (Admin, Doctor, Staff)
 */
export const getAppointments = asyncHandler(async (req, res, next) => {
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
});

/**
 * @desc    Get single appointment
 * @route   GET /api/appointments/:id
 * @access  Private (Admin, Doctor, Staff, or Involved Patient)
 */
export const getAppointment = asyncHandler(async (req, res, next) => {
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
  
  res.status(200).json({
    success: true,
    data: appointment
  });
});

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (Admin, Staff, or Patient)
 */
export const createAppointment = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  // If the user is a patient creating their own appointment,
  // make sure patientId matches their own record
  if (req.userRole === 'patient') {
    const patientRecord = await getPatientForUser(req.user._id);
    if (!patientRecord) {
      return next(new AppError('Patient record not found', 404));
    }
    
    // Override patientId in request body
    req.body.patientId = patientRecord._id;
  }
  
  // Create the appointment
  const appointment = await appointmentService.createAppointment(
    req.body,
    req.user._id
  );
  
  res.status(201).json({
    success: true,
    data: appointment
  });
});

/**
 * @desc    Update appointment
 * @route   PUT /api/appointments/:id
 * @access  Private (Admin, Staff, Doctor involved, or Patient involved)
 */
export const updateAppointment = asyncHandler(async (req, res, next) => {
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
});

/**
 * @desc    Delete appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private (Admin only)
 */
export const deleteAppointment = asyncHandler(async (req, res, next) => {
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
});

/**
 * @desc    Get patient's appointments
 * @route   GET /api/appointments/patient/:patientId
 * @access  Private (Admin, Doctor, Staff, or Patient themselves)
 */
export const getPatientAppointments = asyncHandler(async (req, res, next) => {
  const patientId = req.params.patientId;
  
  // If patient is accessing, verify it's their own record
  if (req.userRole === 'patient') {
    const patientRecord = await getPatientForUser(req.user._id);
    
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
});

/**
 * @desc    Get doctor's appointments
 * @route   GET /api/appointments/doctor/:doctorId
 * @access  Private (Admin, Staff, or Doctor themselves)
 */
export const getDoctorAppointments = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  
  // If doctor is accessing, verify it's their own record
  if (req.userRole === 'doctor') {
    const doctorRecord = await getDoctorForUser(req.user._id);
    
    if (!doctorRecord || doctorRecord._id.toString() !== doctorId) {
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
    doctorId,
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
});

/**
 * @desc    Get upcoming appointments for current user
 * @route   GET /api/appointments/upcoming
 * @access  Private
 */
export const getUpcomingAppointments = asyncHandler(async (req, res, next) => {
  let appointments = [];
  
  if (req.userRole === 'patient') {
    const patientRecord = await getPatientForUser(req.user._id);
    
    if (!patientRecord) {
      return next(new AppError('Patient record not found', 404));
    }
    
    appointments = await appointmentService.getPatientUpcomingAppointments(patientRecord._id);
  } else if (req.userRole === 'doctor') {
    const doctorRecord = await getDoctorForUser(req.user._id);
    
    if (!doctorRecord) {
      return next(new AppError('Doctor record not found', 404));
    }
    
    appointments = await appointmentService.getDoctorUpcomingAppointments(doctorRecord._id);
  } else {
    // For admin and staff, return today's appointments for their clinic
    if (req.clinicId) {
      appointments = await appointmentService.getClinicTodayAppointments(req.clinicId);
    } else {
      return next(new AppError('Clinic ID is required for staff and admin users', 400));
    }
  }
  
  res.status(200).json({
    success: true,
    count: appointments.length,
    data: appointments
  });
});

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

// Validation middleware
export const createAppointmentValidation = [
  check('patientId', 'Patient ID is required').not().isEmpty(),
  check('doctorId', 'Doctor ID is required').not().isEmpty(),
  check('timeSlotId', 'Time slot ID is required').not().isEmpty(),
  check('reasonForVisit', 'Reason for visit is required').not().isEmpty(),
  check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
    .optional()
    .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
  check('isVirtual', 'isVirtual must be a boolean').optional().isBoolean()
];

export const updateAppointmentValidation = [
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

// Export all functions
export default {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getUpcomingAppointments,
  createAppointmentValidation,
  updateAppointmentValidation
};