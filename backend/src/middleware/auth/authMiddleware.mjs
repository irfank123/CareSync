// src/middleware/authMiddleware.mjs

import jwt from 'jsonwebtoken';
import { auth } from 'express-oauth2-jwt-bearer';
import axios from 'axios';
import { User, Clinic } from '../../models/index.mjs';
import config from '../../config/config.mjs';
import { AppError } from '../../utils/errorHandler.mjs';
import tokenBlacklistService from '../../services/tokenBlacklistService.mjs';

// --- Configure Auth0 JWT validation middleware --- 
const checkJwt = auth({
  audience: config.auth0.audience, 
  issuerBaseURL: `https://${config.auth0.domain}/`,
  tokenSigningAlg: 'RS256'
});

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
    
    // No need to check cookies if using Auth0 Bearer token flow primarily
    // if (req.cookies && req.cookies.token) { return req.cookies.token; }
    return null;
  },

  /**
   * Middleware to authenticate users using Auth0 JWT
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  authenticate: async (req, res, next) => {
    // Log the URL being processed by this middleware
    console.log(`[Auth Middleware START] Processing: ${req.method} ${req.originalUrl}`);

    // 1. Let the Auth0 middleware validate the token structure, signature, audience, issuer
    checkJwt(req, res, async (err) => {
      if (err) {
        console.error('[Auth Middleware] Auth0 JWT validation error:', err.message);
        // Use status/message from the library's error if available
        const status = err.status || 401;
        const message = err.message || 'Invalid token';
        return res.status(status).json({ success: false, message });
      }

      // Token is structurally valid. req.auth.payload has basic claims.
      try {
        // Log the payload received from checkJwt
        console.log('[Auth Middleware] Decoded Auth0 Token Payload (from checkJwt):', JSON.stringify(req.auth.payload, null, 2));

        const auth0UserId = req.auth.payload.sub; 
        if (!auth0UserId) {
           return res.status(401).json({ success: false, message: 'Missing user identifier in token' });
        }
        
        // 2. Fetch full user profile (including email) from /userinfo endpoint
        let userInfoResponse;
        const token = authMiddleware._extractToken(req); // Get the raw token again
        if (!token) {
            // Should not happen if checkJwt passed, but check defensively
             return res.status(401).json({ success: false, message: 'Auth token missing after validation' });
        }
        try {
            const userInfoUrl = `https://${config.auth0.domain}/userinfo`;
            console.log(`[Auth Middleware] Fetching user info from ${userInfoUrl}`);
            userInfoResponse = await axios.get(userInfoUrl, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            console.log('[Auth Middleware] Received userinfo response:', JSON.stringify(userInfoResponse.data, null, 2));
        } catch (userInfoError) {
            console.error(`[Auth Middleware] Error fetching /userinfo: ${userInfoError.message}`, userInfoError.response?.data);
            const status = userInfoError.response?.status || 500;
            const message = userInfoError.response?.data?.error_description || 'Failed to fetch user profile from authentication server.';
             return res.status(status).json({ success: false, message });
        }
        
        const userEmail = userInfoResponse.data.email;
        const emailVerified = userInfoResponse.data.email_verified;
        
        if (!userEmail) {
            // We specifically requested email scope, something is wrong if it's missing here
             console.error('[Auth Middleware] Email missing from /userinfo response despite requesting scope.');
             return res.status(401).json({ success: false, message: 'Could not retrieve user email from authentication server.' });
        }
        
        // 3. Find or link the corresponding user in *your* database
        let user = await User.findOne({ auth0Id: auth0UserId });

        if (!user) {
            // User not found by auth0Id. Try finding by email.
            console.log(`[Auth Middleware] User not found by auth0Id ${auth0UserId}. Attempting lookup by email ${userEmail}...`);
            user = await User.findOne({ email: userEmail });
            if (user) {
                // User found by email - Link the account by storing the auth0Id
                console.log(`[Auth Middleware] User found by email (${userEmail}). Linking auth0Id ${auth0UserId}.`);
                user.auth0Id = auth0UserId;
                if (!user.emailVerified && emailVerified) {
                    console.log(`[Auth Middleware] Marking email ${userEmail} as verified based on Auth0 userinfo.`);
                    user.emailVerified = true;
                }
                try {
                  await user.save();
                  console.log(`[Auth Middleware] Successfully linked auth0Id ${auth0UserId} to user ${user._id}.`);
                } catch (saveError) {
                  console.error(`[Auth Middleware] Error saving user ${user._id} after linking auth0Id:`, saveError);
                  return res.status(500).json({ success: false, message: 'Error linking user account.' });
                }
            } else {
                 // Still not found by email. CREATE a new user.
                 console.warn(`[Auth Middleware] User with Auth0 ID ${auth0UserId} and email ${userEmail} not found. Creating new user.`);
                 try {
                    const newUser = new User({
                        auth0Id: auth0UserId,
                        email: userEmail,
                        emailVerified: emailVerified, // Use verification status from Auth0
                        firstName: userInfoResponse.data.given_name || 'Auth0User', // Get names from userinfo
                        lastName: userInfoResponse.data.family_name || auth0UserId, // Use ID as fallback
                        role: 'admin', // Assign default role for clinic portal users
                        isActive: true, // Assume active on creation
                        // passwordHash is not needed due to schema change
                        // phoneNumber is optional
                        profileImageUrl: userInfoResponse.data.picture // Get picture if available
                    });
                    user = await newUser.save(); // Assign the newly created user to the 'user' variable
                    console.log(`[Auth Middleware] Successfully created and saved new user ${user._id} for auth0Id ${auth0UserId}.`);
                 } catch (creationError) {
                     console.error(`[Auth Middleware] Error creating new user for auth0Id ${auth0UserId}:`, creationError);
                     // Check for duplicate key errors (e.g., email already exists but with different auth0Id - should be rare)
                     if (creationError.code === 11000) { // Duplicate key error code
                        return res.status(409).json({ success: false, message: 'An account with this email may already exist but is not linked correctly.' });
                     }
                     return res.status(500).json({ success: false, message: 'Failed to create user profile during first login.' });
                 }
            }
        }
        
        // 4. User found/linked - perform existing checks and attach info
        if (!user) {
            // This case should technically not be reachable if creation/linking worked, but log defensively
            console.error('[Auth Middleware] CRITICAL: User object is null/undefined after creation/linking logic!');
             return res.status(500).json({ success: false, message: 'Internal error processing user authentication.' });
        }
        console.log(`[Auth Middleware] Proceeding with user ${user._id}. Checking isActive...`);
        
        if (!user.isActive) {
           console.log(`[Auth Middleware] User ${user._id} is NOT active. Returning 401.`);
           return res.status(401).json({ success: false, message: 'Your account has been deactivated' });
        }
        
        console.log(`[Auth Middleware] User ${user._id} is active. Attaching user to request.`);
        req.user = user;
        req.userRole = user.role;
        req.userType = 'user'; 
        let clinic = null;
        
        console.log(`[Auth Middleware] Checking clinicId on user: ${user.clinicId}`);
        if (user.clinicId) {
           console.log(`[Auth Middleware] User has clinicId ${user.clinicId}. Fetching clinic...`);
           try {
             clinic = await Clinic.findById(user.clinicId);
             if (clinic) {
                console.log(`[Auth Middleware] Found clinic ${clinic._id}. Checking if active...`);
               if (!clinic.isActive) {
                 console.log(`[Auth Middleware] Clinic ${clinic._id} is NOT active. Returning 401.`);
                 return res.status(401).json({ success: false, message: 'The associated clinic account has been deactivated' });
               }
               console.log(`[Auth Middleware] Clinic ${clinic._id} is active. Attaching clinic to request.`);
               req.clinic = clinic;
               if (user.role === 'admin') { 
                   req.isClinicAdmin = true; 
                   req.userType = 'clinic'; 
               }
             } else {
               console.warn(`[Auth Middleware] Clinic lookup failed for ID: ${user.clinicId}. Returning 401.`);
               return res.status(401).json({ success: false, message: 'Associated clinic not found' });
             }
           } catch (clinicError) {
             console.error(`[Auth Middleware] Error fetching clinic ${user.clinicId}:`, clinicError);
             return res.status(500).json({ success: false, message: 'Error retrieving clinic details' });
           }
         } else {
             console.log(`[Auth Middleware] User ${user._id} does not have a clinicId.`);
         }
         
         // Re-create the authContext attachment here
         req.authContext = {
            userId: user._id,
            auth0Sub: auth0UserId, // Keep auth0UserId from before
            role: user.role,
            clinicId: clinic ? clinic._id : undefined,
            tokenIssued: new Date(req.auth.payload.iat * 1000),
            tokenExpires: new Date(req.auth.payload.exp * 1000)
         };
         console.log(`[Auth Middleware] Attaching authContext:`, req.authContext);

         console.log(`[Auth Middleware] Authentication successful for user ${user._id}. Calling next().`);
         next(); 

      } catch (dbError) {
        console.error('[Auth Middleware] Error during DB operations:', dbError);
        return res.status(500).json({ success: false, message: 'Error processing authentication' });
      }
    });
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
      const requiredRoles = roles.join(', ');
      console.log(`[restrictTo] Checking roles for ${req.method} ${req.originalUrl}. Required: ${requiredRoles}. User role: ${req.userRole}`);
      
      if (!req.user || !req.userRole) {
        console.log(`[restrictTo] FAILED: No user or userRole found on request.`);
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required'
        });
      }
      
      if (!roles.includes(req.userRole)) {
        console.log(`[restrictTo] FAILED: User role '${req.userRole}' not in allowed roles [${requiredRoles}].`);
        return res.status(403).json({ 
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }
      
      console.log(`[restrictTo] SUCCESS: User role '${req.userRole}' is authorized.`);
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
   * Middleware to bypass authentication for testing
   * Sets a mock user with admin role
   * WARNING: Should only be used in development environment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  bypassAuth: (req, res, next) => {
    // Create a mock user for testing purposes
    req.user = {
      _id: '64a3d2f78b008f15d8e6723c',
      name: 'Test User',
      email: 'test@example.com',
      role: 'admin'
    };
    
    req.userRole = 'admin';
    req.userType = 'user';
    
    // Log that we're bypassing auth (in dev mode only)
    if (process.env.NODE_ENV === 'development') {
      console.log('⚠️ WARNING: Authentication bypassed for testing');
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
  },
  
  /**
   * Middleware for protecting routes
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  protect: async (req, res, next) => {
    return authMiddleware.authenticate(req, res, next);
  },

  /**
   * Middleware to authorize users who can create a clinic.
   * Requires user to be authenticated, have role \'admin\', and not have a clinicId yet.
   */
  authorizeClinicAdminCreation: (req, res, next) => {
    // Assumes `authenticate` middleware has already run and set req.user
    if (!req.user) {
      // Should not happen if authenticate ran first, but check anyway
      return res.status(401).json({ success: false, message: 'Not authenticated' });
    }

    const { role, clinicId } = req.user;

    if (role === 'admin' && !clinicId) {
      // User is an admin and does not belong to a clinic yet - authorized
      next();
    } else {
      // User is not an admin or already belongs to a clinic
      let message = 'Not authorized to create a clinic.';
      if (role !== 'admin') {
        message = 'Only users with the admin role can create clinics.';
      }
      if (clinicId) {
        message = 'You already belong to a clinic and cannot create another one.';
      }
      res.status(403).json({ success: false, message });
    }
  },
};

export default authMiddleware;