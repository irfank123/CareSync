// src/controllers/clinicAuthController.mjs

import { check, validationResult } from 'express-validator';
import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { formatValidationErrors } from '../utils/errorHandler.mjs';
import loadAndValidateConfig from '../config/config.mjs'; // Import the config loader function

// Load the config
const config = loadAndValidateConfig();

/**
 * @desc    Register new clinic
 * @route   POST /api/auth/clinic/register
 * @access  Public
 */
const registerClinic = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { clinic, user, token } = await clinicAuthService.registerClinic(req.body);
    
    // Set cookie and send response
    const options = {
      expires: new Date(Date.now() + process.env.JWT_COOKIE_EXPIRE * 24 * 60 * 60 * 1000),
      httpOnly: true
    };
    
    if (process.env.NODE_ENV === 'production') {
      options.secure = true;
    }
    
    res.status(201)
      .cookie('token', token, options)
      .json({
        success: true,
        clinic,
        user,
        token
      });
      
  } catch (error) {
    console.error('Clinic registration error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Registration failed'
    });
  }
};

/**
 * @desc    Login clinic admin
 * @route   POST /api/auth/clinic/login
 * @access  Public
 */
const loginClinic = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, password } = req.body;
    
    const { clinic, user, token } = await clinicAuthService.loginClinic(email, password);
    
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
        clinic,
        user,
        token
      });
      
  } catch (error) {
    console.error('Clinic login error:', error);
    res.status(401).json({
      success: false,
      message: error.message || 'Authentication failed'
    });
  }
};

/**
 * @desc    Verify clinic email
 * @route   POST /api/auth/clinic/verify-email
 * @access  Public
 */
const verifyClinicEmail = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    const { email, code } = req.body;
    
    const verified = await clinicAuthService.verifyClinicEmail(email, code);
    
    res.status(200).json({
      success: true,
      verified
    });
  } catch (error) {
    console.error('Clinic verification error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Verification failed'
    });
  }
};

/**
 * @desc    Submit clinic verification documents
 * @route   POST /api/auth/clinic/submit-verification
 * @access  Private (Clinic)
 */
const submitVerification = async (req, res, next, { clinicAuthService }) => {
  try {
    if (req.userType !== 'clinic') {
      return res.status(403).json({
        success: false,
        message: 'Only clinics can submit verification documents'
      });
    }
    
    const { documents } = req.body;
    
    if (!documents || !Array.isArray(documents) || documents.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Please provide verification documents'
      });
    }
    
    const clinic = await clinicAuthService.startVerificationProcess(
      req.clinic._id,
      documents
    );
    
    res.status(200).json({
      success: true,
      clinic
    });
  } catch (error) {
    console.error('Verification submission error:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Could not submit verification documents' 
    });
  }
};

/**
 * @desc    Get clinic details
 * @route   GET /api/auth/clinic/me
 * @access  Private (Clinic)
 */
const getClinicProfile = async (req, res, next, { clinicAuthService }) => {
  try {
    // Use req.clinic directly (it might be null if not found/linked)
    const clinicData = req.clinic ? clinicAuthService.sanitizeClinicData(req.clinic) : null;
    const userData = req.user ? clinicAuthService.sanitizeUserData(req.user) : null;

    if (!userData) {
       // Should be caught by authenticate middleware, but belts and braces
       return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    res.status(200).json({ 
      success: true, 
      clinic: clinicData, // Send clinic data or null
      user: userData,
      userType: req.userType || 'user' // Use userType set during authentication
    });
  } catch (error) {
    console.error('Get clinic profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clinic profile'
    });
  }
};

/**
 * @desc    Forgot password for clinic
 * @route   POST /api/auth/clinic/forgot-password
 * @access  Public
 */
const forgotPassword = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { email } = req.body;
    
    await clinicAuthService.forgotPassword(email);
    
    // Always return success even if clinic not found to prevent email enumeration
    res.status(200).json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent'
    });
  } catch (error) {
    console.error('Clinic forgot password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while processing forgot password request'
    });
  }
};

/**
 * @desc    Reset password for clinic
 * @route   PUT /api/auth/clinic/reset-password/:resetToken
 * @access  Public
 */
const resetPasswordClinic = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const result = await clinicAuthService.resetPassword(req.params.resetToken, req.body.password);
    
    if (result) {
      res.status(200).json({
        success: true,
        message: 'Password reset successful'
      });
    } else {
      res.status(400).json({
        success: false,
        message: 'Password reset failed'
      });
    }
  } catch (error) {
    console.error('Clinic reset password error:', error);
    res.status(400).json({
      success: false,
      message: error.message || 'Password reset failed'
    });
  }
};

/**
 * @desc    Update password for clinic
 * @route   POST /api/auth/clinic/update-password
 * @access  Private (Clinic)
 */
const updatePasswordClinic = async (req, res, next, { clinicAuthService }) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }

    if (req.userType !== 'clinic') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }

    const clinic = await Clinic.findById(req.clinic._id).select('+passwordHash');
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Check current password
    const isMatch = await clinic.matchPassword(req.body.currentPassword);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }
    
    // Set new password
    clinic.passwordHash = req.body.newPassword;
    await clinic.save();
    
    res.status(200).json({
      success: true,
      message: 'Password updated successfully'
    });
  } catch (error) {
    console.error('Clinic update password error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while updating password'
    });
  }
};

/**
 * @desc    Refresh JWT token for clinic
 * @route   POST /api/auth/clinic/refresh-token
 * @access  Private (Clinic)
 */
const refreshTokenClinic = async (req, res, next, { clinicAuthService }) => {
  try {
    if (req.userType !== 'clinic') {
      return res.status(403).json({
        success: false,
        message: 'Not authorized'
      });
    }
    
    const token = req.clinic.getSignedJwtToken();
    
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
    console.error('Clinic token refresh error:', error);
    res.status(500).json({
      success: false,
      message: 'Could not refresh token'
    });
  }
};

/**
 * @desc    Initiate Auth0 login/signup flow for clinic users
 * @route   GET /api/auth/clinic/auth0/login
 * @access  Public
 */
const initiateClinicAuth0Login = async (req, res, next, { clinicAuth0Service }) => {
  try {
    const authorizationUrl = clinicAuth0Service.getAuthorizationUrl();
    res.redirect(authorizationUrl);
  } catch (error) {
    console.error('Auth0 login initiation error:', error);
    // Redirect to a frontend error page or show a generic error
    // For now, send a 500 status
    res.status(500).json({ success: false, message: error.message || 'Server error initiating Auth0 login' });
  }
};

/**
 * @desc    Handle callback from Auth0 after authentication
 * @route   GET /api/auth/clinic/auth0/callback
 * @access  Public
 */
const handleClinicAuth0Callback = async (req, res, next, { clinicAuth0Service }) => {
  console.log('[DEBUG] Entering handleClinicAuth0Callback controller');
  const { code, error, error_description, state } = req.query;

  // Log the full URL to help debug redirect and callback issues
  const fullUrl = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  console.log('[DEBUG] Full callback URL:', fullUrl);

  console.log('Auth0 callback received:', {
    hasCode: !!code,
    codeLength: code?.length || 0,
    hasState: !!state,
    error: error || 'none',
    path: req.path,
    originalUrl: req.originalUrl,
    headers: {
      host: req.headers.host,
      referer: req.headers.referer
    }
  });

  if (error) {
    console.error('Auth0 callback error:', error, error_description);
    // Redirect to a frontend error page with error info
    return res.redirect(`${config.frontendUrl}/auth/error?message=${encodeURIComponent(error_description || error)}`);
  }

  if (!code) {
    console.error('Auth0 callback missing authorization code');
    return res.redirect(`${config.frontendUrl}/auth/error?message=${encodeURIComponent('Authorization code missing')}`);
  }

  try {
    console.log('Processing Auth0 callback with code:', code.substring(0, 5) + '...');
    
    // Pass the full request URL as a potential redirectUri backup
    const { user, clinic, token } = await clinicAuth0Service.handleCallback(code, fullUrl);
    console.log('[DEBUG] Successfully processed handleCallback service call');
    
    if (!token) {
      console.error('No token generated after Auth0 callback processing');
      return res.redirect(`${config.frontendUrl}/auth/error?message=${encodeURIComponent('Authentication failed - no token')}`);
    }
    
    console.log('Auth0 authentication successful:', {
      userId: user._id,
      userEmail: user.email,
      hasClinic: !!clinic,
      tokenSet: !!token
    });
    
    // Set cookie with the local JWT token with client-accessible settings
    const cookieOptions = {
      expires: new Date(Date.now() + config.jwt.cookieOptions.maxAge),
      httpOnly: false, // Make accessible to JavaScript
      secure: false, // Set to true in production with HTTPS
      sameSite: 'lax', // Less restrictive SameSite setting
      path: '/', // Ensure cookie is available across the whole site
    };

    // Set the cookie with updated options
    res.cookie('token', token, cookieOptions);
    
    // Also set a debug cookie to verify cookie setting is working
    res.cookie('auth_debug', 'token_set_' + Date.now(), { 
      httpOnly: false,
      path: '/'
    });
    
    console.log('Auth0 authentication successful, cookies set, redirecting to dashboard');
    
    // Create a more explicit success URL with timestamp and user info
    const successRedirectUrl = `${config.frontendUrl}/clinic-dashboard?auth=success&ts=${Date.now()}&user=${encodeURIComponent(user.email)}`;
    console.log(`[DEBUG] Attempting redirect to: ${successRedirectUrl}`);
    
    // Redirect to the frontend dashboard with success param
    res.redirect(successRedirectUrl);
    console.log('[DEBUG] res.redirect called.'); // Log after calling redirect
    
  } catch (error) {
    console.error('Auth0 callback processing error:', error);
    console.log('[DEBUG] Caught error during callback processing, redirecting to error page.');
    
    // Check if this is a special error about code reuse
    if (error.message && error.message.includes('Code reuse detected')) {
      console.log('[DEBUG] Code reuse detected - this may be a refresh or back-button navigation');
      
      // Redirect to success path since the user might already be authenticated
      // but add a query param to indicate this was a reused code
      return res.redirect(`${config.frontendUrl}/clinic-dashboard?auth=code_reuse`);
    }
    
    // Redirect to a frontend error page with detailed error
    const errorMessage = error.message || 'Login failed';
    console.error('Redirecting to error page with message:', errorMessage);
    res.redirect(`${config.frontendUrl}/auth/error?message=${encodeURIComponent(errorMessage)}`);
  }
};

// Controller methods object
const clinicAuthController = {
  registerClinic,
  loginClinic,
  verifyClinicEmail,
  submitVerification,
  getClinicProfile,
  forgotPassword,
  resetPasswordClinic,
  updatePasswordClinic,
  refreshTokenClinic,
  initiateClinicAuth0Login,
  handleClinicAuth0Callback
};

// Service dependencies for each method
const dependencies = {
  registerClinic: ['clinicAuthService'],
  loginClinic: ['clinicAuthService'],
  verifyClinicEmail: ['clinicAuthService'],
  submitVerification: ['clinicAuthService'],
  getClinicProfile: ['clinicAuthService'],
  forgotPassword: ['clinicAuthService'],
  resetPasswordClinic: ['clinicAuthService'],
  updatePasswordClinic: ['clinicAuthService'],
  refreshTokenClinic: ['clinicAuthService'],
  initiateClinicAuth0Login: ['clinicAuth0Service'],
  handleClinicAuth0Callback: ['clinicAuth0Service'] // Assumes clinicAuth0Service handles user/clinic finding
};

// Apply DI to the controller
const enhancedController = withServicesForController(clinicAuthController, dependencies);

// Export validation rules for use in routes
export const registerClinicValidation = [
  check('name', 'Clinic name is required').not().isEmpty().trim(),
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
  check('phoneNumber', 'Valid phone number is required').not().isEmpty().isMobilePhone(),
  check('adminFirstName', 'Admin first name is required').not().isEmpty().trim(),
  check('adminLastName', 'Admin last name is required').not().isEmpty().trim(),
  check('address.street', 'Street address is required').optional().not().isEmpty(),
  check('address.city', 'City is required').optional().not().isEmpty(),
  check('address.state', 'State is required').optional().not().isEmpty(),
  check('address.zipCode', 'ZIP code is required').optional().not().isEmpty(),
  check('address.country', 'Country is required').optional().not().isEmpty()
];

export const loginClinicValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('password', 'Password is required').exists()
];

export const verifyEmailValidation = [
  check('email', 'Please include a valid email').isEmail(),
  check('code', 'Verification code is required').not().isEmpty()
];

export const forgotPasswordClinicValidation = [
  check('email', 'Please include a valid email').isEmail()
];

export const resetPasswordClinicValidation = [
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

export const updatePasswordClinicValidation = [
  check('currentPassword', 'Current password is required').exists(),
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

// Export individual methods with DI
export const {
  registerClinic: registerClinicWithDI,
  loginClinic: loginClinicWithDI,
  verifyClinicEmail: verifyClinicEmailWithDI,
  submitVerification: submitVerificationWithDI,
  getClinicProfile: getClinicProfileWithDI,
  forgotPassword: forgotPasswordWithDI,
  resetPasswordClinic: resetPasswordClinicWithDI,
  updatePasswordClinic: updatePasswordClinicWithDI,
  refreshTokenClinic: refreshTokenClinicWithDI,
  initiateClinicAuth0Login: initiateClinicAuth0LoginWithDI,
  handleClinicAuth0Callback: handleClinicAuth0CallbackWithDI
} = enhancedController;

// Default export for compatibility
export default {
  registerClinic: registerClinicWithDI,
  loginClinic: loginClinicWithDI,
  verifyClinicEmail: verifyClinicEmailWithDI,
  submitVerification: submitVerificationWithDI,
  getClinicProfile: getClinicProfileWithDI,
  forgotPassword: forgotPasswordWithDI,
  resetPasswordClinic: resetPasswordClinicWithDI,
  updatePasswordClinic: updatePasswordClinicWithDI,
  refreshTokenClinic: refreshTokenClinicWithDI,
  initiateClinicAuth0Login: initiateClinicAuth0LoginWithDI,
  handleClinicAuth0Callback: handleClinicAuth0CallbackWithDI,
  registerClinicValidation,
  loginClinicValidation,
  verifyEmailValidation,
  forgotPasswordClinicValidation,
  resetPasswordClinicValidation,
  updatePasswordClinicValidation
};