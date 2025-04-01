// src/controllers/doctorController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import doctorService from '../services/doctorService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all doctors (with filters and pagination)
 * @route   GET /api/doctors
 * @access  Private/Public (Based on config)
 */
export const getDoctors = asyncHandler(async (req, res, next) => {
  // Extract query parameters for filtering and pagination
  const {
    page = 1,
    limit = 10,
    search,
    sort = 'createdAt',
    order = 'desc',
    specialty,
    acceptingNewPatients,
    minFee,
    maxFee,
    clinicId
  } = req.query;
  
  // Determine if we should filter by clinic based on user role
  let filterClinicId = clinicId;
  if (req.userRole !== 'admin' && req.clinicId) {
    filterClinicId = req.clinicId;
  }

  const result = await doctorService.getAllDoctors({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
    sort,
    order,
    specialty,
    acceptingNewPatients: acceptingNewPatients === 'true',
    minFee: minFee ? parseInt(minFee, 10) : undefined,
    maxFee: maxFee ? parseInt(maxFee, 10) : undefined,
    clinicId: filterClinicId
  });
  
  return res.status(200).json({
    success: true,
    count: result.doctors.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.doctors
  });
});

/**
 * @desc    Get single doctor
 * @route   GET /api/doctors/:id
 * @access  Private/Public (Based on config)
 */
export const getDoctor = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.id;
  
  const doctor = await doctorService.getDoctorById(doctorId);
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
});

/**
 * @desc    Create new doctor
 * @route   POST /api/doctors
 * @access  Private (Admin or Staff)
 */
export const createDoctor = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Check if user has permission to create doctors
  if (!['admin', 'staff'].includes(req.userRole)) {
    return next(new AppError('You are not authorized to create doctor records', 403));
  }
  
  // If the user is a clinic staff/admin, associate with their clinic
  if (req.clinicId) {
    req.body.clinicId = req.clinicId;
  }

  const doctor = await doctorService.createDoctor(req.body);
  
  res.status(201).json({
    success: true,
    data: doctor
  });
});

/**
 * @desc    Update doctor
 * @route   PUT /api/doctors/:id
 * @access  Private (Admin, Staff, or Self)
 */
export const updateDoctor = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const doctorId = req.params.id;
  
  // Check if the requester is the doctor (self-access)
  const doctorUser = await doctorService.getDoctorUserId(doctorId);
  const isSelfAccess = doctorUser && req.user._id.toString() === doctorUser.toString();
  
  // Determine if user has permissions to update this profile
  const canUpdateProfile = 
    isSelfAccess || 
    ['admin', 'staff'].includes(req.userRole);

  if (!canUpdateProfile) {
    return next(new AppError('You are not authorized to update this doctor profile', 403));
  }

  // If it's a self-update, restrict what can be updated
  if (isSelfAccess && !['admin', 'staff'].includes(req.userRole)) {
    const allowedFields = [
      'specialties', 'education', 'acceptingNewPatients', 'availabilitySchedule'
    ];
    
    // Filter request body to only include allowed fields
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });
    
    // Replace req.body with filtered body
    req.body = filteredBody;
  }

  const doctor = await doctorService.updateDoctor(doctorId, req.body);
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
});

/**
 * @desc    Delete doctor
 * @route   DELETE /api/doctors/:id
 * @access  Private (Admin only)
 */
export const deleteDoctor = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.id;
  
  // Only admin can delete doctor records
  if (req.userRole !== 'admin') {
    return next(new AppError('You are not authorized to delete doctor records', 403));
  }

  const deleted = await doctorService.deleteDoctor(doctorId);
  
  if (!deleted) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Doctor deleted successfully'
  });
});

/**
 * @desc    Get current doctor profile (for doctor users)
 * @route   GET /api/doctors/me
 * @access  Private (Doctor)
 */
export const getMyProfile = asyncHandler(async (req, res, next) => {
  // Check if the user is a doctor
  if (req.userRole !== 'doctor') {
    return next(new AppError('Only doctor users can access this endpoint', 403));
  }

  const doctor = await doctorService.getDoctorByUserId(req.user._id);
  
  if (!doctor) {
    return next(new AppError('Doctor profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
});

/**
 * @desc    Update current doctor profile (for doctor users)
 * @route   PUT /api/doctors/me
 * @access  Private (Doctor)
 */
export const updateMyProfile = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Check if the user is a doctor
  if (req.userRole !== 'doctor') {
    return next(new AppError('Only doctor users can access this endpoint', 403));
  }

  // Restrict what can be updated
  const allowedFields = [
    'specialties', 'education', 'acceptingNewPatients', 'availabilitySchedule'
  ];
  
  // Filter request body to only include allowed fields
  const filteredBody = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  const doctor = await doctorService.updateDoctorByUserId(req.user._id, filteredBody);
  
  if (!doctor) {
    return next(new AppError('Doctor profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
});

/**
 * @desc    Get doctor's availability
 * @route   GET /api/doctors/:id/availability
 * @access  Private/Public (Based on config)
 */
export const getDoctorAvailability = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.id;
  const { startDate, endDate } = req.query;
  
  const availability = await doctorService.getDoctorAvailability(
    doctorId, 
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );
  
  res.status(200).json({
    success: true,
    data: availability
  });
});

// Validation middleware
export const createDoctorValidation = [
  check('userId', 'User ID is required').not().isEmpty(),
  check('specialties', 'At least one specialty is required').isArray().notEmpty(),
  check('licenseNumber', 'License number is required').not().isEmpty(),
  check('appointmentFee', 'Appointment fee must be a number').isNumeric(),
  check('education', 'Education must be an array').optional().isArray(),
  check('education.*.institution', 'Institution name is required').optional().not().isEmpty(),
  check('education.*.degree', 'Degree is required').optional().not().isEmpty(),
  check('education.*.graduationYear', 'Graduation year must be a number').optional().isNumeric(),
  check('availabilitySchedule', 'Availability schedule must be an array').optional().isArray(),
  check('availabilitySchedule.*.dayOfWeek', 'Day of week must be between 0-6').optional().isInt({ min: 0, max: 6 }),
  check('availabilitySchedule.*.startTime', 'Start time is required').optional().not().isEmpty(),
  check('availabilitySchedule.*.endTime', 'End time is required').optional().not().isEmpty(),
  check('maxAppointmentsPerDay', 'Max appointments per day must be a number').optional().isNumeric(),
  check('appointmentDuration', 'Appointment duration must be a number').optional().isNumeric(),
  check('acceptingNewPatients', 'Accepting new patients must be a boolean').optional().isBoolean()
];

export const updateDoctorValidation = [
  check('specialties', 'Specialties must be an array').optional().isArray(),
  check('licenseNumber', 'License number must be a string').optional().isString(),
  check('appointmentFee', 'Appointment fee must be a number').optional().isNumeric(),
  check('education', 'Education must be an array').optional().isArray(),
  check('education.*.institution', 'Institution name is required').optional().not().isEmpty(),
  check('education.*.degree', 'Degree is required').optional().not().isEmpty(),
  check('education.*.graduationYear', 'Graduation year must be a number').optional().isNumeric(),
  check('availabilitySchedule', 'Availability schedule must be an array').optional().isArray(),
  check('availabilitySchedule.*.dayOfWeek', 'Day of week must be between 0-6').optional().isInt({ min: 0, max: 6 }),
  check('availabilitySchedule.*.startTime', 'Start time is required').optional().not().isEmpty(),
  check('availabilitySchedule.*.endTime', 'End time is required').optional().not().isEmpty(),
  check('maxAppointmentsPerDay', 'Max appointments per day must be a number').optional().isNumeric(),
  check('appointmentDuration', 'Appointment duration must be a number').optional().isNumeric(),
  check('acceptingNewPatients', 'Accepting new patients must be a boolean').optional().isBoolean()
];

// Export all functions
export default {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getMyProfile,
  updateMyProfile,
  getDoctorAvailability,
  createDoctorValidation,
  updateDoctorValidation
};