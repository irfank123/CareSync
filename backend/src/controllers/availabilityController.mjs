// src/controllers/availabilityController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import availabilityService from '../services/availabilityService.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';
import mongoose from 'mongoose';

/**
 * @desc    Get time slots for a doctor
 * @route   GET /api/availability/doctor/:doctorId/slots
 * @access  Private/Public (Based on config)
 */
export const getTimeSlots = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  const { startDate, endDate } = req.query;
  
  // Validate doctorId format for MongoDB ObjectId
  if (!doctorId || doctorId === '[object Object]' || doctorId === 'undefined') {
    return next(new AppError('Invalid doctor ID format', 400));
  }
  
  try {
    // Attempt to convert to a valid ObjectId or catch the error
    const { Types } = mongoose;
    const validDoctorId = Types.ObjectId.isValid(doctorId) ? doctorId : null;
    
    if (!validDoctorId) {
      return next(new AppError(`Invalid MongoDB ObjectId format: ${doctorId}`, 400));
    }
    
    // Parse dates if provided
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Validate date format
    if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
      return next(new AppError('Invalid date format', 400));
    }
    
    const timeSlots = await availabilityService.getTimeSlots(validDoctorId, start, end);
    
    res.status(200).json({
      success: true,
      count: timeSlots.length,
      data: timeSlots
    });
  } catch (error) {
    console.error('Get time slots error:', error);
    return next(new AppError(`Failed to retrieve time slots: ${error.message}`, 500));
  }
});

/**
 * @desc    Get available time slots for a doctor
 * @route   GET /api/availability/doctor/:doctorId/slots/available
 * @access  Private/Public (Based on config)
 */
export const getAvailableTimeSlots = asyncHandler(async (req, res, next) => {
  const doctorIdentifier = req.params.doctorId;
  const { startDate, endDate } = req.query;
  
  // Validate doctorId format for MongoDB ObjectId or assume it's a license number
  if (!doctorIdentifier || doctorIdentifier === '[object Object]' || doctorIdentifier === 'undefined') {
    return next(new AppError('Invalid doctor identifier format', 400));
  }
  
  try {
    let actualDoctorId = null;
    const { Types } = mongoose;
    const { Doctor } = await import('../models/index.mjs');

    // Check if it's a valid ObjectId
    if (Types.ObjectId.isValid(doctorIdentifier)) {
      actualDoctorId = doctorIdentifier;
      // Optionally, verify this doctor ID exists
      const doctorExists = await Doctor.findById(actualDoctorId);
      if (!doctorExists) {
        return next(new AppError('Doctor not found with the provided ID', 404));
      }
    } else {
      // If not a valid ObjectId, assume it's a license number
      console.log(`Identifier ${doctorIdentifier} is not ObjectId, trying as licenseNumber`);
      const doctor = await Doctor.findOne({ licenseNumber: doctorIdentifier });
      
      if (!doctor) {
        return next(new AppError('Doctor not found with the provided license number', 404));
      }
      actualDoctorId = doctor._id;
      console.log(`Found doctor with ID ${actualDoctorId} using licenseNumber`);
    }
    
    // Parse dates if provided
    const start = startDate ? new Date(startDate) : null;
    const end = endDate ? new Date(endDate) : null;
    
    // Validate date format
    if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
      return next(new AppError('Invalid date format', 400));
    }
    
    // Call the service with the actual MongoDB ObjectId
    const timeSlots = await availabilityService.getAvailableTimeSlots(actualDoctorId, start, end);
    
    res.status(200).json({
      success: true,
      count: timeSlots.length,
      data: timeSlots
    });
  } catch (error) {
    console.error('Get available time slots error:', error);
    return next(new AppError(`Failed to retrieve available time slots: ${error.message}`, 500));
  }
});

/**
 * @desc    Create a new time slot
 * @route   POST /api/availability/slots
 * @access  Private (Admin, Doctor or Staff)
 */
export const createTimeSlot = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  // Add user ID to slot data for audit
  req.body.createdBy = req.user._id;
  
  // Modified permission check - Get the doctor record to check ownership
  let canCreateSlot = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canCreateSlot = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(req.body.doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canCreateSlot = true;
    }
  }
  
  if (!canCreateSlot) {
    return next(new AppError('You are not authorized to create time slots for this doctor', 403));
  }
  
  const timeSlot = await availabilityService.createTimeSlot(req.body);
  
  res.status(201).json({
    success: true,
    data: timeSlot
  });
});

/**
 * @desc    Update a time slot
 * @route   PUT /api/availability/slots/:slotId
 * @access  Private (Admin, Doctor or Staff)
 */
export const updateTimeSlot = asyncHandler(async (req, res, next) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  const slotId = req.params.slotId;
  
  // Check if the user has permission to update this slot
  // This requires getting the slot first to check the doctor ID
  const slot = await availabilityService.getTimeSlotById(slotId);
  
  if (!slot) {
    return next(new AppError('Time slot not found', 404));
  }
  
  // Modified permission check
  let canUpdateSlot = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canUpdateSlot = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(slot.doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canUpdateSlot = true;
    }
  }
  
  if (!canUpdateSlot) {
    return next(new AppError('You are not authorized to update this time slot', 403));
  }
  
  const updatedSlot = await availabilityService.updateTimeSlot(slotId, req.body, req.user._id);
  
  res.status(200).json({
    success: true,
    data: updatedSlot
  });
});

/**
 * @desc    Delete a time slot
 * @route   DELETE /api/availability/slots/:slotId
 * @access  Private (Admin, Doctor or Staff)
 */
export const deleteTimeSlot = asyncHandler(async (req, res, next) => {
  const slotId = req.params.slotId;
  
  // Check if the user has permission to delete this slot
  // This requires getting the slot first to check the doctor ID
  const slot = await availabilityService.getTimeSlotById(slotId);
  
  if (!slot) {
    return next(new AppError('Time slot not found', 404));
  }
  
  // Modified permission check
  let canDeleteSlot = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canDeleteSlot = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(slot.doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canDeleteSlot = true;
    }
  }
  
  if (!canDeleteSlot) {
    return next(new AppError('You are not authorized to delete this time slot', 403));
  }
  
  await availabilityService.deleteTimeSlot(slotId, req.user._id);
  
  res.status(200).json({
    success: true,
    message: 'Time slot deleted successfully'
  });
});

/**
 * @desc    Get a specific time slot by ID with formatted date
 * @route   GET /api/availability/timeslot/:id
 * @access  Private
 */
export const getTimeSlotById = asyncHandler(async (req, res, next) => {
  const slotId = req.params.id;
  
  if (!slotId || !mongoose.Types.ObjectId.isValid(slotId)) {
    return next(new AppError('Invalid time slot ID format', 400));
  }
  
  try {
    // Use the new service method that formats the date
    const timeSlot = await availabilityService.getTimeSlotWithFormattedDate(slotId);
    
    if (!timeSlot) {
      return next(new AppError('Time slot not found', 404));
    }
    
    res.status(200).json({
      success: true,
      data: timeSlot
    });
  } catch (error) {
    console.error('Get time slot by ID error:', error);
    return next(new AppError(`Failed to retrieve time slot: ${error.message}`, 500));
  }
});

/**
 * @desc    Generate time slots from doctor's schedule
 * @route   POST /api/availability/doctor/:doctorId/generate
 * @access  Private (Admin, Doctor or Staff)
 */
export const generateTimeSlots = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  const { startDate, endDate } = req.body;
  
  // Parse dates if provided
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  // Validate date format
  if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
    return next(new AppError('Invalid date format', 400));
  }
  
  // Modified permission check
  let canGenerateSlots = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canGenerateSlots = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canGenerateSlots = true;
    }
  }
  
  if (!canGenerateSlots) {
    return next(new AppError('You are not authorized to generate time slots for this doctor', 403));
  }
  
  const timeSlots = await availabilityService.generateTimeSlotsFromSchedule(
    doctorId, 
    start, 
    end, 
    req.user._id
  );
  
  res.status(201).json({
    success: true,
    count: timeSlots.length,
    data: timeSlots
  });
});

/**
 * @desc    Import time slots from Google Calendar
 * @route   POST /api/availability/doctor/:doctorId/import/google
 * @access  Private (Admin, Doctor or Staff)
 */
export const importFromGoogle = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  const { refreshToken, startDate, endDate } = req.body;
  
  // Validate refresh token
  if (!refreshToken) {
    return next(new AppError('Google Calendar refresh token is required', 400));
  }
  
  // Parse dates if provided
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  // Validate date format
  if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
    return next(new AppError('Invalid date format', 400));
  }
  
  // Modified permission check
  let canImportSlots = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canImportSlots = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canImportSlots = true;
    }
  }
  
  if (!canImportSlots) {
    return next(new AppError('You are not authorized to import time slots for this doctor', 403));
  }
  
  const importResults = await availabilityService.importFromGoogleCalendar(
    doctorId, 
    refreshToken, 
    start, 
    end, 
    req.user._id
  );
  
  res.status(200).json({
    success: true,
    data: importResults
  });
});

/**
 * @desc    Export time slots to Google Calendar
 * @route   POST /api/availability/doctor/:doctorId/export/google
 * @access  Private (Admin, Doctor or Staff)
 */
export const exportToGoogle = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  const { refreshToken, startDate, endDate } = req.body;
  
  // Validate refresh token
  if (!refreshToken) {
    return next(new AppError('Google Calendar refresh token is required', 400));
  }
  
  // Parse dates if provided
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  // Validate date format
  if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
    return next(new AppError('Invalid date format', 400));
  }
  
  // Modified permission check
  let canExportSlots = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canExportSlots = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canExportSlots = true;
    }
  }
  
  if (!canExportSlots) {
    return next(new AppError('You are not authorized to export time slots for this doctor', 403));
  }
  
  const exportResults = await availabilityService.exportToGoogleCalendar(
    doctorId, 
    refreshToken, 
    start, 
    end, 
    req.user._id
  );
  
  res.status(200).json({
    success: true,
    data: exportResults
  });
});

/**
 * @desc    Sync time slots with Google Calendar
 * @route   POST /api/availability/doctor/:doctorId/sync/google
 * @access  Private (Admin, Doctor or Staff)
 */
export const syncWithGoogle = asyncHandler(async (req, res, next) => {
  const doctorId = req.params.doctorId;
  const { refreshToken, startDate, endDate } = req.body;
  
  // Validate refresh token
  if (!refreshToken) {
    return next(new AppError('Google Calendar refresh token is required', 400));
  }
  
  // Parse dates if provided
  const start = startDate ? new Date(startDate) : null;
  const end = endDate ? new Date(endDate) : null;
  
  // Validate date format
  if ((startDate && isNaN(start.getTime())) || (endDate && isNaN(end.getTime()))) {
    return next(new AppError('Invalid date format', 400));
  }
  
  // Modified permission check
  let canSyncSlots = false;
  
  if (req.userRole === 'admin' || req.userRole === 'staff') {
    canSyncSlots = true;
  } else if (req.userRole === 'doctor') {
    // Fetch the doctor to check if this user is the owner
    const { Doctor } = await import('../models/index.mjs');
    const doctor = await Doctor.findById(doctorId);
    
    if (doctor && doctor.userId.toString() === req.user._id.toString()) {
      canSyncSlots = true;
    }
  }
  
  if (!canSyncSlots) {
    return next(new AppError('You are not authorized to sync time slots for this doctor', 403));
  }
  
  const syncResults = await availabilityService.syncWithGoogleCalendar(
    doctorId, 
    refreshToken, 
    start, 
    end, 
    req.user._id
  );
  
  res.status(200).json({
    success: true,
    data: syncResults
  });
});

// Validation middleware
export const createTimeSlotValidation = [
  check('doctorId', 'Doctor ID is required').not().isEmpty(),
  check('date', 'Valid date is required').isISO8601().toDate(),
  check('startTime', 'Start time is required in format HH:MM').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  check('endTime', 'End time is required in format HH:MM').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  check('status', 'Status must be available, booked, or blocked')
    .optional()
    .isIn(['available', 'booked', 'blocked'])
];

export const updateTimeSlotValidation = [
  check('date', 'Valid date is required').optional().isISO8601().toDate(),
  check('startTime', 'Start time must be in format HH:MM').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  check('endTime', 'End time must be in format HH:MM').optional().matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
  check('status', 'Status must be available, booked, or blocked')
    .optional()
    .isIn(['available', 'booked', 'blocked'])
];

// Export all functions
export default {
  getTimeSlots,
  getAvailableTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getTimeSlotById,
  generateTimeSlots,
  importFromGoogle,
  exportToGoogle,
  syncWithGoogle,
  createTimeSlotValidation,
  updateTimeSlotValidation
};