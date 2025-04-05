// src/controllers/patientController.mjs

import { check, validationResult } from 'express-validator';
import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all patients
 * @route   GET /api/patients
 * @access  Private (Admin, Doctor, Staff)
 */
const getPatients = async (req, res, next, { patientService }) => {
  try {
    // Restrict access based on role
    if (!['admin', 'doctor', 'staff'].includes(req.userRole)) {
      return next(new AppError('You are not authorized to access patient records', 403));
    }
    
    // Add clinic filtering for non-admin users
    if (req.userRole !== 'admin' && req.clinicId) {
      req.query.clinicId = req.clinicId;
    }
    
    const result = await patientService.getAll(req.query);
    
    res.status(200).json({
      success: true,
      count: result.data.length,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      data: result.data
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single patient
 * @route   GET /api/patients/:id
 * @access  Private (Admin, Doctor, Staff, or Self)
 */
const getPatient = async (req, res, next, { patientService }) => {
  try {
    const patientId = req.params.id;
    
    // Check if the requester is the patient (self-access)
    const patientUserId = await patientService.getPatientUserId(patientId);
    const isSelfAccess = patientUserId && req.user._id.toString() === patientUserId.toString();
    
    // Determine if user has permissions to view this profile
    const canViewProfile = 
      isSelfAccess || 
      ['admin', 'doctor', 'staff'].includes(req.userRole);

    if (!canViewProfile) {
      return next(new AppError('You are not authorized to view this patient profile', 403));
    }
    
    const patient = await patientService.getById(patientId);
    
    if (!patient) {
      return next(new AppError('Patient not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new patient
 * @route   POST /api/patients
 * @access  Private (Admin, Staff)
 */
const createPatient = async (req, res, next, { patientService }) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatValidationErrors(errors.array()));
    }
    
    // Check if user has permission to create patients
    if (!['admin', 'staff'].includes(req.userRole)) {
      return next(new AppError('You are not authorized to create patient records', 403));
    }
    
    const patient = await patientService.create(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update patient
 * @route   PUT /api/patients/:id
 * @access  Private (Admin, Staff, Self)
 */
const updatePatient = async (req, res, next, { patientService }) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatValidationErrors(errors.array()));
    }
    
    const patientId = req.params.id;
    
    // Check if the requester is the patient (self-access)
    const patientUserId = await patientService.getPatientUserId(patientId);
    const isSelfAccess = patientUserId && req.user._id.toString() === patientUserId.toString();
    
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
    
    const patient = await patientService.update(patientId, req.body, req.user._id);
    
    if (!patient) {
      return next(new AppError('Patient not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete patient
 * @route   DELETE /api/patients/:id
 * @access  Private (Admin only)
 */
const deletePatient = async (req, res, next, { patientService }) => {
  try {
    // Only admin can delete patient records
    if (req.userRole !== 'admin') {
      return next(new AppError('You are not authorized to delete patient records', 403));
    }
    
    const success = await patientService.delete(req.params.id, req.user._id);
    
    if (!success) {
      return next(new AppError('Patient not found', 404));
    }
    
    res.status(200).json({
      success: true,
      message: 'Patient deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient profile (self)
 * @route   GET /api/patients/me
 * @access  Private (Patient)
 */
const getMyProfile = async (req, res, next, { patientService }) => {
  try {
    // Check if user is a patient
    if (req.userRole !== 'patient') {
      return next(new AppError('Only patients can access this endpoint', 403));
    }
    
    const patient = await patientService.getByUserId(req.user._id);
    
    if (!patient) {
      return next(new AppError('Patient profile not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update patient profile (self)
 * @route   PUT /api/patients/me
 * @access  Private (Patient)
 */
const updateMyProfile = async (req, res, next, { patientService }) => {
  try {
    // Check for validation errors
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json(formatValidationErrors(errors.array()));
    }
    
    // Check if user is a patient
    if (req.userRole !== 'patient') {
      return next(new AppError('Only patients can access this endpoint', 403));
    }
    
    // Restrict what fields can be updated
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
    
    const patient = await patientService.updateByUserId(req.user._id, filteredBody);
    
    if (!patient) {
      return next(new AppError('Patient profile not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: patient
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get patient's medical history
 * @route   GET /api/patients/:id/medical-history
 * @access  Private (Admin, Doctor, Staff, Self)
 */
const getMedicalHistory = async (req, res, next, { patientService }) => {
  try {
    const patientId = req.params.id;
    
    // Check if the requester is the patient (self-access)
    const patientUserId = await patientService.getPatientUserId(patientId);
    const isSelfAccess = patientUserId && req.user._id.toString() === patientUserId.toString();
    
    // Determine if user has permissions to view medical history
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
  } catch (error) {
    next(error);
  }
};

// Controller methods object
const patientController = {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getMyProfile,
  updateMyProfile,
  getMedicalHistory
};

// Define dependencies for each controller method
const dependencies = {
  getPatients: ['patientService'],
  getPatient: ['patientService'],
  createPatient: ['patientService'],
  updatePatient: ['patientService'],
  deletePatient: ['patientService'],
  getMyProfile: ['patientService'],
  updateMyProfile: ['patientService'],
  getMedicalHistory: ['patientService']
};

// Apply DI to the controller
const enhancedController = withServicesForController(patientController, dependencies);

// Export validation rules
export const createPatientValidation = [
  check('userId', 'User ID is required').not().isEmpty(),
  check('dateOfBirth', 'Valid date of birth is required').isISO8601().toDate(),
  check('gender', 'Gender must be male, female, or other').isIn(['male', 'female', 'other'])
];

export const updatePatientValidation = [
  check('dateOfBirth', 'Valid date of birth is required').optional().isISO8601().toDate(),
  check('gender', 'Gender must be male, female, or other').optional().isIn(['male', 'female', 'other'])
];

// Export individual methods with DI
export const {
  getPatients: getPatientsWithDI,
  getPatient: getPatientWithDI,
  createPatient: createPatientWithDI,
  updatePatient: updatePatientWithDI,
  deletePatient: deletePatientWithDI,
  getMyProfile: getMyProfileWithDI,
  updateMyProfile: updateMyProfileWithDI,
  getMedicalHistory: getMedicalHistoryWithDI
} = enhancedController;

// Default export for compatibility
export default {
  getPatients: getPatientsWithDI,
  getPatient: getPatientWithDI,
  createPatient: createPatientWithDI,
  updatePatient: updatePatientWithDI,
  deletePatient: deletePatientWithDI,
  getMyProfile: getMyProfileWithDI,
  updateMyProfile: updateMyProfileWithDI,
  getMedicalHistory: getMedicalHistoryWithDI,
  createPatientValidation,
  updatePatientValidation
};