// src/middleware/authMiddleware.mjs

import jwt from 'jsonwebtoken';
import { User, Clinic } from '../../models/index.mjs';
import config from '../../config/config.mjs';
import { AppError } from '../../utils/errorHandler.mjs';
import tokenBlacklistService from '../../services/tokenBlacklistService.mjs';

/**
 * Authentication middleware to protect routes
 */
const authMiddleware = {
  /**
   * Extract token from request
   * @param {Object} req - Express request object
   * @returns {string|null} - JWT token or null
   * @private
   */
  _extractToken(req) {
    // Check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    
    // Then check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  },

  /**
   * Middleware to authenticate users using JWT
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  authenticate: async (req, res, next) => {
    try {
      // Extract token
      const token = authMiddleware._extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required'
        });
      }
      
      // Check if token is blacklisted
      const isBlacklisted = await tokenBlacklistService.isBlacklisted(token);
      if (isBlacklisted) {
        return res.status(401).json({
          success: false,
          message: 'Token has been invalidated. Please log in again'
        });
      }
      
      // Verify token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      // Check token type (user or clinic)
      if (decoded.type === 'clinic') {
        // Handle clinic token
        const clinic = await Clinic.findById(decoded.id);
        
        if (!clinic) {
          return res.status(401).json({ 
            success: false,
            message: 'The clinic associated with this token no longer exists'
          });
        }
        
        // Check if clinic is active
        if (!clinic.isActive) {
          return res.status(401).json({ 
            success: false,
            message: 'Your clinic account has been deactivated'
          });
        }
        
        // Find admin user
        const adminUser = await User.findById(clinic.adminUserId);
        
        // Attach clinic and user to request
        req.clinic = clinic;
        req.user = adminUser;
        req.userType = 'clinic';
        req.userRole = 'admin';
        
        // Add auth context for logging
        req.authContext = {
          clinicId: clinic._id,
          userId: adminUser ? adminUser._id : null,
          tokenIssued: new Date(decoded.iat * 1000),
          tokenExpires: new Date(decoded.exp * 1000)
        };
      } else {
        // Handle regular user token
        const user = await User.findById(decoded.id);
        
        if (!user) {
          return res.status(401).json({ 
            success: false,
            message: 'The user belonging to this token no longer exists'
          });
        }
        
        // Check if user is active
        if (!user.isActive) {
          return res.status(401).json({ 
            success: false,
            message: 'Your account has been deactivated'
          });
        }
        
        // Check if account is locked
        if (user.isAccountLocked && user.isAccountLocked()) {
          return res.status(401).json({ 
            success: false,
            message: 'Your account has been temporarily locked due to too many failed login attempts'
          });
        }
        
        // Check token issued time against password change time (if password was changed)
        if (user.passwordChangedAt && user.changedPasswordAfter(decoded.iat)) {
          return res.status(401).json({ 
            success: false,
            message: 'Password was recently changed. Please log in again'
          });
        }
        
        // Add user to request
        req.user = user;
        req.userRole = user.role;
        req.userType = 'user';
        
        // If this is a clinic admin, add clinic information
        if (user.role === 'admin' && decoded.clinicId) {
          req.isClinicAdmin = true;
          req.clinicId = decoded.clinicId;
          
          // Fetch clinic data
          try {
            const clinic = await Clinic.findById(decoded.clinicId);
            if (clinic) {
              req.clinic = clinic;
            }
          } catch (clinicError) {
            console.error('Error fetching clinic data:', clinicError);
            // Continue authentication even if clinic fetch fails
          }
        }
        
        // Add auth context for logging
        req.authContext = {
          userId: user._id,
          role: user.role,
          tokenIssued: new Date(decoded.iat * 1000),
          tokenExpires: new Date(decoded.exp * 1000)
        };
      }
      
      next();
    } catch (error) {
      if (error.name === 'JsonWebTokenError') {
        return res.status(401).json({ 
          success: false,
          message: 'Invalid token'
        });
      }
      
      if (error.name === 'TokenExpiredError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token has expired'
        });
      }
      
      if (error.name === 'NotBeforeError') {
        return res.status(401).json({ 
          success: false,
          message: 'Token not yet valid'
        });
      }
      
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Authentication error'
      });
    }
  },
  
  /**
   * Alias for restrictTo to make it consistent with usage in routes
   */
  authorize: (...roles) => authMiddleware.restrictTo(...roles),
  
  /**
   * Middleware to restrict routes to specific roles
   * @param  {...string} roles - Roles allowed to access the route
   * @returns {Function} Middleware function
   */
  restrictTo: (...roles) => {
    return (req, res, next) => {
      if (!req.user || !req.userRole) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required'
        });
      }
      
      if (!roles.includes(req.userRole)) {
        return res.status(403).json({ 
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }
      
      next();
    };
  },
  
  /**
   * Middleware to check if user is verified
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  requireVerified: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (!req.user.emailVerified) {
      return res.status(403).json({ 
        success: false,
        message: 'Email verification required. Please verify your email address.'
      });
    }
    
    next();
  },
  
  /**
   * Middleware to check if MFA is completed
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  requireMfaCompleted: (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ 
        success: false,
        message: 'Authentication required'
      });
    }
    
    if (req.user.mfaEnabled && !req.mfaCompleted) {
      return res.status(403).json({ 
        success: false,
        message: 'MFA verification required'
      });
    }
    
    next();
  },
  
  /**
   * Middleware for CSRF protection
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  validateCsrf: (req, res, next) => {
    // Get CSRF token from header
    const csrfToken = req.headers['x-csrf-token'];
    
    // Get CSRF token from cookie
    const csrfCookie = req.cookies.csrfToken;
    
    // For mutating requests (POST, PUT, DELETE) verify CSRF token
    const isNonMutatingMethod = ['GET', 'HEAD', 'OPTIONS'].includes(req.method);
    if (!isNonMutatingMethod && (!csrfToken || !csrfCookie || csrfToken !== csrfCookie)) {
      return res.status(403).json({ 
        success: false,
        message: 'CSRF token validation failed'
      });
    }
    
    next();
  },
  
  /**
   * Middleware to verify Auth0 token
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  
  verifyAuth0Token: async (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required' 
        });
      }
      
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required' 
        });
      }
      
      // In production environment
      if (process.env.NODE_ENV === 'production') {
        // Get Auth0 public key and verify token
        // This is a simplified version - in production, you would use a library like jwks-rsa
        try {
          const decoded = jwt.verify(token, config.auth0.clientSecret, {
            algorithms: ['RS256'],
            audience: config.auth0.audience,
            issuer: `https://${config.auth0.domain}/`
          });
          
          if (!decoded || !decoded.sub) {
            throw new Error('Invalid token structure');
          }
          
          // Attach Auth0 user info to request
          req.auth0User = decoded;
          
          next();
        } catch (tokenError) {
          console.error('Auth0 token verification error:', tokenError);
          return res.status(401).json({ 
            success: false,
            message: 'Invalid authentication token' 
          });
        }
      } else {
        // For development: decode the token but add a warning
        try {
          const decoded = jwt.decode(token);
          if (!decoded || !decoded.sub) {
            throw new Error('Invalid token structure');
          }
          
          console.warn(' DEVELOPMENT MODE: Auth0 token not cryptographically verified');
          // Attach Auth0 user info to request
          req.auth0User = decoded;
          
          next();
        } catch (tokenError) {
          console.error('Auth0 token decode error:', tokenError);
          return res.status(401).json({ 
            success: false,
            message: 'Invalid authentication token' 
          });
        }
      }
    } catch (error) {
      console.error('Auth0 verification error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Authentication error' 
      });
    }
  },
  
  /**
   * Middleware to check clinic verification status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  checkClinicStatus: (req, res, next) => {
    // Only applicable for clinic administrators
    if (!req.isClinicAdmin || !req.clinicId) {
      return next();
    }
    
    // Check if clinic exists and get its status
    const { clinic } = req;
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Check verification status
    if (clinic.verificationStatus === 'rejected') {
      return res.status(403).json({
        success: false,
        message: 'Clinic verification has been rejected. Please contact support.'
      });
    }
    
    // Allow pending clinics to access limited functionality
    if ((clinic.verificationStatus === 'pending' || clinic.verificationStatus === 'in_review') && !clinic.emailVerified) {
      // Get restricted routes from config or use default
      const restrictedRoutes = config.auth.clinicRestrictedRoutes || [
        '/api/clinic/patients',
        '/api/clinic/doctors',
        '/api/clinic/appointments'
      ];
      
      if (restrictedRoutes.some(route => req.originalUrl.includes(route))) {
        return res.status(403).json({
          success: false,
          message: 'Please complete clinic verification to access this feature'
        });
      }
    }
    
    next();
  },
  
  /**
   * Middleware to track login attempts and handle account lockout
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  trackLoginAttempts: async (req, res, next) => {
    const { email } = req.body;
    
    if (!email) {
      return next();
    }
    
    // Attach the email to the request for use in subsequent middleware
    req.loginEmail = email;
    
    try {
      // Find user by email to check if account is locked
      const user = await User.findOne({ email });
      
      if (user && user.isAccountLocked && user.isAccountLocked()) {
        // Calculate remaining lockout time
        const remainingTime = Math.ceil((user.lockedUntil - Date.now()) / 60000); // in minutes
        
        return res.status(429).json({
          success: false,
          message: `Account temporarily locked due to too many failed login attempts. Please try again in ${remainingTime} minutes.`
        });
      }
      
      next();
    } catch (error) {
      console.error('Error checking account lockout status:', error);
      // Continue to login process even if check fails
      next();
    }
  },
  
  /**
   * Middleware to handle failed login attempts
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  handleFailedLogin: async (req, res, next) => {
    const email = req.loginEmail;
    
    if (!email) {
      return next();
    }
    
    try {
      const user = await User.findOne({ email });
      
      if (user && user.incrementLoginAttempts) {
        await user.incrementLoginAttempts();
        
        // Check if account is now locked
        if (user.loginAttempts >= config.auth.maxLoginAttempts) {
          const lockoutMinutes = Math.ceil(config.auth.accountLockoutDuration / 60000);
          
          return res.status(429).json({
            success: false,
            message: `Account temporarily locked due to too many failed login attempts. Please try again in ${lockoutMinutes} minutes.`
          });
        }
      }
      
      // Continue with standard error response
      next();
    } catch (error) {
      console.error('Error handling failed login attempt:', error);
      next();
    }
  },
  
  /**
   * Middleware to handle successful login (reset login attempts)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  handleSuccessfulLogin: async (req, res, next) => {
    if (req.user && req.user.resetLoginAttempts) {
      try {
        await req.user.resetLoginAttempts();
      } catch (error) {
        console.error('Error resetting login attempts:', error);
        // Continue anyway - this shouldn't block the login flow
      }
    }
    
    next();
  }
};

export default authMiddleware;