// src/middleware/rateLimit/rateLimitMiddleware.mjs

import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import config from '../../config/config.mjs';

/**
 * Middleware for rate limiting requests
 */
const rateLimitMiddleware = {
  /**
   * Create a rate limiter with default options
   * @param {Object} options - Rate limit options
   * @returns {Function} Rate limiting middleware
   */
  createLimiter: (options = {}) => {
    const { 
      windowMs = 5 * 60 * 1000, // 15 minutes
      max = 1000000, // 100 requests per windowMs
      message = 'Too many requests, please try again later',
      standardHeaders = true,
      legacyHeaders = false,
      skipSuccessfulRequests = false,
    } = options;
    
    // Configure the rate limiter
    const limiterOptions = {
      windowMs,
      max,
      message: {
        success: false,
        message
      },
      standardHeaders,
      legacyHeaders,
      skipSuccessfulRequests,
      // Use a custom key generator to rate limit by IP and path
      keyGenerator: (req) => {
        return `${req.ip}_${req.originalUrl}`;
      }
    };
    
    // Use Redis store if configured
    if (config.redis && config.redis.enabled) {
      limiterOptions.store = new RedisStore({
        // Redis connection options
        redisURL: config.redis.url,
        prefix: 'ratelimit:',
        // Add some expiry buffer to ensure proper cleanup
        expiry: Math.ceil(windowMs / 1000) + 10
      });
    }
    
    return rateLimit(limiterOptions);
  },
  
  /**
   * API rate limiter
   */
  apiLimiter: rateLimit({
    windowMs: config.security.rateLimit.windowMs || 5 * 60 * 1000, // 15 minutes
    max: config.security.rateLimit.max || 100000, // 100 requests per windowMs
    message: {
      success: false,
      message: 'Too many requests, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  /**
   * Authentication-specific rate limiter (more restrictive)
   */
  authLimiter: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 300, // 30 requests per hour
    message: {
      success: false,
      message: 'Too many authentication attempts, please try again later'
    },
    standardHeaders: true,
    legacyHeaders: false
  }),
  
  /**
   * Create a role-based rate limiter
   * @param {Object} roleLimits - Limits by role
   * @returns {Function} Middleware function
   */
  roleBasedLimiter: (roleLimits = {}) => {
    // Default limits by role
    const limits = {
      admin: 500,
      staff: 300,
      doctor: 20000,
      patient: 100000,
      ...roleLimits
    };
    
    // Window size in milliseconds (15 minutes default)
    const windowMs = 5 * 60 * 1000;
    
    // Create rate limiters for each role
    const limiters = {};
    
    for (const [role, limit] of Object.entries(limits)) {
      limiters[role] = rateLimit({
        windowMs,
        max: limit,
        message: {
          success: false,
          message: 'Too many requests, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
        // Skip when this role doesn't match the request
        skip: (req) => req.userRole !== role
      });
    }
    
    // Anonymous users limiter
    const anonymousLimiter = rateLimit({
      windowMs,
      max: 1000, // Lower limit for anonymous users
      message: {
        success: false,
        message: 'Too many requests, please try again later'
      },
      standardHeaders: true,
      legacyHeaders: false,
      // Skip when user is authenticated
      skip: (req) => !!req.user
    });
    
    // Return middleware that applies appropriate limiter based on role
    return (req, res, next) => {
      if (!req.user) {
        // Apply anonymous limiter for unauthenticated requests
        return anonymousLimiter(req, res, next);
      }
      
      // Apply role-specific limiter
      const userRole = req.userRole || 'patient'; // Default to patient role
      const limiter = limiters[userRole] || limiters.patient; // Fallback to patient limiter
      
      return limiter(req, res, next);
    };
  },
  
  /**
   * Endpoint-specific rate limiter
   * @param {Object} endpointLimits - Limits by endpoint pattern
   * @returns {Function} Middleware function
   */
  endpointLimiter: (endpointLimits = {}) => {
    // Default limits for common endpoints
    const limits = {
      '/api/auth/': 200, // Authentication endpoints
      '/api/users/': 1000, // User management
      '/api/appointments/': 10000, // Appointments
      ...endpointLimits
    };
    
    // Window size in milliseconds (15 minutes default)
    const windowMs = 5 * 60 * 1000;
    
    // Return middleware that applies limits based on URL path
    return (req, res, next) => {
      // Find matching limit for the current path
      const matchingPattern = Object.keys(limits).find(pattern => 
        req.originalUrl.includes(pattern)
      );
      
      if (!matchingPattern) {
        // No specific limit for this endpoint, continue
        return next();
      }
      
      // Create or get limiter for this endpoint
      const limit = limits[matchingPattern];
      const limiter = rateLimit({
        windowMs,
        max: limit,
        message: {
          success: false,
          message: 'Too many requests for this endpoint, please try again later'
        },
        standardHeaders: true,
        legacyHeaders: false,
        keyGenerator: (req) => `${req.ip}_${matchingPattern}`
      });
      
      // Apply the limiter
      return limiter(req, res, next);
    };
  }
};

export default rateLimitMiddleware;