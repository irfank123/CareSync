// src/controllers/patientController.mjs

import BaseController from './base/baseController.mjs';
import patientService from '../services/patientService.mjs';
import { errorMiddleware } from '../middleware/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Patient Controller extending the BaseController
 */
class PatientController extends BaseController {
  constructor() {
    super(patientService, 'Patient');
    
    // Bind additional methods
    this.getMedicalHistory = this.getMedicalHistory.bind(this);
    
    // Wrap with error handling
    this.getMedicalHistory = errorMiddleware.catchAsync(this.getMedicalHistory);
  }
  
  /**
   * Override getAll to enforce permission checks
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAll(req, res, next) {
    // Restrict access based on role
    if (!['admin', 'doctor', 'staff'].includes(req.userRole)) {
      return next(new AppError('You are not authorized to access patient records', 403));
    }
    
    // Add clinic filtering for non-admin users
    if (req.userRole !== 'admin' && req.clinicId) {
      req.query.clinicId = req.clinicId;
    }
    
    // Call parent implementation
    return super.getAll(req, res, next);
  }
  
  /**
   * Override getOne to check self-access or role-based access
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getOne(req, res, next) {
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
    
    // Call parent implementation
    return super.getOne(req, res, next);
  }
  
  /**
   * Override create to enforce role-based permissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async create(req, res, next) {
    // Check if user has permission to create patients
    if (!['admin', 'staff'].includes(req.userRole)) {
      return next(new AppError('You are not authorized to create patient records', 403));
    }
    
    // Call parent implementation
    return super.create(req, res, next);
  }
  
  /**
   * Override update to check self-access or role-based access
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async update(req, res, next) {
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
    
    // Call parent implementation
    return super.update(req, res, next);
  }
  
  /**
   * Override delete to enforce admin-only access
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async delete(req, res, next) {
    // Only admin can delete patient records
    if (req.userRole !== 'admin') {
      return next(new AppError('You are not authorized to delete patient records', 403));
    }
    
    // Call parent implementation
    return super.delete(req, res, next);
  }
  
  /**
   * Get patient's medical history
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getMedicalHistory(req, res, next) {
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
  }
}

// Create a single instance of PatientController
const patientController = new PatientController();

// Export methods separately for easy integration with existing routes
export const {
  getAll: getPatients,
  getOne: getPatient,
  create: createPatient,
  update: updatePatient,
  delete: deletePatient,
  getOwnResource: getMyProfile,
  updateOwnResource: updateMyProfile,
  getMedicalHistory
} = patientController;

// Export validation rules
export const createPatientValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updatePatientValidation = [
  // Use the validation middleware rules instead of duplicating here
];

// Export default with all methods for compatibility
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