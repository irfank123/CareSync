// src/controllers/doctorController.mjs

import BaseController from './base/baseController.mjs';
import doctorService from '../services/doctorService.mjs';
import { errorMiddleware } from '../middleware/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Doctor Controller extending the BaseController
 */
class DoctorController extends BaseController {
  constructor() {
    super(doctorService, 'Doctor');
    
    // Bind additional methods
    this.getDoctorAvailability = this.getDoctorAvailability.bind(this);
    
    // Wrap with error handling
    this.getDoctorAvailability = errorMiddleware.catchAsync(this.getDoctorAvailability);
  }
  
  /**
   * Get doctor's availability
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getDoctorAvailability(req, res, next) {
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
  }
  
  /**
   * Override getAll to handle public access with filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAll(req, res, next) {
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
    const doctorId = req.params.id;
    
    // Check if the requester is the doctor (self-access)
    const doctorUserId = await doctorService.getDoctorUserId(doctorId);
    const isSelfAccess = doctorUserId && req.user._id.toString() === doctorUserId.toString();
    
    // In this case, everyone can view doctor profiles (including public)
    // But still record this specific check for potential future change
    
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
    // Check if user has permission to create doctors
    if (!['admin', 'staff'].includes(req.userRole)) {
      return next(new AppError('You are not authorized to create doctor records', 403));
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
    // Only admin can delete doctor records
    if (req.userRole !== 'admin') {
      return next(new AppError('You are not authorized to delete doctor records', 403));
    }
    
    // Call parent implementation
    return super.delete(req, res, next);
  }
}

// Create a single instance of DoctorController
const doctorController = new DoctorController();

// Export methods separately for easy integration with existing routes
export const {
  getAll: getDoctors,
  getOne: getDoctor,
  create: createDoctor,
  update: updateDoctor,
  delete: deleteDoctor,
  getOwnResource: getMyProfile,
  updateOwnResource: updateMyProfile,
  getDoctorAvailability
} = doctorController;

// Export validation rules
export const createDoctorValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updateDoctorValidation = [
  // Use the validation middleware rules instead of duplicating here
];

// Export default with all methods for compatibility
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