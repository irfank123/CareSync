// src/middleware/authMiddleware.mjs

import jwt from 'jsonwebtoken';
import { User, Clinic } from '../models/index.mjs';
import config from '../config/config.mjs';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * authentication middleware to protect routes
 */

const authMiddleware = {
  /**
   * extract token from request
   * @param {Object} req - express request object
   * @returns {string|null} - JWT token or null
   * @private
   */
  _extractToken(req) {
    //check Authorization header first
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.split(' ')[1];
    }
    
    //check cookies
    if (req.cookies && req.cookies.token) {
      return req.cookies.token;
    }
    
    return null;
  },

  /**
   * middleware to authenticate users using JWT
   * @param {Object} req - express request object
   * @param {Object} res - express response object
   * @param {Function} next - express next function
   */
  authenticate: async (req, res, next) => {
    try {
      // extract token
      const token = authMiddleware._extractToken(req);
      
      if (!token) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required'
        });
      }
      
      //verify token
      const decoded = jwt.verify(token, config.jwt.secret);
      
      //get user details
      const user = await User.findById(decoded.id);
      
      if (!user) {
        return res.status(401).json({ 
          success: false,
          message: 'The user belonging to this token no longer exists'
        });
      }
      
      //check if user is active
      if (!user.isActive) {
        return res.status(401).json({ 
          success: false,
          message: 'Your account has been deactivated'
        });
      }
      
      //check token issued time against password change time (if password was changed)
      if (user.passwordChangedAt && decoded.iat < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
        return res.status(401).json({ 
          success: false,
          message: 'Password was recently changed. Please log in again'
        });
      }
      
      //add user to request
      req.user = user;
      req.userRole = user.role;
      
      //if clinic admin, add clinic information
      if (user.role === 'admin' && decoded.clinicId) {
        req.isClinicAdmin = true;
        req.clinicId = decoded.clinicId;
        
        //fetch clinic data
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
      
      //add auth context for logging
      req.authContext = {
        userId: user._id,
        role: user.role,
        tokenIssued: new Date(decoded.iat * 1000),
        tokenExpires: new Date(decoded.exp * 1000)
      };
      
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
      
      console.error('Authentication error:', error);
      return res.status(500).json({ 
        success: false,
        message: 'Authentication error'
      });
    }
  },
  
  /**
   * middleware to restrict routes to specific roles
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
      
      // In production, this would verify using Auth0's JWT verification
      // For development, we'll use a simplified approach
      
      try {
        // For development: simply decode the token
        const decoded = jwt.decode(token);
        
        if (!decoded || !decoded.sub) {
          throw new Error('Invalid token structure');
        }
        
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
  }
};

export default authMiddleware;