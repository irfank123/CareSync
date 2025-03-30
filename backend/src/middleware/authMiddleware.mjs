// src/middleware/authMiddleware.js

import jwt from 'jsonwebtoken';
import { User, Clinic } from '../models';
import { config } from '../config';

/**
 * Authentication middleware to protect routes
 */
const authMiddleware = {
  /**
   * Middleware to authenticate user tokens
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  authenticate: async (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      
      if (!token) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      // Verify token
      const secret = config.jwt.secret;
      const decoded = jwt.verify(token, secret);
      
      // Check token type and attach appropriate entity to request
      if (decoded.type === 'clinic') {
        const clinic = await Clinic.findById(decoded.id);
        if (!clinic) {
          return res.status(401).json({ message: 'Invalid authentication' });
        }
        
        req.clinic = clinic;
        req.userType = 'clinic';
      } else {
        // Regular user (patient or doctor)
        const user = await User.findById(decoded.id);
        if (!user) {
          return res.status(401).json({ message: 'Invalid authentication' });
        }
        
        req.user = user;
        req.userType = user.userType;
      }
      
      next();
    } catch (error) {
      console.error('Authentication error:', error);
      return res.status(401).json({ message: 'Invalid authentication' });
    }
  },
  
  /**
   * Middleware to restrict routes to specific user types
   * @param {string[]} allowedTypes - Array of allowed user types
   * @returns {Function} Middleware function
   */
  restrictTo: (...allowedTypes) => {
    return (req, res, next) => {
      if (!req.userType || !allowedTypes.includes(req.userType)) {
        return res.status(403).json({ 
          message: 'You do not have permission to perform this action' 
        });
      }
      
      next();
    };
  },
  
  /**
   * Middleware to verify clinic status
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  verifyClinicStatus: (req, res, next) => {
    // Only applicable for clinic users
    if (req.userType !== 'clinic') {
      return next();
    }
    
    // Check verification status
    if (req.clinic.verificationStatus === 'rejected') {
      return res.status(403).json({ 
        message: 'Clinic verification has been rejected. Please contact support.' 
      });
    }
    
    // Allow pending clinics to access limited functionality
    if (req.clinic.verificationStatus === 'pending' && !req.clinic.emailVerified) {
      // For routes that require full verification
      if (req.baseUrl.includes('/api/clinic/patients') || 
          req.baseUrl.includes('/api/clinic/doctors')) {
        return res.status(403).json({
          message: 'Please complete clinic verification to access this feature'
        });
      }
    }
    
    next();
  },
  
  /**
   * Middleware to verify Auth0 token for public API
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  verifyAuth0Token: async (req, res, next) => {
    try {
      // Get token from Authorization header
      const authHeader = req.headers.authorization;
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Authentication required' });
      }
      
      const token = authHeader.split(' ')[1];
      
      // In production, this would validate using Auth0's JWT verification
      // For now we're just decoding to get the user info
      const decoded = jwt.decode(token);
      
      if (!decoded || !decoded.sub) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      
      // Attach Auth0 user info to request
      req.auth0User = decoded;
      
      next();
    } catch (error) {
      console.error('Auth0 verification error:', error);
      return res.status(401).json({ message: 'Authentication failed' });
    }
  }
};

export default authMiddleware;