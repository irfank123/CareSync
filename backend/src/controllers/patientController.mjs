// src/controllers/patientController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import patientService from '../services/patientService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all patients (with filters and pagination)
 * @route   GET /api/patients
 * @access  Private (Admin, Doctor, Staff)
 */
export const getPatients = asyncHandler(async (req, res, next) => {
  // Extract query parameters for filtering and pagination
  const {
    page = 1,
    limit = 10,
    search,
    sort = 'createdAt',
    order = 'desc',
    gender,
    minAge,
    maxAge,
    condition
  } = req.query;
  
  // Clinic ID filtering based on user role
  let clinicId = req.query.clinicId;
  
  // If the user is not a global admin, restrict to their clinic
  if (req.userRole !== 'admin') {
    // For clinic users, force filtering by their clinic ID
    if (req.clinicId) {
      clinicId = req.clinicId;
    }
  }
  
  // Restrict access based on role
  if (!['admin', 'doctor', 'staff'].includes(req.userRole)) {
    return next(new AppError('You are not authorized to access patient records', 403));
  }

  const result = await patientService.getAllPatients({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
    sort,
    order,
    clinicId,
    gender,
    minAge: minAge ? parseInt(minAge, 10) : undefined,
    maxAge: maxAge ? parseInt(maxAge, 10) : undefined,
    condition
  });
  
  res.status(200).json({
    success: true,
    count: result.patients.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.patients
  });
});

/**
 * @desc    Get single patient
 * @route   GET /api/patients/:id
 * @access  Private (Admin, Doctor, Staff, or Self)
 */
export const getPatient = asyncHandler(async (req, res, next) => {
  const patientId = req.params.id;
  
  // Check if the requester is the patient (self-access)
  const patientUser = await patientService.getPatientUserId(patientId);
  const isSelfAccess = patientUser && req.user._id.toString() === patientUser.toString();
  
  // Determine if user has permissions to view this profile
  const canViewProfile = 
    isSelfAccess || 
    ['admin', 'doctor', 'staff'].includes(req.userRole);

  if (!canViewProfile) {
    return next(new AppError('You are not authorized to view this patient profile', 403));
  }

  const patient = await patientService.getPatientById(patientId);
  
  if (!patient) {
    return next(new AppError('Patient not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: patient
  });
});

/**
 * @desc    Create new patient
 * @route   POST /api/patients
 * @access  Private (Admin or Staff)
 */
export const createPatient = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Check if user has permission to create patients
  if (!['admin', 'staff'].includes(req.userRole)) {
    return next(new AppError('You are not authorized to create patient records', 403));
  }
  
  // If the user is a clinic staff/admin, associate with their clinic
  if (req.clinicId) {
    req.body.clinicId = req.clinicId;
  }

  const patient = await patientService.createPatient(req.body);
  
  res.status(201).json({
    success: true,
    data: patient
  });
});

/**
 * @desc    Update patient
 * @route   PUT /api/patients/:id
 * @access  Private (Admin, Staff, or Self)
 */
export const updatePatient = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const patientId = req.params.id;
  
  // Check if the requester is the patient (self-access)
  const patientUser = await patientService.getPatientUserId(patientId);
  const isSelfAccess = patientUser && req.user._id.toString() === patientUser.toString();
  
  // Determine if user has permissions to update this profile
  const canUpdateProfile = 
    isSelfAccess || 
    ['admin', 'staff'].includes(req.userRole);

  if (!canUpdateProfile) {
    return next(new AppError('You are not authorized to update this patient profile', 403));
  }

  // If it's a self-update, restrict what can be updated
  if (isSelfAccess && !['admin', 'staff'].includes(req.userRole)) {
    const allowedFields = [
      'address', 'emergencyContact', 'allergies', 'currentMedications', 'preferredCommunication'
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

  const patient = await patientService.updatePatient(patientId, req.body);
  
  if (!patient) {
    return next(new AppError('Patient not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: patient
  });
});

/**
 * @desc    Delete patient
 * @route   DELETE /api/patients/:id
 * @access  Private (Admin only)
 */
export const deletePatient = asyncHandler(async (req, res, next) => {
  const patientId = req.params.id;
  
  // Only admin can delete patient records
  if (req.userRole !== 'admin') {
    return next(new AppError('You are not authorized to delete patient records', 403));
  }

  const deleted = await patientService.deletePatient(patientId);
  
  if (!deleted) {
    return next(new AppError('Patient not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Patient deleted successfully'
  });
});

/**
 * @desc    Get current patient profile (for patient users)
 * @route   GET /api/patients/me
 * @access  Private (Patient)
 */
export const getMyProfile = asyncHandler(async (req, res, next) => {
  // Check if the user is a patient
  if (req.userRole !== 'patient') {
    return next(new AppError('Only patient users can access this endpoint', 403));
  }

  const patient = await patientService.getPatientByUserId(req.user._id);
  
  if (!patient) {
    return next(new AppError('Patient profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: patient
  });
});

/**
 * @desc    Update current patient profile (for patient users)
 * @route   PUT /api/patients/me
 * @access  Private (Patient)
 */
export const updateMyProfile = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Check if the user is a patient
  if (req.userRole !== 'patient') {
    return next(new AppError('Only patient users can access this endpoint', 403));
  }

  // Restrict what can be updated
  const allowedFields = [
    'address', 'emergencyContact', 'allergies', 'currentMedications', 'preferredCommunication'
  ];
  
  // Filter request body to only include allowed fields
  const filteredBody = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  const patient = await patientService.updatePatientByUserId(req.user._id, filteredBody);
  
  if (!patient) {
    return next(new AppError('Patient profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: patient
  });
});

/**
 * @desc    Get patient medical history
 * @route   GET /api/patients/:id/medical-history
 * @access  Private (Admin, Doctor, Staff, or Self)
 */
export const getMedicalHistory = asyncHandler(async (req, res, next) => {
  const patientId = req.params.id;
  
  // Check if the requester is the patient (self-access)
  const patientUser = await patientService.getPatientUserId(patientId);
  const isSelfAccess = patientUser && req.user._id.toString() === patientUser.toString();
  
  // Determine if user has permissions to view this history
  const canViewHistory = 
    isSelfAccess || 
    ['admin', 'doctor', 'staff'].includes(req.userRole);

  if (!canViewHistory) {
    return next(new AppError('You are not authorized to view this medical history', 403));
  }

  const history = await patientService.getMedicalHistory(patientId);
  
  res.status(200).json({
    success: true,
    data: history
  });
});

// Validation middleware
export const createPatientValidation = [
  check('userId', 'User ID is required').not().isEmpty(),
  check('dateOfBirth', 'Valid date of birth is required').isISO8601().toDate(),
  check('gender', 'Gender must be male, female, or other').isIn(['male', 'female', 'other']),
  check('address.street', 'Street address is required').optional().not().isEmpty(),
  check('address.city', 'City is required').optional().not().isEmpty(),
  check('address.state', 'State is required').optional().not().isEmpty(),
  check('address.zipCode', 'ZIP code is required').optional().not().isEmpty(),
  check('address.country', 'Country is required').optional().not().isEmpty(),
  check('emergencyContact.name', 'Emergency contact name is required').optional().not().isEmpty(),
  check('emergencyContact.relationship', 'Relationship is required').optional().not().isEmpty(),
  check('emergencyContact.phoneNumber', 'Valid phone number is required').optional().not().isEmpty(),
  check('allergies', 'Allergies must be an array').optional().isArray(),
  check('medicalHistory', 'Medical history must be an array').optional().isArray(),
  check('currentMedications', 'Current medications must be an array').optional().isArray(),
  check('preferredCommunication', 'Preferred communication must be email, sms, or phone').optional().isIn(['email', 'sms', 'phone'])
];

export const updatePatientValidation = [
  check('dateOfBirth', 'Valid date of birth is required').optional().isISO8601().toDate(),
  check('gender', 'Gender must be male, female, or other').optional().isIn(['male', 'female', 'other']),
  check('address.street', 'Street address is required').optional().not().isEmpty(),
  check('address.city', 'City is required').optional().not().isEmpty(),
  check('address.state', 'State is required').optional().not().isEmpty(),
  check('address.zipCode', 'ZIP code is required').optional().not().isEmpty(),
  check('address.country', 'Country is required').optional().not().isEmpty(),
  check('emergencyContact.name', 'Emergency contact name is required').optional().not().isEmpty(),
  check('emergencyContact.relationship', 'Relationship is required').optional().not().isEmpty(),
  check('emergencyContact.phoneNumber', 'Valid phone number is required').optional().not().isEmpty(),
  check('allergies', 'Allergies must be an array').optional().isArray(),
  check('medicalHistory', 'Medical history must be an array').optional().isArray(),
  check('currentMedications', 'Current medications must be an array').optional().isArray(),
  check('preferredCommunication', 'Preferred communication must be email, sms, or phone').optional().isIn(['email', 'sms', 'phone'])
];

// Export all functions
export default {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getMyProfile,
  updateMyProfile,
  getMedicalHistory,
  createPatientValidation,
  updatePatientValidation
};