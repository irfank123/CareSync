// src/middleware/validation/validationMiddleware.mjs

import { check, validationResult } from 'express-validator';
import { formatValidationErrors } from '../../utils/errorHandler.mjs';

/**
 * Centralized validation middleware for common patterns in the application
 */
const validationMiddleware = {
  /**
   * Apply validation rules and handle validation errors
   * @param {Array} validations - Array of validation rules from express-validator
   * @returns {Function} Middleware function
   */
  validate: (validations) => {
    return async (req, res, next) => {
      // Apply all validation rules
      await Promise.all(validations.map(validation => validation.run(req)));
      
      // Check for validation errors
      const errors = validationResult(req);
      if (errors.isEmpty()) {
        return next();
      }
      
      // Return validation errors
      return res.status(400).json(formatValidationErrors(errors.array()));
    };
  },
  
  /**
   * Common validation rules for reuse across the application
   */
  rules: {
    // User related validations
    user: {
      firstName: check('firstName', 'First name is required').not().isEmpty().trim(),
      lastName: check('lastName', 'Last name is required').not().isEmpty().trim(),
      email: check('email', 'Please include a valid email').isEmail().normalizeEmail(),
      password: check('password')
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
      phoneNumber: check('phoneNumber', 'Valid phone number is required').not().isEmpty(),
      role: check('role', 'Role must be patient, doctor, staff or admin').isIn(['patient', 'doctor', 'staff', 'admin']),
    },
    
    // Patient related validations
    patient: {
      dateOfBirth: check('dateOfBirth', 'Valid date of birth is required').isISO8601().toDate(),
      gender: check('gender', 'Gender must be male, female, or other').isIn(['male', 'female', 'other']),
    },
    
    // Doctor related validations
    doctor: {
      specialties: check('specialties', 'At least one specialty is required').isArray().notEmpty(),
      licenseNumber: check('licenseNumber', 'License number is required').not().isEmpty(),
      appointmentFee: check('appointmentFee', 'Appointment fee must be a number').isNumeric(),
    },
    
    // Staff related validations
    staff: {
      position: check('position', 'Position must be one of receptionist, nurse, administrator, or other')
        .isIn(['receptionist', 'nurse', 'administrator', 'other']),
      department: check('department', 'Department is required').not().isEmpty(),
    },
    
    // Appointment related validations
    appointment: {
      patientId: check('patientId', 'Patient ID is required').not().isEmpty(),
      doctorId: check('doctorId', 'Doctor ID is required').not().isEmpty(),
      timeSlotId: check('timeSlotId', 'Time slot ID is required').not().isEmpty(),
      reasonForVisit: check('reasonForVisit', 'Reason for visit is required').not().isEmpty(),
      type: check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
        .optional()
        .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
      status: check('status', 'Status must be one of: scheduled, checked-in, in-progress, completed, cancelled, no-show')
        .optional()
        .isIn(['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show']),
    },
    
    // Time slot related validations
    timeSlot: {
      date: check('date', 'Valid date is required').isISO8601().toDate(),
      startTime: check('startTime', 'Start time is required in format HH:MM').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
      endTime: check('endTime', 'End time is required in format HH:MM').matches(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/),
    },
    
    // Common ID parameter validation
    id: check('id', 'Invalid ID format').isMongoId(),
    
    // Parameter validation factory
    param: (paramName, message) => check(paramName, message || `Invalid ${paramName}`).isMongoId()
  },
  
  /**
   * Predefined validation chains for common operations
   */
  chains: {
    // User registration validation
    registerUser: [
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
      check('role', 'Role must be patient, doctor or staff').isIn(['patient', 'doctor', 'staff']),
      check('phoneNumber', 'Valid phone number is required').not().isEmpty()
    ],
    
    // Create patient validation
    createPatient: [
      check('userId', 'User ID is required').not().isEmpty(),
      check('dateOfBirth', 'Valid date of birth is required').isISO8601().toDate(),
      check('gender', 'Gender must be male, female, or other').isIn(['male', 'female', 'other']),
    ],
    
    // Create doctor validation
    createDoctor: [
      check('userId', 'User ID is required').not().isEmpty(),
      check('specialties', 'At least one specialty is required').isArray().notEmpty(),
      check('licenseNumber', 'License number is required').not().isEmpty(),
      check('appointmentFee', 'Appointment fee must be a number').isNumeric(),
    ],
    
    // Create appointment validation
    createAppointment: [
      check('patientId', 'Patient ID is required').not().isEmpty(),
      check('doctorId', 'Doctor ID is required').not().isEmpty(),
      check('timeSlotId', 'Time slot ID is required').not().isEmpty(),
      check('reasonForVisit', 'Reason for visit is required').not().isEmpty(),
      check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
        .optional()
        .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
    ],
    
    // Login validation
    login: [
      check('email', 'Please include a valid email').isEmail().normalizeEmail(),
      check('password', 'Password is required').notEmpty()
    ],
  }
};

export default validationMiddleware;