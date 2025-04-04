// src/controllers/authController.mjs

import jwt from 'jsonwebtoken';
import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { AppError, formatValidationErrors } from '../utils/errorHandler.mjs';
import config from '../config/config.mjs';
import { AuditLog } from '../models/index.mjs';

/**
 * @desc    Register new user
 * @route   POST /api/auth/register
 * @access  Public
 */
const register = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { user, roleSpecificRecord, token } = await authService.registerUser(
    req.body,
    req.body.role
  );

  // Send response with cookie
  sendTokenResponse(user, 201, res, token);
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { email, password } = req.body;
  
  const result = await authService.loginUser(email, password);
  
  // If MFA is required, return partial response
  if (result.requiresMfa) {
    return res.status(200).json({
      success: true,
      requiresMfa: true,
      user: result.user
    });
  }
  
  // Send response with cookie
  sendTokenResponse(result.user, 200, res, result.token, result.roleData);
};

/**
 * @desc    Verify MFA code
 * @route   POST /api/auth/verify-mfa
 * @access  Public
 */
const verifyMfa = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { email, mfaCode } = req.body;
  
  const result = await authService.verifyMfa(email, mfaCode);
  
  // Send response with cookie
  sendTokenResponse(result.user, 200, res, result.token, result.roleData);
};

/**
 * @desc    Handle Auth0 callback
 * @route   POST /api/auth/auth0/callback
 * @access  Public
 */
const auth0Callback = async (req, res, next, { authService }) => {
  const { userType } = req.body;
  
  if (userType !== 'patient' && userType !== 'doctor') {
    throw new AppError('Invalid user type. Must be patient or doctor.', 400);
  }
  
  const { user, token } = await authService.handleAuth0Login(
    req.auth0User,
    userType
  );
  
  // Send response with cookie
  sendTokenResponse(user, 200, res, token);
};

/**
 * @desc    Logout user
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res, next, { tokenBlacklistService }) => {
  try {
    // Get token from cookies or authorization header
    const token = req.cookies.token || 
      (req.headers.authorization && req.headers.authorization.startsWith('Bearer ') 
        ? req.headers.authorization.split(' ')[1] 
        : null);
    
    // If token exists, add it to blacklist
    if (token) {
      // Extract the expiry time from the token
      const decodedToken = jwt.decode(token);
      const tokenExpiry = decodedToken && decodedToken.exp 
        ? new Date(decodedToken.exp * 1000) 
        : new Date(Date.now() + 24 * 60 * 60 * 1000); // Default to 24h
        
      await tokenBlacklistService.addToBlacklist(
        token, 
        req.user._id, 
        tokenExpiry
      );
      
      // Create audit log
      await AuditLog.create({
        userId: req.user._id,
        action: 'logout',
        resource: 'user',
        details: {
          ip: req.ip,
          userAgent: req.headers['user-agent']
        }
      });
    }
    
    // Clear the cookie regardless
    res.cookie('token', 'none', {
      expires: new Date(Date.now() + 10 * 1000), // 10 seconds
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    // Still return success to client even if blacklisting failed
    res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res, next, { authService }) => {
  const { user, roleData } = await authService.getUserProfile(req.user._id);
  
  res.status(200).json({
    success: true,
    user,
    roleData,
    role: user.role
  });
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { email } = req.body;
  
  await authService.forgotPassword(email);
  
  res.status(200).json({
    success: true,
    message: 'If an account with that email exists, a password reset link has been sent'
  });
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:resetToken
 * @access  Public
 */
const resetPassword = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { password } = req.body;
  const { resetToken } = req.params;
  
  const { user, token } = await authService.resetPassword(resetToken, password);
  
  // Send response with cookie
  sendTokenResponse(user, 200, res, token);
};

/**
 * @desc    Update password for logged in user
 * @route   POST /api/auth/update-password
 * @access  Private
 */
const updatePassword = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { currentPassword, newPassword } = req.body;
  
  await authService.updatePassword(req.user._id, currentPassword, newPassword);
  
  res.status(200).json({
    success: true,
    message: 'Password updated successfully'
  });
};

/**
 * @desc    Toggle MFA
 * @route   POST /api/auth/toggle-mfa
 * @access  Private
 */
const toggleMfa = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { enable, method } = req.body;
  
  const { user } = await authService.toggleMfa(req.user._id, enable, method);
  
  res.status(200).json({
    success: true,
    message: enable ? 'MFA enabled successfully' : 'MFA disabled successfully',
    user
  });
};

/**
 * @desc    Refresh token
 * @route   POST /api/auth/refresh-token
 * @access  Private
 */
const refreshToken = async (req, res, next, { authService }) => {
  let options = {};
  
  if (req.user.clinicId) {
    options.clinicId = req.user.clinicId;
  }
  
  const token = authService.refreshToken(req.user._id, req.user.role, options);
  
  // Send response with cookie
  sendCookieToken(token, 200, res);
  
  res.status(200).json({
    success: true,
    token
  });
};

/**
 * @desc    Verify email
 * @route   POST /api/auth/verify-email
 * @access  Public
 */
const verifyEmail = async (req, res, next, { authService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }

  const { email, code } = req.body;
  
  await authService.verifyEmail(email, code);
  
  res.status(200).json({
    success: true,
    message: 'Email verified successfully'
  });
};

/**
 * Helper function to send token response with cookie
 * @param {Object} user - User object
 * @param {Number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 * @param {String} token - JWT token
 * @param {Object} roleData - Role-specific data
 */
const sendTokenResponse = (user, statusCode, res, token, roleData = null) => {
  // Set cookie
  sendCookieToken(token, statusCode, res);
  
  // Send response
  res.status(statusCode).json({
    success: true,
    token,
    user,
    roleData
  });
};

/**
 * Helper function to set cookie with token
 * @param {String} token - JWT token
 * @param {Number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 */
const sendCookieToken = (token, statusCode, res) => {
  const cookieOptions = {
    expires: new Date(Date.now() + config.jwt.cookieOptions.maxAge),
    httpOnly: true,
    secure: config.jwt.cookieOptions.secure,
    sameSite: 'strict'
  };
  
  res.cookie('token', token, cookieOptions);
};

// Controller methods object
const authController = {
  register,
  login,
  verifyMfa,
  auth0Callback,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  toggleMfa,
  refreshToken,
  verifyEmail
};

// Service dependencies for each method
const dependencies = {
  register: ['authService'],
  login: ['authService'],
  verifyMfa: ['authService'],
  auth0Callback: ['authService'],
  logout: ['tokenBlacklistService'],
  getMe: ['authService'],
  forgotPassword: ['authService'],
  resetPassword: ['authService'],
  updatePassword: ['authService'],
  toggleMfa: ['authService'],
  refreshToken: ['authService'],
  verifyEmail: ['authService']
};

// Apply DI to the controller
const enhancedController = withServicesForController(authController, dependencies);

// Validation rules
const registerValidation = [
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
  check('phoneNumber', 'Valid phone number is required').not().isEmpty().isMobilePhone()
];

const loginValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('password', 'Password is required').notEmpty()
];

const mfaValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('mfaCode', 'Please provide a valid 6-digit code').isLength({ min: 6, max: 6 }).isNumeric()
];

const forgotPasswordValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
];

const resetPasswordValidation = [
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
    .withMessage('Password must contain a special character')
];

const updatePasswordValidation = [
  check('currentPassword', 'Current password is required').notEmpty(),
  check('newPassword')
    .isLength({ min: 8 })
    .withMessage('New password must be at least 8 characters')
    .matches(/\d/)
    .withMessage('New password must contain a number')
    .matches(/[A-Z]/)
    .withMessage('New password must contain an uppercase letter')
    .matches(/[a-z]/)
    .withMessage('New password must contain a lowercase letter')
    .matches(/[!@#$%^&*(),.?":{}|<>]/)
    .withMessage('New password must contain a special character')
];

const toggleMfaValidation = [
  check('enable', 'Enable flag must be a boolean').isBoolean(),
  check('method', 'Method must be app or sms').optional().isIn(['app', 'sms'])
];

const verifyEmailValidation = [
  check('email', 'Please include a valid email').isEmail().normalizeEmail(),
  check('code', 'Please provide a valid verification code').isLength({ min: 6, max: 6 }).isNumeric()
];

// Export all methods with DI
export const {
  register: registerWithDI,
  login: loginWithDI,
  verifyMfa: verifyMfaWithDI,
  auth0Callback: auth0CallbackWithDI,
  logout: logoutWithDI,
  getMe: getMeWithDI,
  forgotPassword: forgotPasswordWithDI,
  resetPassword: resetPasswordWithDI,
  updatePassword: updatePasswordWithDI,
  toggleMfa: toggleMfaWithDI,
  refreshToken: refreshTokenWithDI,
  verifyEmail: verifyEmailWithDI
} = enhancedController;

// Export validation rules
export {
  registerValidation,
  loginValidation,
  mfaValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updatePasswordValidation,
  toggleMfaValidation,
  verifyEmailValidation
};

// Default export for compatibility
export default {
  register: registerWithDI,
  login: loginWithDI,
  verifyMfa: verifyMfaWithDI,
  auth0Callback: auth0CallbackWithDI,
  logout: logoutWithDI,
  getMe: getMeWithDI,
  forgotPassword: forgotPasswordWithDI,
  resetPassword: resetPasswordWithDI,
  updatePassword: updatePasswordWithDI,
  toggleMfa: toggleMfaWithDI,
  refreshToken: refreshTokenWithDI,
  verifyEmail: verifyEmailWithDI,
  registerValidation,
  loginValidation,
  mfaValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updatePasswordValidation,
  toggleMfaValidation,
  verifyEmailValidation
};