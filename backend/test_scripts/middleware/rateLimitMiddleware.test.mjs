import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import rateLimitMiddleware from '../../src/middleware/rateLimit/rateLimitMiddleware.mjs';

// Mock the dependencies
jest.mock('express-rate-limit', () => {
  return jest.fn().mockImplementation(() => {
    const middleware = jest.fn();
    return middleware;
  });
});

jest.mock('rate-limit-redis', () => {
  return jest.fn().mockImplementation(() => ({
    // Mock the Redis store functionality
  }));
});

jest.mock('../../src/config/config.mjs', () => ({
  __esModule: true,
  default: jest.fn().mockReturnValue({
    security: {
      rateLimit: {
        windowMs: 15 * 60 * 1000,
        max: 1000
      }
    },
    redis: {
      enabled: false,
      url: 'redis://localhost:6379'
    }
  })
}));

describe('rateLimitMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Express request, response and next function
    req = {
      ip: '127.0.0.1',
      originalUrl: '/api/test',
      user: { _id: 'user123', role: 'doctor' },
      userRole: 'doctor'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
  });

  describe('createLimiter', () => {
    it('should create a rate limiter with default options', () => {
      rateLimitMiddleware.createLimiter();
      expect(rateLimit).toHaveBeenCalled();
      
      const callArgs = rateLimit.mock.calls[0][0];
      expect(callArgs.windowMs).toBe(5 * 60 * 1000);
      expect(callArgs.max).toBe(1000000);
      expect(callArgs.message).toEqual({
        success: false,
        message: 'Too many requests, please try again later'
      });
    });

    it('should create a rate limiter with custom options', () => {
      const options = {
        windowMs: 10000,
        max: 100,
        message: 'Custom message',
        standardHeaders: false,
        legacyHeaders: true,
        skipSuccessfulRequests: true
      };
      
      rateLimitMiddleware.createLimiter(options);
      
      const callArgs = rateLimit.mock.calls[0][0];
      expect(callArgs.windowMs).toBe(10000);
      expect(callArgs.max).toBe(100);
      expect(callArgs.message).toEqual({
        success: false,
        message: 'Custom message'
      });
      expect(callArgs.standardHeaders).toBe(false);
      expect(callArgs.legacyHeaders).toBe(true);
      expect(callArgs.skipSuccessfulRequests).toBe(true);
    });

    it('should use Redis store when Redis is enabled', () => {
      // Mock the config to have Redis enabled
      const configModule = require('../../src/config/config.mjs');
      const configMock = {
        redis: {
          enabled: true,
          url: 'redis://localhost:6379'
        },
        security: {
          rateLimit: {
            windowMs: 15 * 60 * 1000,
            max: 1000
          }
        }
      };
      configModule.default.mockReturnValueOnce(configMock);
      
      rateLimitMiddleware.createLimiter();
      
      // Check if RedisStore was instantiated
      expect(RedisStore).toHaveBeenCalled();
      
      // The test would need to be adjusted to properly check for Redis store usage
      const callArgs = rateLimit.mock.calls[0][0];
      expect(callArgs.store).toBeDefined();
    });
  });

  describe('apiLimiter', () => {
    beforeEach(() => {
      // Reset our mocks but preserve any implementation
      rateLimit.mockClear();
    });
    
    it('should be a rate limiter middleware', () => {
      // Force initialization of the apiLimiter
      const limiter = rateLimitMiddleware.apiLimiter;
      
      // Verify that rateLimit was called during initialization
      expect(rateLimit).toHaveBeenCalled();
      
      // Verify it's a function (middleware)
      expect(typeof limiter).toBe('function');
    });
  });

  describe('authLimiter', () => {
    beforeEach(() => {
      rateLimit.mockClear();
    });
    
    it('should be a more restrictive rate limiter middleware', () => {
      // Force initialization of the authLimiter
      const limiter = rateLimitMiddleware.authLimiter;
      
      // Verify that rateLimit was called during initialization
      expect(rateLimit).toHaveBeenCalled();
      
      // Get the call arguments from one of the rateLimit calls
      const authCallArgs = rateLimit.mock.calls.find(
        call => call[0].max === 300 && call[0].windowMs === 60 * 60 * 1000
      );
      
      // Verify it was called with stricter limits
      expect(authCallArgs).toBeDefined();
      
      // Verify it's a function (middleware)
      expect(typeof limiter).toBe('function');
    });
  });

  describe('roleBasedLimiter', () => {
    beforeEach(() => {
      // We'll set up a specific mock implementation for this test suite
      rateLimit.mockImplementation(() => {
        const middleware = jest.fn();
        return middleware;
      });
    });
    
    it('should create a middleware function', () => {
      const middleware = rateLimitMiddleware.roleBasedLimiter();
      expect(typeof middleware).toBe('function');
    });

    it('should create limiters for each role', () => {
      rateLimitMiddleware.roleBasedLimiter();
      
      // rateLimit should have been called multiple times for different roles
      expect(rateLimit.mock.calls.length).toBeGreaterThan(1);
    });

    it('should apply anonymous limiter for unauthenticated requests', () => {
      const middleware = rateLimitMiddleware.roleBasedLimiter();
      req.user = null;
      
      // Create a mock implementation that will be returned for the anonymous limiter
      const anonymousLimiter = jest.fn();
      
      // Find the first rateLimit call (likely the anonymous limiter) and provide our mock
      rateLimit.mock.results[0].value = anonymousLimiter;
      
      middleware(req, res, next);
      
      // Our anonymous limiter should have been called with the req, res, next arguments
      expect(anonymousLimiter).toHaveBeenCalledWith(req, res, next);
    });

    it('should apply role-specific limiter for authenticated requests', () => {
      const middleware = rateLimitMiddleware.roleBasedLimiter();
      
      // Create a mock implementation that will be returned for the doctor role limiter
      const doctorLimiter = jest.fn();
      
      // We need to find the rateLimit call for the doctor role and provide our mock
      // For simplicity, we'll just mock all limiters to return the same function
      rateLimit.mock.results.forEach(result => {
        result.value = doctorLimiter;
      });
      
      middleware(req, res, next);
      
      // Our doctor limiter should have been called with the req, res, next arguments
      expect(doctorLimiter).toHaveBeenCalledWith(req, res, next);
    });
  });

  describe('endpointLimiter', () => {
    beforeEach(() => {
      // Set up a specific mock implementation for this test suite
      rateLimit.mockImplementation(() => {
        return jest.fn();
      });
    });
    
    it('should create a middleware function', () => {
      const middleware = rateLimitMiddleware.endpointLimiter();
      expect(typeof middleware).toBe('function');
    });

    it('should continue to next middleware if no matching endpoint pattern', () => {
      const middleware = rateLimitMiddleware.endpointLimiter();
      req.originalUrl = '/not-matching-anything';
      
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });

    it('should apply limiter for matching endpoint patterns', () => {
      const middleware = rateLimitMiddleware.endpointLimiter();
      req.originalUrl = '/api/auth/login';
      
      // Reset rateLimit mock to return a specific function we can track
      const mockLimiter = jest.fn();
      rateLimit.mockReturnValueOnce(mockLimiter);
      
      middleware(req, res, next);
      
      expect(rateLimit).toHaveBeenCalled();
      expect(mockLimiter).toHaveBeenCalledWith(req, res, next);
    });

    it('should use custom endpoint limits when provided', () => {
      const customLimits = {
        '/api/custom/': 50
      };
      
      const middleware = rateLimitMiddleware.endpointLimiter(customLimits);
      req.originalUrl = '/api/custom/endpoint';
      
      // Reset rateLimit mock
      rateLimit.mockReset();
      const mockLimiter = jest.fn();
      rateLimit.mockReturnValueOnce(mockLimiter);
      
      middleware(req, res, next);
      
      expect(rateLimit).toHaveBeenCalled();
      const callArgs = rateLimit.mock.calls[0][0];
      expect(callArgs.max).toBe(50);
      expect(mockLimiter).toHaveBeenCalledWith(req, res, next);
    });
  });
}); 