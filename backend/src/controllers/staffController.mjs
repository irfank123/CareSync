// src/controllers/staffController.mjs

import { check, validationResult } from 'express-validator';
import staffService from '../services/staffService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Get all staff members (with filters and pagination)
 * @route   GET /api/staff
 * @access  Private (Admin or Clinic Admin)
 */
export const getStaffMembers = asyncHandler(async (req, res, next) => {
  // Extract query parameters for filtering and pagination
  const {
    page = 1,
    limit = 10,
    search,
    sort = 'createdAt',
    order = 'desc',
    position,
    department,
    clinicId
  } = req.query;
  
  // Determine if we should filter by clinic based on user role
  let filterClinicId = clinicId;
  if (req.userRole !== 'admin' && req.clinicId) {
    filterClinicId = req.clinicId;
  }
  
  // Only admins and clinic admins can view staff members
  if (req.userRole !== 'admin' && !(req.isClinicAdmin && req.clinicId)) {
    return next(new AppError('You are not authorized to view staff members', 403));
  }

  const result = await staffService.getAll({
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
    search,
    sort,
    order,
    position,
    department,
    clinicId: filterClinicId
  });
  
  res.status(200).json({
    success: true,
    count: result.data.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.data
  });
});

/**
 * @desc    Get single staff member
 * @route   GET /api/staff/:id
 * @access  Private (Admin, Clinic Admin, or Self)
 */
export const getStaffMember = asyncHandler(async (req, res, next) => {
  const staffId = req.params.id;
  
  // Check if the requester is the staff member (self-access)
  const staffUser = await staffService.getStaffUserId(staffId);
  const isSelfAccess = staffUser && req.user._id.toString() === staffUser.toString();
  
  // Determine if user has permissions to view this profile
  const canViewProfile = 
    isSelfAccess || 
    req.userRole === 'admin' || 
    (req.isClinicAdmin && req.clinicId);

  if (!canViewProfile) {
    return next(new AppError('You are not authorized to view this staff profile', 403));
  }

  const staff = await staffService.getById(staffId);
  
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: staff
  });
});

/**
 * @desc    Create new staff member
 * @route   POST /api/staff
 * @access  Private (Admin or Clinic Admin)
 */
export const createStaffMember = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Only admins and clinic admins can create staff members
  if (req.userRole !== 'admin' && !(req.isClinicAdmin && req.clinicId)) {
    return next(new AppError('You are not authorized to create staff members', 403));
  }
  
  // If the user is a clinic admin, associate with their clinic
  if (req.clinicId) {
    req.body.clinicId = req.clinicId;
  }

  const staff = await staffService.create(req.body, req.user._id);
  
  res.status(201).json({
    success: true,
    data: staff
  });
});

/**
 * @desc    Update staff member
 * @route   PUT /api/staff/:id
 * @access  Private (Admin, Clinic Admin, or Self)
 */
export const updateStaffMember = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const staffId = req.params.id;
  
  // Check if the requester is the staff member (self-access)
  const staffUserId = await staffService.getStaffUserId(staffId);
  const isSelfAccess = staffUserId && req.user._id.toString() === staffUserId.toString();
  
  // Determine if user has permissions to update this profile
  const canUpdateProfile = 
    isSelfAccess || 
    req.userRole === 'admin' || 
    (req.isClinicAdmin && req.clinicId);

  if (!canUpdateProfile) {
    return next(new AppError('You are not authorized to update this staff profile', 403));
  }

  // If it's a self-update and not an admin, restrict what can be updated
  if (isSelfAccess && req.userRole !== 'admin' && !req.isClinicAdmin) {
    const allowedFields = ['department'];
    
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

  const staff = await staffService.update(staffId, req.body, req.user._id);
  
  if (!staff) {
    return next(new AppError('Staff member not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: staff
  });
});

/**
 * @desc    Delete staff member
 * @route   DELETE /api/staff/:id
 * @access  Private (Admin or Clinic Admin)
 */
export const deleteStaffMember = asyncHandler(async (req, res, next) => {
  const staffId = req.params.id;
  
  // Only admins and clinic admins can delete staff members
  if (req.userRole !== 'admin' && !(req.isClinicAdmin && req.clinicId)) {
    return next(new AppError('You are not authorized to delete staff members', 403));
  }

  // Check if the staff belongs to this clinic (for clinic admins)
  if (req.isClinicAdmin && req.clinicId) {
    const staff = await staffService.getById(staffId);
    
    if (!staff) {
      return next(new AppError('Staff member not found', 404));
    }
    
    // Verify clinic ID
    if (staff.user && staff.user.clinicId && 
        staff.user.clinicId.toString() !== req.clinicId.toString()) {
      return next(new AppError('You can only delete staff members from your clinic', 403));
    }
  }

  const success = await staffService.delete(staffId, req.user._id);
  
  if (!success) {
    return next(new AppError('Staff member not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Staff member deleted successfully'
  });
});

/**
 * @desc    Get current staff profile (for staff users)
 * @route   GET /api/staff/me
 * @access  Private (Staff)
 */
export const getMyProfile = asyncHandler(async (req, res, next) => {
  // Check if the user is a staff member
  if (req.userRole !== 'staff') {
    return next(new AppError('Only staff users can access this endpoint', 403));
  }

  const staff = await staffService.getByUserId(req.user._id);
  
  if (!staff) {
    return next(new AppError('Staff profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: staff
  });
});

/**
 * @desc    Update current staff profile (for staff users)
 * @route   PUT /api/staff/me
 * @access  Private (Staff)
 */
export const updateMyProfile = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  // Check if the user is a staff member
  if (req.userRole !== 'staff') {
    return next(new AppError('Only staff users can access this endpoint', 403));
  }

  // Restrict what can be updated
  const allowedFields = ['department'];
  
  // Filter request body to only include allowed fields
  const filteredBody = {};
  Object.keys(req.body).forEach(key => {
    if (allowedFields.includes(key)) {
      filteredBody[key] = req.body[key];
    }
  });

  const staff = await staffService.updateByUserId(req.user._id, filteredBody);
  
  if (!staff) {
    return next(new AppError('Staff profile not found', 404));
  }
  
  res.status(200).json({
    success: true,
    data: staff
  });
});

// Validation middleware
export const createStaffValidation = [
  check('userId', 'User ID is required').not().isEmpty(),
  check('position', 'Position must be one of receptionist, nurse, administrator, or other')
    .isIn(['receptionist', 'nurse', 'administrator', 'other']),
  check('department', 'Department is required').not().isEmpty(),
  check('permissions', 'Permissions must be an array').optional().isArray()
];

export const updateStaffValidation = [
  check('position', 'Position must be one of receptionist, nurse, administrator, or other')
    .optional()
    .isIn(['receptionist', 'nurse', 'administrator', 'other']),
  check('department', 'Department is required').optional().not().isEmpty(),
  check('permissions', 'Permissions must be an array').optional().isArray()
];

// Export all functions
export default {
  getStaffMembers,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  getMyProfile,
  updateMyProfile,
  createStaffValidation,
  updateStaffValidation
};