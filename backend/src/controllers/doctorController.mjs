// src/controllers/doctorController.mjs

import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { AppError } from '../utils/errorHandler.mjs';
import { check } from 'express-validator';

/**
 * @desc    Get all doctors
 * @route   GET /api/doctors
 * @access  Public
 */
const getDoctors = async (req, res, next, { doctorService }) => {
  // Add clinic filtering for non-admin users
  if (req.userRole !== 'admin' && req.clinicId) {
    req.query.clinicId = req.clinicId;
  }
  
  const result = await doctorService.getAll(req.query);
  
  res.status(200).json({
    success: true,
    count: result.data.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.data
  });
};

/**
 * @desc    Get single doctor
 * @route   GET /api/doctors/:id
 * @access  Public
 */
const getDoctor = async (req, res, next, { doctorService }) => {
  const doctorId = req.params.id;
  
  // Check if the requester is the doctor (self-access)
  const doctorUserId = await doctorService.getDoctorUserId(doctorId);
  const isSelfAccess = doctorUserId && req.user && req.user._id.toString() === doctorUserId.toString();
  
  // In this case, everyone can view doctor profiles (including public)
  // But still record this specific check for potential future change
  
  const doctor = await doctorService.getById(doctorId);
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
};

/**
 * @desc    Create doctor
 * @route   POST /api/doctors
 * @access  Private (Admin, Staff)
 */
const createDoctor = async (req, res, next, { doctorService, userService }) => {
  // Check if user has permission to create doctors
  if (!['admin', 'staff'].includes(req.userRole)) {
    return next(new AppError('You are not authorized to create doctor records', 403));
  }
  
  const doctor = await doctorService.create(req.body, req.user._id);
  
  res.status(201).json({
    success: true,
    data: doctor
  });
};

/**
 * @desc    Update doctor
 * @route   PUT /api/doctors/:id
 * @access  Private (Admin, Staff, Self)
 */
const updateDoctor = async (req, res, next, { doctorService }) => {
  const doctorId = req.params.id;
  
  // Check if the requester is the doctor (self-access)
  const doctorUserId = await doctorService.getDoctorUserId(doctorId);
  const isSelfAccess = doctorUserId && req.user._id.toString() === doctorUserId.toString();
  
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
  
  const doctor = await doctorService.update(doctorId, req.body, req.user._id);
  
  if (!doctor) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
};

/**
 * @desc    Delete doctor
 * @route   DELETE /api/doctors/:id
 * @access  Private (Admin)
 */
const deleteDoctor = async (req, res, next, { doctorService }) => {
  // Only admin can delete doctor records
  if (req.userRole !== 'admin') {
    return next(new AppError('You are not authorized to delete doctor records', 403));
  }
  
  const success = await doctorService.delete(req.params.id, req.user._id);
  
  if (!success) {
    return next(new AppError('Doctor not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Doctor deleted successfully'
  });
};

/**
 * @desc    Get doctor profile (self)
 * @route   GET /api/doctors/me
 * @access  Private (Doctor)
 */
const getMyProfile = async (req, res, next, { doctorService }) => {
  // Check if user is a doctor
  if (req.userRole !== 'doctor') {
    return next(new AppError('Only doctors can access this endpoint', 403));
  }
  
  const doctor = await doctorService.getByUserId(req.user._id);
  
  if (!doctor) {
    return next(new AppError('Doctor profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
};

/**
 * @desc    Update doctor profile (self)
 * @route   PUT /api/doctors/me
 * @access  Private (Doctor)
 */
const updateMyProfile = async (req, res, next, { doctorService }) => {
  // Check if user is a doctor
  if (req.userRole !== 'doctor') {
    return next(new AppError('Only doctors can access this endpoint', 403));
  }
  
  // Restrict what fields can be updated
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
  
  const doctor = await doctorService.updateByUserId(req.user._id, filteredBody);
  
  if (!doctor) {
    return next(new AppError('Doctor profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: doctor
  });
};

/**
 * @desc    Get doctor's availability
 * @route   GET /api/doctors/:id/availability
 * @access  Public
 */
const getDoctorAvailability = async (req, res, next, { doctorService, availabilityService }) => {
  const doctorId = req.params.id;
  const { startDate, endDate } = req.query;
  
  const availability = await availabilityService.getDoctorAvailability(
    doctorId, 
    startDate ? new Date(startDate) : undefined,
    endDate ? new Date(endDate) : undefined
  );
  
  res.status(200).json({
    success: true,
    data: availability
  });
};

// Define validation rules
const createDoctorValidation = [
  check('userId', 'User ID is required').not().isEmpty(),
  check('specialties', 'At least one specialty is required').isArray().notEmpty(),
  check('licenseNumber', 'License number is required').not().isEmpty(),
  check('appointmentFee', 'Appointment fee must be a number').isNumeric()
];

const updateDoctorValidation = [
  check('specialties', 'Specialties must be an array').optional().isArray(),
  check('licenseNumber', 'License number is required').optional().not().isEmpty(),
  check('appointmentFee', 'Appointment fee must be a number').optional().isNumeric(),
  check('acceptingNewPatients', 'acceptingNewPatients must be a boolean').optional().isBoolean()
];

// Group controller methods
const doctorController = {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getMyProfile,
  updateMyProfile,
  getDoctorAvailability
};

// Define dependencies
const dependencies = {
  getDoctors: ['doctorService'],
  getDoctor: ['doctorService'],
  createDoctor: ['doctorService', 'userService'],
  updateDoctor: ['doctorService'],
  deleteDoctor: ['doctorService'],
  getMyProfile: ['doctorService'],
  updateMyProfile: ['doctorService'],
  getDoctorAvailability: ['doctorService', 'availabilityService']
};

// Apply DI to controller
const enhancedController = withServicesForController(doctorController, dependencies);

// Export individual methods with DI
export const {
  getDoctors: getDoctorsWithDI,
  getDoctor: getDoctorWithDI,
  createDoctor: createDoctorWithDI,
  updateDoctor: updateDoctorWithDI,
  deleteDoctor: deleteDoctorWithDI,
  getMyProfile: getMyProfileWithDI,
  updateMyProfile: updateMyProfileWithDI,
  getDoctorAvailability: getDoctorAvailabilityWithDI
} = enhancedController;

// Export validation rules
export {
  createDoctorValidation,
  updateDoctorValidation
};

// Default export for compatibility
export default {
  getDoctors: getDoctorsWithDI,
  getDoctor: getDoctorWithDI,
  createDoctor: createDoctorWithDI,
  updateDoctor: updateDoctorWithDI,
  deleteDoctor: deleteDoctorWithDI,
  getMyProfile: getMyProfileWithDI,
  updateMyProfile: updateMyProfileWithDI,
  getDoctorAvailability: getDoctorAvailabilityWithDI,
  createDoctorValidation,
  updateDoctorValidation
};