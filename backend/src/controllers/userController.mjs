// src/controllers/userController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import userService from '../services/userService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all users (with filters and pagination)
 * @route   GET /api/users
 * @access  Private (Admin or Clinic Admin)
 */
export const getUsers = asyncHandler(async (req, res, next) => {
  // Extract query parameters for filtering and pagination
  const {
    page = 1,
    limit = 10,
    role,
    search,
    sort = 'createdAt',
    order = 'desc',
    clinicId
  } = req.query;

  // Get the user's role and clinic info from auth middleware
  const userRole = req.userRole;
  const userClinicId = req.clinicId;

  // Only allow clinic admins to view their own clinic's users
  let filterClinicId = clinicId;
  if (userRole !== 'admin' && userRole !== 'staff') {
    if (userClinicId) {
      filterClinicId = userClinicId;
    } else {
      return next(new AppError('You are not authorized to view these users', 403));
    }
  }

  const result = await userService.getAllUsers({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    role,
    search,
    sort,
    order,
    clinicId: filterClinicId
  });
  
  res.status(200).json({
    success: true,
    count: result.users.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.users
  });
});

/**
 * @desc    Get single user
 * @route   GET /api/users/:id
 * @access  Private (Admin, Own User, or Related Clinic)
 */
export const getUser = asyncHandler(async (req, res, next) => {
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

  const user = await userService.getUserById(userId);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * @desc    Create new user
 * @route   POST /api/users
 * @access  Private (Admin or Clinic Admin)
 */
export const createUser = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

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

  const result = await userService.createUser(req.body, req.user._id);
  
  res.status(201).json({
    success: true,
    data: result
  });
});

/**
 * @desc    Update user
 * @route   PUT /api/users/:id
 * @access  Private (Admin, Own User, or Related Clinic)
 */
export const updateUser = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

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

  const user = await userService.updateUser(userId, req.body);
  
  if (!user) {
    return next(new AppError('User not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * @desc    Delete user
 * @route   DELETE /api/users/:id
 * @access  Private (Admin or Clinic Admin)
 */
export const deleteUser = asyncHandler(async (req, res, next) => {
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
  const userToDelete = await userService.getUserById(userId);
  
  if (!userToDelete) {
    return next(new AppError('User not found', 404));
  }
  
  // Clinic admins can only delete users from their clinic
  if (req.isClinicAdmin && req.clinicId) {
    if (!userToDelete.clinicId || userToDelete.clinicId.toString() !== req.clinicId.toString()) {
      return next(new AppError('You can only delete users from your clinic', 403));
    }
  }

  await userService.deleteUser(userId);
  
  res.status(200).json({
    success: true,
    message: 'User deleted successfully'
  });
});

/**
 * @desc    Update profile for current user
 * @route   PUT /api/users/profile
 * @access  Private
 */
export const updateProfile = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

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

  const user = await userService.updateUser(req.user._id, filteredBody);
  
  res.status(200).json({
    success: true,
    data: user
  });
});

/**
 * @desc    Get current user profile
 * @route   GET /api/users/profile
 * @access  Private
 */
export const getProfile = asyncHandler(async (req, res, next) => {
  const user = await userService.getUserById(req.user._id);
  
  res.status(200).json({
    success: true,
    data: user
  });
});

// Validation middleware
export const createUserValidation = [
  check('firstName', 'First name is required').not().isEmpty().trim(),
  check('lastName', 'Last name is required').not().isEmpty().trim(),
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password')
    .isLength({ min: 8 })
    .withMessage('Password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('Password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('Password must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('Password must contain a lowercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('Password must contain a special character'),
  check('role', 'Role must be patient, doctor, staff or admin').isIn(['patient', 'doctor', 'staff', 'admin']),
  check('phoneNumber', 'Valid phone number is required').not().isEmpty()
];

export const updateUserValidation = [
  check('firstName', 'First name is required').optional().not().isEmpty().trim(),
  check('lastName', 'Last name is required').optional().not().isEmpty().trim(),
  check('email', 'Please include a valid email').optional().isEmail().normalizeEmail(),
  check('phoneNumber', 'Valid phone number is required').optional().not().isEmpty(),
  check('isActive', 'isActive must be a boolean').optional().isBoolean()
];

export const updateProfileValidation = [
  check('firstName', 'First name is required').optional().not().isEmpty().trim(),
  check('lastName', 'Last name is required').optional().not().isEmpty().trim(),
  check('phoneNumber', 'Valid phone number is required').optional().not().isEmpty(),
  check('preferences.theme', 'Theme must be light, dark or system').optional().isIn(['light', 'dark', 'system']),
  check('preferences.language', 'Please provide a valid language code').optional().isLength({ min: 2, max: 5 })
];