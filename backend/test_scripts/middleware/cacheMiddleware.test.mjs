import NodeCache from 'node-cache';
import cacheMiddleware from '../../src/middleware/cache/cacheMiddleware.mjs';

// Mock NodeCache
jest.mock('node-cache', () => {
  return jest.fn().mockImplementation(() => ({
    get: jest.fn(),
    set: jest.fn(),
    keys: jest.fn(),
    del: jest.fn(),
    flushAll: jest.fn()
  }));
});

describe('cacheMiddleware', () => {
  let req;
  let res;
  let next;
  let mockCache;
  let originalClearCache;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Store original function
    originalClearCache = cacheMiddleware.clearCache;
    
    // Create a spy on clearCache
    cacheMiddleware.clearCache = jest.fn().mockImplementation(originalClearCache);
    
    // Get the mocked NodeCache instance
    mockCache = new NodeCache();
    
    // Mock Express request, response and next function
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      user: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      setHeader: jest.fn(),
      send: jest.fn()
    };
    
    next = jest.fn();
  });

  afterEach(() => {
    // Restore original functions
    cacheMiddleware.clearCache = originalClearCache;
  });

  describe('middleware function', () => {
    it('should bypass cache for non-GET requests', () => {
      req.method = 'POST';
      
      cacheMiddleware(req, res, next);
      
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should bypass cache if skip header is present', () => {
      req.headers = { 'x-skip-cache': 'true' };
      
      cacheMiddleware(req, res, next);
      
      expect(mockCache.get).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should return cached response if available', () => {
      const cachedData = { data: 'cached result' };
      mockCache.get.mockReturnValueOnce(cachedData);
      
      cacheMiddleware(req, res, next);
      
      expect(mockCache.get).toHaveBeenCalledWith(req.originalUrl);
      expect(res.setHeader).toHaveBeenCalledWith('X-Cache', 'HIT');
      expect(res.send).toHaveBeenCalledWith(cachedData);
      expect(next).not.toHaveBeenCalled();
    });

    it('should call next and set up response interception if cache miss', () => {
      // Mock cache miss
      mockCache.get.mockReturnValueOnce(null);
      
      const originalSend = res.send;
      
      cacheMiddleware(req, res, next);
      
      expect(mockCache.get).toHaveBeenCalledWith(req.originalUrl);
      expect(next).toHaveBeenCalled();
      expect(res.send).not.toBe(originalSend); // Should be wrapped
      
      // Now simulate a response with the intercepted send
      const responseData = { data: 'test response' };
      res.send(responseData);
      
      // Should cache the response
      expect(mockCache.set).toHaveBeenCalledWith(req.originalUrl, responseData, expect.any(Number));
      expect(originalSend).toHaveBeenCalledWith(responseData);
    });
  });

  describe('clearCache', () => {
    it('should clear all cache when no pattern is provided', () => {
      // Reset to original function for this test
      cacheMiddleware.clearCache = originalClearCache;
      
      // Call the function
      cacheMiddleware.clearCache();
      
      // Verify flushAll was called
      expect(mockCache.flushAll).toHaveBeenCalled();
    });

    it('should delete specific keys matching pattern', () => {
      // Reset to original function for this test
      cacheMiddleware.clearCache = originalClearCache;
      
      // Setup mock keys
      const mockKeys = ['/api/users', '/api/posts', '/api/comments'];
      mockCache.keys.mockReturnValueOnce(mockKeys);
      
      // Call with pattern
      cacheMiddleware.clearCache('/api/users');
      
      // Should check keys and delete matching ones
      expect(mockCache.keys).toHaveBeenCalled();
      expect(mockCache.del).toHaveBeenCalledWith('/api/users');
      expect(mockCache.del).not.toHaveBeenCalledWith('/api/posts');
    });
  });

  describe('cacheMiddleware.cache', () => {
    it('should expose the cache instance', () => {
      expect(cacheMiddleware.cache).toBeDefined();
    });
  });

  describe('edge cases', () => {
    it('should handle errors when setting cache by continuing execution', () => {
      // Mock cache miss
      mockCache.get.mockReturnValueOnce(null);
      
      // Force set to throw error
      mockCache.set.mockImplementationOnce(() => {
        throw new Error('Cache error');
      });
      
      const originalSend = res.send;
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
      
      cacheMiddleware(req, res, next);
      
      // Simulate response
      const responseData = { data: 'test response' };
      res.send(responseData);
      
      // Should attempt to cache and handle error
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(originalSend).toHaveBeenCalledWith(responseData);
      
      consoleErrorSpy.mockRestore();
    });
    
    it('should handle circular references in response data', () => {
      // Mock cache miss
      mockCache.get.mockReturnValueOnce(null);
      
      cacheMiddleware(req, res, next);
      
      // Create circular object
      const circularObj = { name: 'test' };
      circularObj.self = circularObj;
      
      // Should be able to handle this without crashing
      res.send(circularObj);
      
      // The middleware should have attempted to cache something
      expect(mockCache.set).toHaveBeenCalled();
    });

    it('should handle objects with toJSON method', () => {
      // Mock cache miss
      mockCache.get.mockReturnValueOnce(null);
      
      cacheMiddleware(req, res, next);
      
      // Create object with toJSON
      const customObject = {
        name: 'test',
        toJSON: jest.fn().mockReturnValue({ name: 'serialized' })
      };
      
      // Send it as response
      res.send(customObject);
      
      // Should use the toJSON result for caching
      expect(mockCache.set).toHaveBeenCalled();
      expect(customObject.toJSON).toHaveBeenCalled();
    });
  });
}); 