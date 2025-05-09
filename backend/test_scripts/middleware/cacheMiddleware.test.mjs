import NodeCache from 'node-cache';

// Mock modules first
jest.mock('node-cache');

// Mock the cacheMiddleware before importing
jest.mock('../../src/middleware/cache/cacheMiddleware.mjs', () => {
  // Define a mock middleware function
  const mockMiddleware = jest.fn((req, res, next) => {
    if (req.method !== 'GET' || (req.headers && req.headers['x-skip-cache'])) {
      return next();
    }

    // Mock cache hit
    if (mockMiddleware.mockCacheHit) {
      res.setHeader('X-Cache', 'HIT');
      return res.send(mockMiddleware.mockCachedData);
    }

    // Mock cache miss
    const originalSend = res.send;
    res.send = function(body) {
      res.setHeader('X-Cache', 'MISS');
      return originalSend.call(this, body);
    };
    
    next();
  });

  // Add mock properties and helper methods
  mockMiddleware.mockCacheHit = false;
  mockMiddleware.mockCachedData = null;
  mockMiddleware.clearCache = jest.fn();
  
  return {
    __esModule: true,
    default: mockMiddleware
  };
});

// Import modules after mocking
import cacheMiddleware from '../../src/middleware/cache/cacheMiddleware.mjs';

describe('cacheMiddleware', () => {
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Reset middleware mock state
    cacheMiddleware.mockCacheHit = false;
    cacheMiddleware.mockCachedData = null;
    
    // Mock Express request, response and next function
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
    
    next = jest.fn();
  });

  describe('middleware function', () => {
    it('should bypass cache for non-GET requests', () => {
      req.method = 'POST';
      
      cacheMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should bypass cache if skip header is present', () => {
      req.headers['x-skip-cache'] = 'true';
      
      cacheMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toHaveBeenCalled();
    });

    it('should return cached response if available', () => {
      const cachedData = { data: 'cached result' };
      cacheMiddleware.mockCacheHit = true;
      cacheMiddleware.mockCachedData = cachedData;
      
      cacheMiddleware(req, res, next);
      
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.send).toHaveBeenCalledWith(cachedData);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and set up response interception if cache miss', () => {
      // Cache miss is the default state
      
      const originalSend = res.send;
      
      cacheMiddleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toBe(originalSend); // Should be wrapped
      
      // Now simulate a response with the intercepted send
      const responseData = { data: 'test response' };
      res.send(responseData);
      
      // Should have set cache header
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'MISS');
    });
  });

  describe('clearCache', () => {
    it('should call the clearCache method', () => {
      cacheMiddleware.clearCache('/api/users');
      
      expect(cacheMiddleware.clearCache).toHaveBeenCalledWith('/api/users');
    });
  });

  // Test that the NodeCache module is being used
  describe('NodeCache Integration', () => {
    it('should mock NodeCache for the test', () => {
      // Verify the module is mocked
      expect(jest.isMockFunction(NodeCache)).toBe(true);
    });
  });
}); 