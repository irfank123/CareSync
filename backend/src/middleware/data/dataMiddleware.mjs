// src/middleware/data/dataMiddleware.mjs

/**
 * Middleware for handling data transformation and response formatting
 */
const dataMiddleware = {
  /**
   * Standardize successful responses
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  formatResponse: (req, res, next) => {
    // Store original methods
    const originalJson = res.json;
    const originalSend = res.send;
    
    // Override json method
    res.json = function(data) {
      // If response is already standardized, don't modify it
      if (data && (data.success !== undefined)) {
        return originalJson.call(this, data);
      }
      
      // Standardize the response
      const formattedData = {
        success: true,
        data
      };
      
      // Call original method with formatted data
      return originalJson.call(this, formattedData);
    };
    
    // Override send method to handle non-JSON responses
    res.send = function(data) {
      // If it's a non-object or already a string, don't modify
      if (typeof data !== 'object' || typeof data === 'string') {
        return originalSend.call(this, data);
      }
      
      // Call custom json method which will format the response
      return res.json(data);
    };
    
    next();
  },
  
  /**
   * Filter sensitive data from responses
   * @param {Array} sensitiveFields - Fields to remove from responses
   * @returns {Function} Middleware function
   */
  sanitizeResponse: (sensitiveFields = ['passwordHash', 'password', 'token']) => {
    return (req, res, next) => {
      // Store original json method
      const originalJson = res.json;
      
      // Override json method
      res.json = function(data) {
        try {
          // Recursively remove sensitive fields
          const sanitized = dataMiddleware._sanitizeObject(data, sensitiveFields);
          
          // Call original method with sanitized data
          return originalJson.call(this, sanitized);
        } catch (error) {
          console.error('Error sanitizing response:', error);
          // If sanitization fails, try to return original data
          return originalJson.call(this, data);
        }
      };
      
      next();
    };
  },
  
  /**
   * Transform request data before it reaches controllers
   * @param {Function} transformFn - Function to transform request data
   * @returns {Function} Middleware function
   */
  transformRequest: (transformFn) => {
    return (req, res, next) => {
      // Apply transformation to request body
      if (req.body) {
        req.body = transformFn(req.body);
      }
      
      next();
    };
  },
  
  /**
   * Add pagination metadata to responses
   * @param {string} totalCountHeader - Header name for total count
   * @returns {Function} Middleware function
   */
  addPagination: (totalCountHeader = 'X-Total-Count') => {
    return (req, res, next) => {
      // Store original json method
      const originalJson = res.json;
      
      // Override json method
      res.json = function(data) {
        // If response contains array data and pagination info in headers
        const totalCount = res.get(totalCountHeader);
        
        if (totalCount && Array.isArray(data?.data)) {
          // Calculate pagination data
          const page = parseInt(req.query.page, 10) || 1;
          const limit = parseInt(req.query.limit, 10) || 10;
          const totalPages = Math.ceil(totalCount / limit);
          
          // Add pagination metadata
          data.pagination = {
            total: parseInt(totalCount, 10),
            totalPages,
            currentPage: page,
            perPage: limit
          };
        }
        
        // Call original method
        return originalJson.call(this, data);
      };
      
      next();
    };
  },
  
  /**
   * Filter fields based on query parameter
   * @param {string} fieldsParam - Query parameter name for fields
   * @returns {Function} Middleware function
   */
  filterFields: (fieldsParam = 'fields') => {
    return (req, res, next) => {
      // Store original json method
      const originalJson = res.json;
      
      // Override json method
      res.json = function(data) {
        // If fields parameter exists in query
        const fields = req.query[fieldsParam];
        
        if (fields && typeof data === 'object') {
          // Split fields by comma
          const fieldList = fields.split(',').map(field => field.trim());
          
          // Apply field filtering
          if (Array.isArray(data?.data)) {
            data.data = data.data.map(item => dataMiddleware._filterFields(item, fieldList));
          } else if (data.data) {
            data.data = dataMiddleware._filterFields(data.data, fieldList);
          } else if (!data.success) {
            // Direct data object without success wrapper
            data = dataMiddleware._filterFields(data, fieldList);
          }
        }
        
        // Call original method
        return originalJson.call(this, data);
      };
      
      next();
    };
  },
  
  /**
   * Helper function to recursively sanitize objects
   * @param {Object} obj - Object to sanitize
   * @param {Array} sensitiveFields - Fields to remove
   * @param {WeakMap} seen - Map of already processed objects to prevent circular references
   * @returns {Object} Sanitized object
   * @private
   */
  _sanitizeObject: (obj, sensitiveFields, seen = new WeakMap()) => {
    // Handle null or non-objects
    if (!obj || typeof obj !== 'object') {
      return obj;
    }
    
    // Handle Date objects
    if (obj instanceof Date) {
      return new Date(obj);
    }
    
    // Detect circular references
    if (seen.has(obj)) {
      return "[Circular Reference]";
    }
    
    // Add this object to seen map
    seen.set(obj, true);
    
    // Handle arrays
    if (Array.isArray(obj)) {
      return obj.map(item => dataMiddleware._sanitizeObject(item, sensitiveFields, seen));
    }
    
    // Handle objects
    const sanitized = {};
    
    for (const key in obj) {
      // Skip sensitive fields
      if (sensitiveFields.includes(key)) {
        continue;
      }
      
      try {
        // Recursively sanitize nested objects
        if (obj[key] && typeof obj[key] === 'object') {
          sanitized[key] = dataMiddleware._sanitizeObject(obj[key], sensitiveFields, seen);
        } else {
          sanitized[key] = obj[key];
        }
      } catch (error) {
        // If processing a specific field fails, skip it
        console.error(`Error sanitizing field ${key}:`, error);
        sanitized[key] = "[Error: Unable to sanitize]";
      }
    }
    
    return sanitized;
  },
  
  /**
   * Helper function to filter object fields
   * @param {Object} obj - Object to filter
   * @param {Array} fields - Fields to include
   * @returns {Object} Filtered object
   * @private
   */
  _filterFields: (obj, fields) => {
    if (!obj || typeof obj !== 'object' || !fields.length) {
      return obj;
    }
    
    // Create a new object with only requested fields
    const filtered = {};
    
    fields.forEach(field => {
      if (field in obj) {
        filtered[field] = obj[field];
      }
    });
    
    return filtered;
  }
};

export default dataMiddleware;