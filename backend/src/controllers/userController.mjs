// src/controllers/userController.mjs - Example with DI

import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Get all users with DI approach
 */
export const getUsers = withServices(
  async (req, res, next, { userService }) => {
    try {
      // Extract query parameters for filtering and pagination
      const options = {
        page: req.query.page || 1,
        limit: req.query.limit || 10,
        search: req.query.search,
        sort: req.query.sort || 'createdAt',
        order: req.query.order || 'desc',
        role: req.query.role,
        clinicId: req.query.clinicId
      };
      
      // Get the user's role and clinic info from auth middleware
      const userRole = req.userRole;
      const userClinicId = req.clinicId;
      
      // Only allow clinic admins to view their own clinic's users
      let filterClinicId = options.clinicId;
      if (userRole !== 'admin' && userRole !== 'staff') {
        if (userClinicId) {
          options.clinicId = userClinicId;
        } else {
          return next(new AppError('You are not authorized to view these users', 403));
        }
      }
      
      const result = await userService.getAll(options);
      
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
  },
  ['userService'] // Services to inject
);

/**
 * Get single user
 */
export const getUser = withServices(
  async (req, res, next, { userService }) => {
    try {
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
      
      const user = await userService.getById(userId);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },
  ['userService']
);

// Define the entire controller as an object
const userController = {
  /**
   * Create new user
   */
  createUser: async (req, res, next, { userService }) => {
    try {
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
      
      const user = await userService.create(req.body, req.user._id);
      
      res.status(201).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update user
   */
  updateUser: async (req, res, next, { userService }) => {
    try {
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
      
      const user = await userService.update(userId, req.body);
      
      if (!user) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        success: true,
        data: user
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Delete user
   */
  deleteUser: async (req, res, next, { userService }) => {
    try {
      const userId = req.params.id;
      
      // Only admins and clinic admins can delete users
      if (req.userRole !== 'admin' && !(req.isClinicAdmin && req.clinicId)) {
        return next(new AppError('You are not authorized to delete users', 403));
      }

      // Prevent users from deleting themselves
      if (req.user._id.toString() === userId) {
        return next(new AppError('You cannot delete your own account', 400));
      }

      // Check if the user belongs to the clinic (for clinic admins)
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
      
      const success = await userService.delete(userId, req.user._id);
      
      if (!success) {
        return next(new AppError('User not found', 404));
      }
      
      res.status(200).json({
        success: true,
        message: 'User deleted successfully'
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Get user profile
   */
  getProfile: async (req, res, next, { userService }) => {
    try {
      const userProfile = await userService.getUserProfile(req.user._id);
      
      res.status(200).json({
        success: true,
        data: userProfile
      });
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Update user profile
   */
  updateProfile: async (req, res, next, { userService }) => {
    try {
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
    } catch (error) {
      next(error);
    }
  },
  
  /**
   * Search users
   */
  searchUsers: async (req, res, next, { userService }) => {
    try {
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
    } catch (error) {
      next(error);
    }
  }
};

// Apply DI to all methods in the controller
const userControllerWithDI = withServicesForController(userController, {
  createUser: ['userService'],
  updateUser: ['userService'],
  deleteUser: ['userService'],
  getProfile: ['userService'],
  updateProfile: ['userService'],
  searchUsers: ['userService']
});

// Export individual methods from the DI-enhanced controller
export const {
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  searchUsers
} = userControllerWithDI;

// Export validation rules (not enhanced with DI)
export const createUserValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updateUserValidation = [
  // Use the validation middleware rules instead of duplicating here
];

export const updateProfileValidation = [
  // Use the validation middleware rules instead of duplicating here
];

// Export default for compatibility - combine individual exports and controller with DI
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