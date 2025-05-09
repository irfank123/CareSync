// Define individual mock functions for each method of the NodeCache instance
const mockGet = jest.fn();
const mockSet = jest.fn();
const mockDel = jest.fn();
const mockKeys = jest.fn();
const mockFlushAll = jest.fn();
const mockOn = jest.fn();
const mockClose = jest.fn();

jest.mock('node-cache', () => {
  // This is the mock for the NodeCache constructor
  // Define the mock functions *inside* the factory
  const mockGet = jest.fn();
  const mockSet = jest.fn();
  const mockDel = jest.fn();
  const mockKeys = jest.fn();
  const mockFlushAll = jest.fn();
  const mockOn = jest.fn();
  const mockClose = jest.fn();
  
  const mockInstance = {
    get: mockGet,
    set: mockSet,
    del: mockDel,
    keys: mockKeys,
    flushAll: mockFlushAll,
    on: mockOn,
    close: mockClose,
  };

  // The factory function for jest.mock needs to return the mock constructor
  const mockConstructor = jest.fn().mockImplementation(() => mockInstance);
  
  // To allow test to reset these mocks, they need to be accessible.
  // We can attach them to the mockConstructor itself or a shared object.
  // Let's attach to constructor as it's more common.
  mockConstructor.mockGet = mockGet;
  mockConstructor.mockSet = mockSet;
  mockConstructor.mockDel = mockDel;
  mockConstructor.mockKeys = mockKeys;
  mockConstructor.mockFlushAll = mockFlushAll;
  mockConstructor.mockOn = mockOn;
  mockConstructor.mockClose = mockClose;
  mockConstructor.getMockInstance = () => mockInstance; // Helper to get the instance if needed

  return mockConstructor;
});

// Import the actual middleware AFTER mocking its dependencies
import cacheMiddleware from '../../src/middleware/cache/cacheMiddleware.mjs';
// Import the mock constructor to access the mock functions for reset/assertion
import MockNodeCache from 'node-cache';

describe('cacheMiddleware', () => {
  let req;
  let res;
  let next;
  // Access the mock functions via the imported mock constructor
  const { 
    mockGet, 
    mockSet, 
    mockDel, 
    mockKeys, 
    mockFlushAll, 
    mockOn, 
    mockClose 
  } = MockNodeCache;

  beforeEach(() => {
    // Reset the individual mock functions
    mockGet.mockReset();
    mockSet.mockReset();
    mockDel.mockReset();
    mockKeys.mockReset();
    mockFlushAll.mockReset();
    mockOn.mockReset();
    mockClose.mockReset();

    // Mock Express request, response, and next function
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      headers: {},
      user: null, // Initialize user as null, can be set in tests
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      set: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      end: jest.fn().mockReturnThis(),
      statusCode: 200, // Default to 200 OK
    };
    next = jest.fn();
  });

  describe('cache (NodeCache instance)', () => {
    it('should expose the NodeCache instance whose methods are our mocks', () => {
      expect(cacheMiddleware.cache.get).toBe(mockGet);
      expect(cacheMiddleware.cache.set).toBe(mockSet);
      expect(cacheMiddleware.cache.del).toBe(mockDel);
      expect(cacheMiddleware.cache.keys).toBe(mockKeys);
      expect(cacheMiddleware.cache.flushAll).toBe(mockFlushAll);
      expect(cacheMiddleware.cache.on).toBe(mockOn);
      expect(cacheMiddleware.cache.close).toBe(mockClose);
    });
  });

  describe('cacheResponse(duration)', () => {
    const defaultDuration = 300; // As per cacheMiddleware.mjs source

    it('should be a function that returns a middleware function', () => {
      expect(typeof cacheMiddleware.cacheResponse()).toBe('function');
    });

    it('should bypass cache and call next() for non-GET requests', () => {
      req.method = 'POST';
      const middleware = cacheMiddleware.cacheResponse(defaultDuration);
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(mockGet).not.toHaveBeenCalled();
      expect(mockSet).not.toHaveBeenCalled();
      expect(res.set).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    describe('for public endpoints (no req.user)', () => {
      beforeEach(() => {
        req.user = null; // Ensure no user for public endpoint tests
        req.method = 'GET';
        req.originalUrl = '/api/public/data';
      });

      it('should return cached response and set X-Cache HIT if available', () => {
        const cachedData = { message: 'This is cached public data' };
        mockGet.mockReturnValue(cachedData);

        const middleware = cacheMiddleware.cacheResponse(defaultDuration);
        middleware(req, res, next);

        expect(mockGet).toHaveBeenCalledWith(req.originalUrl);
        expect(res.set).toHaveBeenCalledWith('X-Cache', 'HIT');
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(cachedData);
        expect(next).not.toHaveBeenCalled();
        expect(mockSet).not.toHaveBeenCalled();
      });

      it('should set X-Cache MISS, call next(), and cache successful (2xx) response', () => {
        mockGet.mockReturnValue(undefined);
        res.statusCode = 200; // Simulate successful response from handler
        const responseData = { message: 'Fresh public data' };

        const middleware = cacheMiddleware.cacheResponse(defaultDuration);
        middleware(req, res, next);

        expect(mockGet).toHaveBeenCalledWith(req.originalUrl);
        expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
        expect(next).toHaveBeenCalledTimes(1);
        expect(mockSet).not.toHaveBeenCalled(); // Not yet called

        // Simulate the actual route handler calling res.json()
        res.json(responseData);

        expect(mockSet).toHaveBeenCalledWith(req.originalUrl, responseData, defaultDuration);
      });
      
      it('should use custom duration when provided for caching successful (2xx) response', () => {
        mockGet.mockReturnValue(undefined);
        res.statusCode = 200;
        const responseData = { message: 'Fresh data with custom TTL' };
        const customDuration = 600;

        const middleware = cacheMiddleware.cacheResponse(customDuration);
        middleware(req, res, next);
        res.json(responseData); // Simulate route handler response

        expect(mockSet).toHaveBeenCalledWith(req.originalUrl, responseData, customDuration);
      });

      it('should set X-Cache MISS, call next(), and NOT cache unsuccessful (non-2xx) response', () => {
        mockGet.mockReturnValue(undefined);
        res.statusCode = 500; // Simulate server error from handler
        const errorResponse = { error: 'Server Error' };

        const middleware = cacheMiddleware.cacheResponse(defaultDuration);
        middleware(req, res, next);

        expect(mockGet).toHaveBeenCalledWith(req.originalUrl);
        expect(res.set).toHaveBeenCalledWith('X-Cache', 'MISS');
        expect(next).toHaveBeenCalledTimes(1);
        expect(mockSet).not.toHaveBeenCalled(); // Not yet called

        // Simulate the actual route handler calling res.json()
        res.json(errorResponse);

        expect(mockSet).not.toHaveBeenCalled(); // Should still not be called
      });
    });

    describe('for authenticated users (req.user is present)', () => {
      const userId = 'user123';
      const userCacheKeyPrefix = `${userId}_`;

      beforeEach(() => {
        req.user = { _id: userId };
        req.method = 'GET';
        req.originalUrl = '/api/private/data';
      });

      it('should return cached response if available (no X-Cache headers)', () => {
        const cachedData = { message: 'This is cached private data for user123' };
        const expectedKey = `${userCacheKeyPrefix}${req.originalUrl}`;
        mockGet.mockReturnValue(cachedData);

        const middleware = cacheMiddleware.cacheResponse(defaultDuration);
        middleware(req, res, next);

        expect(mockGet).toHaveBeenCalledWith(expectedKey);
        expect(res.status).toHaveBeenCalledWith(200);
        expect(res.json).toHaveBeenCalledWith(cachedData);
        expect(next).not.toHaveBeenCalled();
        expect(res.set).not.toHaveBeenCalledWith(expect.stringContaining('X-Cache'), expect.anything());
        expect(mockSet).not.toHaveBeenCalled();
      });

      it('should call next() on cache miss and cache response (even non-2xx) without X-Cache headers', () => {
        const expectedKey = `${userCacheKeyPrefix}${req.originalUrl}`;
        mockGet.mockReturnValue(undefined);
        const responseData = { message: 'Fresh private data for user123' };
        res.statusCode = 200; // First, test with a 200

        const middleware = cacheMiddleware.cacheResponse(defaultDuration);
        middleware(req, res, next);

        expect(mockGet).toHaveBeenCalledWith(expectedKey);
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.set).not.toHaveBeenCalledWith(expect.stringContaining('X-Cache'), expect.anything());
        
        // Simulate handler response
        res.json(responseData);
        expect(mockSet).toHaveBeenCalledWith(expectedKey, responseData, defaultDuration);
        
        // Test again with a non-2xx status to confirm it still caches for authenticated users
        mockGet.mockReturnValue(undefined);
        mockSet.mockClear();
        next.mockClear();
        const errorData = { error: 'something went wrong but cache it anyway for user' };
        res.statusCode = 400;
        const middleware2 = cacheMiddleware.cacheResponse(defaultDuration);
        middleware2(req, res, next); // req, res, next are from the outer scope, res.statusCode is now 400

        res.json(errorData);
        expect(mockSet).toHaveBeenCalledWith(expectedKey, errorData, defaultDuration);
        expect(next).toHaveBeenCalledTimes(1); // next for middleware2 call
      });

      it('should use custom duration for authenticated user cache', () => {
        const expectedKey = `${userCacheKeyPrefix}${req.originalUrl}`;
        mockGet.mockReturnValue(undefined);
        const responseData = { message: 'Fresh private data with custom TTL' };
        const customDuration = 900;
        res.statusCode = 200;

        const middleware = cacheMiddleware.cacheResponse(customDuration);
        middleware(req, res, next);
        res.json(responseData);

        expect(mockSet).toHaveBeenCalledWith(expectedKey, responseData, customDuration);
      });
    });
    
    it('should use default duration (300s) if no duration is provided to cacheResponse', () => {
      req.user = null;
      req.method = 'GET';
      req.originalUrl = '/api/public/default-ttl';
      mockGet.mockReturnValue(undefined);
      res.statusCode = 200;
      const responseData = { message: 'Data to be cached with default TTL' };

      const middleware = cacheMiddleware.cacheResponse(); // No duration argument
      middleware(req, res, next);
      res.json(responseData);

      expect(mockSet).toHaveBeenCalledWith(req.originalUrl, responseData, 300);
    });

    // TODO: Add comprehensive tests for cacheResponse
    // - All main paths covered, consider edge cases if any missed.
  });

  describe('clearCache(keyPattern)', () => {
    it('should be a function', () => {
      expect(typeof cacheMiddleware.clearCache).toBe('function');
    });

    it('should call cache.flushAll() and return 1 if no keyPattern is provided', () => {
      const result = cacheMiddleware.clearCache(); // Undefined pattern
      expect(mockFlushAll).toHaveBeenCalledTimes(1);
      expect(mockKeys).not.toHaveBeenCalled();
      expect(mockDel).not.toHaveBeenCalled();
      expect(result).toBe(1);

      mockFlushAll.mockClear();
      const resultEmptyString = cacheMiddleware.clearCache(''); // Empty string pattern
      expect(mockFlushAll).toHaveBeenCalledTimes(1);
      expect(resultEmptyString).toBe(1);
    });

    it('should delete keys matching the keyPattern and return the count', () => {
      const allKeys = ['/api/users/1', '/api/users/2', '/api/products/123', '/api/users/list/all'];
      mockKeys.mockReturnValue(allKeys);
      
      const keyPattern = '/api/users';
      const result = cacheMiddleware.clearCache(keyPattern);

      expect(mockKeys).toHaveBeenCalledTimes(1);
      expect(mockDel).toHaveBeenCalledTimes(3);
      expect(mockDel).toHaveBeenCalledWith('/api/users/1');
      expect(mockDel).toHaveBeenCalledWith('/api/users/2');
      expect(mockDel).toHaveBeenCalledWith('/api/users/list/all');
      expect(mockDel).not.toHaveBeenCalledWith('/api/products/123');
      expect(result).toBe(3);
    });

    it('should return 0 if no keys match the keyPattern', () => {
      const allKeys = ['/api/products/1', '/api/items/2'];
      mockKeys.mockReturnValue(allKeys);
      
      const keyPattern = '/api/users'; // Pattern that matches nothing
      const result = cacheMiddleware.clearCache(keyPattern);

      expect(mockKeys).toHaveBeenCalledTimes(1);
      expect(mockDel).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });

    it('should return 0 if cache.keys() returns an empty array', () => {
      mockKeys.mockReturnValue([]);
      
      const keyPattern = '/api/anything';
      const result = cacheMiddleware.clearCache(keyPattern);

      expect(mockKeys).toHaveBeenCalledTimes(1);
      expect(mockDel).not.toHaveBeenCalled();
      expect(result).toBe(0);
    });
  });

  describe('clearCacheOnWrite(resourcePattern)', () => {
    let mockClearCache; 

    beforeEach(() => {
      jest.useFakeTimers();
      mockClearCache = jest.spyOn(cacheMiddleware, 'clearCache').mockImplementation(() => {});
      req.method = 'POST'; 
      res.statusCode = 200; 
    });

    afterEach(() => {
      jest.runOnlyPendingTimers();
      jest.useRealTimers();
      mockClearCache.mockRestore(); 
    });
    
    it('should be a function that returns a middleware function', () => {
      expect(typeof cacheMiddleware.clearCacheOnWrite()).toBe('function');
    });

    it('should call next() and do nothing for GET requests', () => {
      req.method = 'GET';
      const originalEnd = res.end;
      const middleware = cacheMiddleware.clearCacheOnWrite('/api/data');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.end).toBe(originalEnd); 
      expect(setTimeout).not.toHaveBeenCalled();
      expect(mockClearCache).not.toHaveBeenCalled();
    });

    it('should call next() and set up res.end override for non-GET requests', () => {
      const originalEnd = res.end;
      const middleware = cacheMiddleware.clearCacheOnWrite('/api/data');
      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res.end).not.toBe(originalEnd); 
    });

    it('should call original res.end, then clearCache via setTimeout on successful (2xx) write', () => {
      const resourcePattern = '/api/users';
      const middleware = cacheMiddleware.clearCacheOnWrite(resourcePattern);
      middleware(req, res, next);
      
      const testChunk = 'data';
      const testEncoding = 'utf8';
      res.end(testChunk, testEncoding); 

      expect(res.end).toHaveBeenCalledWith(testChunk, testEncoding); 
      expect(setTimeout).toHaveBeenCalledTimes(1);
      expect(setTimeout).toHaveBeenCalledWith(expect.any(Function), 0);
      expect(mockClearCache).not.toHaveBeenCalled(); 

      jest.runAllTimers(); 

      expect(mockClearCache).toHaveBeenCalledTimes(1);
      expect(mockClearCache).toHaveBeenCalledWith(resourcePattern);
    });

    it('should call original res.end but NOT clearCache if write is unsuccessful (non-2xx)', () => {
      res.statusCode = 500; 
      const resourcePattern = '/api/items';
      const middleware = cacheMiddleware.clearCacheOnWrite(resourcePattern);
      middleware(req, res, next);

      const testChunk = 'error data';
      const testEncoding = 'utf8';
      res.end(testChunk, testEncoding); 

      expect(res.end).toHaveBeenCalledWith(testChunk, testEncoding);
      expect(setTimeout).not.toHaveBeenCalled(); 
      expect(mockClearCache).not.toHaveBeenCalled();

      jest.runAllTimers(); 
      expect(mockClearCache).not.toHaveBeenCalled();
    });

    it('should use undefined resourcePattern for clearCache if none provided to clearCacheOnWrite', () => {
      const middleware = cacheMiddleware.clearCacheOnWrite(); // No resourcePattern
      middleware(req, res, next);
      res.end('data', 'utf8');
      jest.runAllTimers();
      expect(mockClearCache).toHaveBeenCalledWith(undefined);
    });
  });

  describe('setCacheHeaders(options)', () => {
    beforeEach(() => {
      // Date.now mock for predictable Expires header
      jest.spyOn(Date, 'now').mockReturnValue(new Date('2024-01-01T00:00:00.000Z').getTime());
      req.method = 'GET'; 
      req.user = null; 
    });

    afterEach(() => {
      jest.spyOn(Date, 'now').mockRestore();
    });

    it('should be a function that returns a middleware function', () => {
      expect(typeof cacheMiddleware.setCacheHeaders()).toBe('function');
    });

    it('should set no-cache headers for non-GET/HEAD requests', () => {
      req.method = 'POST';
      const middleware = cacheMiddleware.setCacheHeaders();
      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      expect(res.set).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.set).toHaveBeenCalledWith('Expires', '0');
      expect(next).toHaveBeenCalledTimes(1);
    });

    it('should set no-cache headers for authenticated users if not isPublic', () => {
      req.user = { _id: 'user123' };
      const middleware = cacheMiddleware.setCacheHeaders({ isPublic: false }); 
      middleware(req, res, next);

      expect(res.set).toHaveBeenCalledWith('Cache-Control', 'private, no-cache, no-store, must-revalidate');
      expect(res.set).toHaveBeenCalledWith('Pragma', 'no-cache');
      expect(res.set).toHaveBeenCalledWith('Expires', '0');
      expect(next).toHaveBeenCalledTimes(1);
    });

    describe('for GET/HEAD requests that should be cached', () => {
      const expectedDefaultMaxAge = 3600;
      const expectedDefaultStaleWhileRevalidate = 60;
      const expectedDefaultStaleIfError = 86400;
      const dateNowTimestamp = new Date('2024-01-01T00:00:00.000Z').getTime();

      it('should set public cache headers for GET when isPublic is true, even with user', () => {
        req.user = { _id: 'user123' };
        const middleware = cacheMiddleware.setCacheHeaders({ isPublic: true });
        middleware(req, res, next);
        
        const expectedCacheControl = `public, max-age=${expectedDefaultMaxAge}, stale-while-revalidate=${expectedDefaultStaleWhileRevalidate}, stale-if-error=${expectedDefaultStaleIfError}`;
        const expectedExpires = new Date(dateNowTimestamp + expectedDefaultMaxAge * 1000).toUTCString();

        expect(res.set).toHaveBeenCalledWith('Cache-Control', expectedCacheControl);
        expect(res.set).toHaveBeenCalledWith('Expires', expectedExpires);
        expect(next).toHaveBeenCalledTimes(1);
      });
      
      it('should set public cache headers for HEAD when isPublic is true', () => {
        req.method = 'HEAD';
        const middleware = cacheMiddleware.setCacheHeaders({ isPublic: true });
        middleware(req, res, next);
        
        const expectedCacheControl = `public, max-age=${expectedDefaultMaxAge}, stale-while-revalidate=${expectedDefaultStaleWhileRevalidate}, stale-if-error=${expectedDefaultStaleIfError}`;
        expect(res.set).toHaveBeenCalledWith('Cache-Control', expectedCacheControl);
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should set private cache headers for GET without user and isPublic false (default)', () => {
        const middleware = cacheMiddleware.setCacheHeaders(); 
        middleware(req, res, next);

        const expectedCacheControl = `private, max-age=${expectedDefaultMaxAge}, stale-while-revalidate=${expectedDefaultStaleWhileRevalidate}, stale-if-error=${expectedDefaultStaleIfError}`;
        const expectedExpires = new Date(dateNowTimestamp + expectedDefaultMaxAge * 1000).toUTCString();

        expect(res.set).toHaveBeenCalledWith('Cache-Control', expectedCacheControl);
        expect(res.set).toHaveBeenCalledWith('Expires', expectedExpires);
        expect(next).toHaveBeenCalledTimes(1);
      });

      it('should use custom options for cache headers', () => {
        const customOptions = {
          isPublic: true,
          maxAge: 600,
          staleWhileRevalidate: 30,
          staleIfError: 7200
        };
        const middleware = cacheMiddleware.setCacheHeaders(customOptions);
        middleware(req, res, next);

        const expectedCacheControl = `public, max-age=${customOptions.maxAge}, stale-while-revalidate=${customOptions.staleWhileRevalidate}, stale-if-error=${customOptions.staleIfError}`;
        const expectedExpires = new Date(dateNowTimestamp + customOptions.maxAge * 1000).toUTCString();

        expect(res.set).toHaveBeenCalledWith('Cache-Control', expectedCacheControl);
        expect(res.set).toHaveBeenCalledWith('Expires', expectedExpires);
        expect(next).toHaveBeenCalledTimes(1);
      });
    });
  });
});