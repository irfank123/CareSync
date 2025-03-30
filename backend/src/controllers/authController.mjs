// src/controllers/authController.mjs

import { User, Patient, Doctor, Staff } from '../models/index.mjs';
import { check, validationResult } from 'express-validator';
import authService from '../services/authService.mjs';
import emailService from '../services/emailService.mjs';
import crypto from 'crypto';

/**
 * @desc    Register new user (non-clinic)
 * @route   POST /api/auth/register
 * @access  Public
 */
export const register = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { firstName, lastName, email, password, role, phoneNumber } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create user
    const user = new User({
      firstName,
      lastName,
      email,
      passwordHash: password, // Will be hashed by the pre-save hook
      role,
      phoneNumber,
      isActive: true
    });

    await user.save();

    // Create role-specific records
    if (role === 'patient') {
      // Create Patient record with basic info
      // You would need to complete profile later
      await Patient.create({
        userId: user._id,
        dateOfBirth: req.body.dateOfBirth || new Date(),
        gender: req.body.gender || 'other'
      });
    } else if (role === 'doctor') {
      // Create Doctor record with basic info
      // You would need to complete profile later
      await Doctor.create({
        userId: user._id,
        specialties: req.body.specialties || [],
        licenseNumber: req.body.licenseNumber || 'TO_BE_VERIFIED',
        appointmentFee: req.body.appointmentFee || 0
      });
    } else if (role === 'staff') {
      // Create Staff record
      await Staff.create({
        userId: user._id,
        position: req.body.position || 'other',
        department: req.body.department || 'General'
      });
    }

    // Try to send welcome email
    try {
      await emailService.sendWelcomeEmail(user.email, user.firstName, user.role);
    } catch (emailError) {
      console.error('Welcome email error:', emailError);
      // Continue registration even if email fails
    }

    // Generate token and send response
    sendTokenResponse(user, 201, res);
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during registration'
    });
  }
};

/**
 * @desc    Login user and return token
 * @route   POST /api/auth/login
 * @access  Public
 */
export const login = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;

    // Find user by email
    const user = await User.findOne({ email }).select('+passwordHash');

    // Check if user exists
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Check if password matches
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = Date.now();
    await user.save();

    // Send response with cookie
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login'
    });
  }
};

/**
 * @desc    Handle Auth0 callback
 * @route   POST /api/auth/auth0/callback
 * @access  Public
 */
export const auth0Callback = async (req, res) => {
  try {
    const { userType } = req.body;
    
    if (userType !== 'patient' && userType !== 'doctor') {
      return res.status(400).json({
        success: false,
        message: 'Invalid user type. Must be patient or doctor.'
      });
    }
    
    // Process Auth0 login and create/update user
    const { user, token } = await authService.handleAuth0Login(
      req.auth0User,
      userType
    );
    
    // Send response
    res.status(200).json({
      success: true,
      user,
      token
    });
  } catch (error) {
    console.error('Auth0 callback error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

/**
 * @desc    Logout user and clear cookie
 * @route   POST /api/auth/logout
 * @access  Private
 */
export const logout = (req, res) => {
  res.cookie('token', 'none', {
    expires: new Date(Date.now() + 10 * 1000), // Expires in 10 seconds
    httpOnly: true
  });
  
  res.status(200).json({
    success: true,
    message: 'Logged out successfully'
  });
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
export const getMe = async (req, res) => {
  try {
    // For regular users, get full profile based on role
    let userData = req.user;
    
    if (req.user.role === 'patient') {
      userData = await User.findById(req.user._id).populate('Patient');
    } else if (req.user.role === 'doctor') {
      userData = await User.findById(req.user._id).populate('Doctor');
    } else if (req.user.role === 'staff') {
      userData = await User.findById(req.user._id).populate('Staff');
    }
    
    res.status(200).json({ 
      success: true, 
      user: userData,
      userType: req.user.role
    });
  } catch (error) {
    console.error('Get user profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching user profile'
    });
  }
};

/**
 * @desc    Forgot password
 * @route   POST /api/auth/forgot-password
 * @access  Public
 */
export const forgotPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { email } = req.body;
    
    // Find user by email
    const user = await User.findOne({ email });
    
    if (!user) {
      // Always return success even if user not found to prevent email enumeration
      return res.status(200).json({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    }
    
    // Generate reset token
    const resetToken = user.getResetPasswordToken();
    await user.save({ validateBeforeSave: false });
    
    // Create reset URL
    const resetUrl = `${process.env.FRONTEND_URL}/reset-password/${resetToken}`;
    
    try {
      await emailService.sendPasswordResetEmail(user.email, resetUrl);
      
      res.status(200).json({
        success: true,
        message: 'Password reset link sent'
      });
    } catch (error) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      await user.save({ validateBeforeSave: false });
      
      throw new Error('Email could not be sent');
    }
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing forgot password request'
    });
  }
};

/**
 * @desc    Reset password
 * @route   PUT /api/auth/reset-password/:resetToken
 * @access  Public
 */
export const resetPassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    // Hash the token from params
    const resetPasswordToken = crypto
      .createHash('sha256')
      .update(req.params.resetToken)
      .digest('hex');
    
    // Find user by token
    const user = await User.findOne({
      resetPasswordToken,
      resetPasswordExpire: { $gt: Date.now() }
    });
    
    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
    
    // Set new password
    user.passwordHash = req.body.password; // Will be hashed by pre-save hook
    user.resetPasswordToken = undefined;
    user.resetPasswordExpire = undefined;
    
    await user.save();
    
    // Return token
    sendTokenResponse(user, 200, res);
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while resetting password'
    });
  }
};

/**
 * @desc    Update password for logged in user
 * @route   POST /api/auth/update-password
 * @access  Private
 */
export const updatePassword = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    // For regular users
    const user = await User.findById(req.user._id).select('+passwordHash');
    
    // Check current password
    const isMatch = await user.matchPassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Set new password
    user.passwordHash = req.body.newPassword;
    await user.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password'
    });
  }
};

/**
 * @desc    Refresh JWT token
 * @route   POST /api/auth/refresh-token
 * @access  Private
 */
export const refreshToken = async (req, res) => {
  try {
    // For regular users
    const token = req.user.getSignedJwtToken();
    
    // Set cookie and send response
    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true
    };
    
    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
    }
    
    res.status(200)
      .cookie('token', token, options)
      .json({
        success: true,
        token
      });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not refresh token'
    });
  }
};

/**
 * Helper function to send token response with cookie
 * @param {Object} user - User object
 * @param {Number} statusCode - HTTP status code
 * @param {Object} res - Express response object
 */
const sendTokenResponse = (user, statusCode, res) => {
  // Create token
  const token = user.getSignedJwtToken();

  // Cookie options
  const options = {
    expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
    httpOnly: true
  };

  // Set secure flag in production
  if (process.env.NODE_ENV === 'production') {
    options.secure = true;
  }

  // Remove sensitive data
  user.passwordHash = undefined;

  res.status(statusCode)
    .cookie('token', token, options)
    .json({
      success: true,
      token,
      user
    });
};

// Export validation rules for use in routes
export const registerValidation = [
  check('firstName', 'First name is required').not().isEmpty(),
  check('lastName', 'Last name is required').not().isEmpty(),
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 }),
  check('role', 'Role must be patient, doctor or staff').isIn(['patient', 'doctor', 'staff']),
  check('phoneNumber', 'Phone number is required').not().isEmpty()
];

export const loginValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

export const forgotPasswordValidation = [
  check('email', 'Please include a valid email').isEmail()
];

export const resetPasswordValidation = [
  check('password', 'Password must be at least 6 characters').isLength({ min: 6 })
];

export const updatePasswordValidation = [
  check('currentPassword', 'Current password is required').exists(),
  check('newPassword', 'New password must be at least 6 characters').isLength({ min: 6 })
];