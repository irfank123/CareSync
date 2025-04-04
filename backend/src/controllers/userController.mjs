// src/controllers/userController.mjs

import BaseController from './base/baseController.mjs';
import userService from '../services/userService.mjs';
import { errorMiddleware } from '../middleware/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * User Controller extending the BaseController
 */
class UserController extends BaseController {
  constructor() {
    super(userService, 'User');
    
    // Bind additional methods
    this.getProfile = this.getProfile.bind(this);
    this.updateProfile = this.updateProfile.bind(this);
    this.searchUsers = this.searchUsers.bind(this);
    
    // Wrap with error handling
    this.getProfile = errorMiddleware.catchAsync(this.getProfile);
    this.updateProfile = errorMiddleware.catchAsync(this.updateProfile);
    this.searchUsers = errorMiddleware.catchAsync(this.searchUsers);
  }
  
  /**
   * Get current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getProfile(req, res, next) {
    const userProfile = await userService.getUserProfile(req.user._id);
    
    res.status(200).json({
      success: true,
      data: userProfile
    });
  }
  
  /**
   * Update current user profile
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async updateProfile(req, res, next) {
    // Restrict what fields can be updated
    const allowedFields = [
      'firstName', 'lastName', 'phoneNumber', 'profileImageUrl', 'preferences'
    ];
    
    // Filter request body to only include allowed fields
    const filteredBody = {};
    Object.keys(req.body).forEach(key => {
      if (allowedFields.includes(key)) {
        filteredBody[key] = req.body[key];
      }
    });
    
    const user = await userService.update(req.user._id, filteredBody);
    
    res.status(200).json({
      success: true,
      data: user
    });
  }
  
  /**
   * Search users by criteria
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async searchUsers(req, res, next) {
    const { query, fields, limit } = req.query;
    
    const searchCriteria = {
      query,
      fields: fields ? fields.split(',') : [],
      limit: limit ? parseInt(limit, 10) : 10
    };
    
    const users = await userService.searchUsers(searchCriteria);
    
    res.status(200).json({
      success: true,
      count: users.length,
      data: users
    });
  }
  
  /**
   * Override getAll to enforce permissions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAll(req, res, next) {
    // Get the user's role and clinic info from auth middleware
    const userRole = req.userRole;
    const userClinicId = req.clinicId;
    
    // Only allow clinic admins to view their own clinic's users
    let filterClinicId = req.query.clinicId;
    if (userRole !== 'admin' && userRole !== 'staff') {
      if (userClinicId) {
        req.query.clinicId = userClinicId;
      } else {
        return next(new AppError('You are not authorized to view these users', 403));
      }
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
    const userId = req.params.id;
    
    // Check if user is requesting their own profile
    const isSelfRequest = req.user._id.toString() === userId;
    
    // Determine if user has permissions to view this profile
    const canViewProfile = 
      isSelfRequest || 
      req.userRole === 'admin' || 
      (req.isClinicAdmin && req.clinicId);
      
    if (!canViewProfile) {
      return next(new AppError('You are not authorized to view this profile', 403));
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
    // Check if user has permission to create this type of user
    if (req.userRole !== 'admin') {
      // Clinic admins can only create staff, doctors, and patients
      const allowedRoles = ['doctor', 'staff', 'patient'];
      if (!allowedRoles.includes(req.body.role)) {
        return next(new AppError(`You cannot create users with role: ${req.body.role}`, 403));
      }
      
      // Ensure the new user is associated with the admin's clinic
      req.body.clinicId = req.clinicId;
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
    const userId = req.params.id;
    
    // Check if user is updating their own profile
    const isSelfUpdate = req.user._id.toString() === userId;
    
    // Determine if user has permissions to update this profile
    const canUpdateProfile = 
      isSelfUpdate || 
      req.userRole === 'admin' || 
      (req.isClinicAdmin && req.clinicId);
      
    if (!canUpdateProfile) {
      return next(new AppError('You are not authorized to update this profile', 403));
    }
    
    // If it's a self-update by non-admin, restrict what fields can be updated
    if (isSelfUpdate && req.userRole !== 'admin') {
      const allowedFields = [
        'firstName', 'lastName', 'phoneNumber', 'profileImageUrl', 'preferences'
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
   * Override delete to enforce permissions and prevent self-deletion
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async delete(req, res, next) {
    const userId = req.params.id;
    
    // Only admins and clinic admins can delete users
    if (req.userRole !== 'admin' && !(req.isClinicAdmin && req.clinicId)) {
      return next(new AppError('You are not authorized to delete users', 403));
    }

    // Prevent users from deleting themselves
    if (req.user._id.toString() === userId) {
      return next(new AppError('You cannot delete your own account', 400));
    }

    // Check if the user exists and belongs to the clinic (for clinic admins)
    if (req.isClinicAdmin && req.clinicId) {
      const userToDelete = await userService.getById(userId);
      
      if (!userToDelete) {
        return next(new AppError('User not found', 404));
      }
      
      // Verify clinic ID
      if (!userToDelete.clinicId || userToDelete.clinicId.toString() !== req.clinicId.toString()) {
        return next(new AppError('You can only delete users from your clinic', 403));
      }
    }
    
    // Call parent implementation
    return super.delete(req, res, next);
  }
}

// Create a single instance of UserController
const userController = new UserController();

// Export methods separately for easy integration with existing routes
export const {
  getAll: getUsers,
  getOne: getUser,
  create: createUser,
  update: updateUser,
  delete: deleteUser,
  getProfile,
  updateProfile,
  searchUsers
} = userController;

// Export validation rules
export const createUserValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updateUserValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updateProfileValidation = [
  // Use the validation middleware rules instead of duplicating here
];

// Export default with all methods for compatibility
export default {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  searchUsers,
  createUserValidation,
  updateUserValidation,
  updateProfileValidation
};