// src/middleware/cache/cacheMiddleware.mjs

import NodeCache from 'node-cache';

// Initialize cache with standard TTL of 5 minutes and check period of 10 minutes
const cache = new NodeCache({ stdTTL: 300, checkperiod: 600 });

/**
 * Middleware for handling caching of responses
 */
const cacheMiddleware = {
  /**
   * Cache for memory store
   */
  cache,
  
  /**
   * Middleware to cache responses
   * @param {number} duration - Cache duration in seconds
   * @returns {Function} Middleware function
   */
  cacheResponse: (duration = 300) => {
    return (req, res, next) => {
      // Skip caching for non-GET requests
      if (req.method !== 'GET') {
        return next();
      }
      
      // Skip caching if authenticated user (personalized responses)
      if (req.user && req.method === 'GET') {
        // Allow caching but include user ID in cache key
        const key = `${req.user._id}_${req.originalUrl}`;
        const cachedResponse = cache.get(key);
        
        if (cachedResponse) {
          // Return cached response
          return res.status(200).json(cachedResponse);
        }
        
        // Store original json method
        const originalJson = res.json;
        
        // Override json method to cache response
        res.json = function(data) {
          // Cache the response
          cache.set(key, data, duration);
          
          // Call original method
          return originalJson.call(this, data);
        };
        
        return next();
      }
      
      // For public endpoints (no authentication)
      const key = req.originalUrl;
      const cachedResponse = cache.get(key);
      
      if (cachedResponse) {
        // Set cache header
        res.set('X-Cache', 'HIT');
        // Return cached response
        return res.status(200).json(cachedResponse);
      }
      
      // Set cache header
      res.set('X-Cache', 'MISS');
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method to cache response
      res.json = function(data) {
        // Only cache successful responses
        if (res.statusCode >= 200 && res.statusCode < 300) {
          // Cache the response
          cache.set(key, data, duration);
        }
        
        // Call original method
        return originalJson.call(this, data);
      };
      
      next();
    };
  },
  
  /**
   * Clear cache for a specific key or pattern
   * @param {string} keyPattern - Key or pattern to match
   * @returns {number} Number of keys cleared
   */
  clearCache: (keyPattern) => {
    if (!keyPattern) {
      // Clear all cache
      cache.flushAll();
      return 1;
    }
    
    // Get all keys
    const keys = cache.keys();
    
    // Filter keys by pattern
    const matchingKeys = keys.filter(key => key.includes(keyPattern));
    
    // Delete matching keys
    matchingKeys.forEach(key => cache.del(key));
    
    return matchingKeys.length;
  },
  
  /**
   * Middleware to clear cache when data is modified
   * @param {string} resourcePattern - Resource pattern for cache keys
   * @returns {Function} Middleware function
   */
  clearCacheOnWrite: (resourcePattern) => {
    return (req, res, next) => {
      // Only clear cache for non-GET requests (writes)
      if (req.method !== 'GET') {
        // Store original end method
        const originalEnd = res.end;
        
        // Override end method
        res.end = function(chunk, encoding) {
          // Call original method
          originalEnd.call(this, chunk, encoding);
          
          // Only clear cache for successful requests
          if (res.statusCode >= 200 && res.statusCode < 300) {
            // Clear cache in background
            setTimeout(() => {
              cacheMiddleware.clearCache(resourcePattern);
            }, 0);
          }
        };
      }
      
      next();
    };
  },
  
  /**
   * Set appropriate cache headers
   * @param {Object} options - Cache options
   * @returns {Function} Middleware function
   */
  setCacheHeaders: (options = {}) => {
    const { 
      isPublic = false, 
      maxAge = 3600,
      staleWhileRevalidate = 60,
      staleIfError = 86400
    } = options;
    
    return (req, res, next) => {
      // Skip for non-GET/HEAD requests or authenticated users (unless explicitly public)
      if ((req.method !== 'GET' && req.method !== 'HEAD') || 
          (!isPublic && req.user)) {
        // Set no-cache for authenticated users
        res.set('Cache-Control', 'private, no-cache, no-store, must-revalidate');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
        return next();
      }
      
      // Set Cache-Control header with directives
      const cacheControl = [
        isPublic ? 'public' : 'private',
        `max-age=${maxAge}`,
        `stale-while-revalidate=${staleWhileRevalidate}`,
        `stale-if-error=${staleIfError}`
      ].join(', ');
      
      res.set('Cache-Control', cacheControl);
      
      // Set Expires header
      const expiresDate = new Date(Date.now() + maxAge * 1000);
      res.set('Expires', expiresDate.toUTCString());
      
      next();
    };
  }
};

export default cacheMiddleware;