// src/middleware/audit/auditMiddleware.mjs

import { AuditLog } from '../../models/index.mjs';

/**
 * Middleware for audit logging throughout the application
 */
const auditMiddleware = {
  /**
   * Create an audit log entry
   * @param {Object} logData - Audit log data
   * @returns {Promise<Object>} Created audit log
   */
  async createAuditLog(logData) {
    try {
      return await AuditLog.create(logData);
    } catch (error) {
      console.error('Audit log creation error:', error);
      // Don't throw to avoid disrupting the main flow
      return null;
    }
  },
  
  /**
   * Middleware to log resource access
   * @param {string} resource - Resource type being accessed
   * @returns {Function} Middleware function
   */
  logAccess: (resource) => {
    return async (req, res, next) => {
      try {
        if (!req.user) {
          return next();
        }
        
        const resourceId = req.params.id;
        
        // Create audit in background without blocking request
        auditMiddleware.createAuditLog({
          userId: req.user._id,
          action: 'view',
          resource,
          resourceId: resourceId || null,
          details: {
            method: req.method,
            path: req.path,
            query: req.query
          }
        }).catch(err => console.error('Background audit logging error:', err));
        
        next();
      } catch (error) {
        // Continue even if audit logging fails
        console.error('Audit middleware error:', error);
        next();
      }
    };
  },
  
  /**
   * Middleware to log resource creation
   * @param {string} resource - Resource type being created
   * @returns {Function} Middleware function
   */
  logCreation: (resource) => {
    return async (req, res, next) => {
      // Store original end function
      const originalEnd = res.end;
      
      // Override end function to capture response
      res.end = function(chunk, encoding) {
        // Restore original end function
        res.end = originalEnd;
        
        // Call original end function
        res.end(chunk, encoding);
        
        // Only log successful creations
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          // Parse response to get created resource ID
          try {
            // If the response is JSON and contains a data property with an _id
            const responseBody = res._responseBody;
            const parsedBody = responseBody ? JSON.parse(responseBody) : {};
            const resourceId = parsedBody.data?._id || null;
            
            // Create audit log
            auditMiddleware.createAuditLog({
              userId: req.user._id,
              action: 'create',
              resource,
              resourceId,
              details: {
                requestBody: req.body
              }
            }).catch(err => console.error('Background audit logging error:', err));
          } catch (error) {
            console.error('Audit response parsing error:', error);
          }
        }
      };
      
      // Capture response body
      const originalWrite = res.write;
      const chunks = [];
      
      res.write = function(chunk) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        return originalWrite.apply(res, arguments);
      };
      
      res.on('finish', () => {
        if (chunks.length) {
          res._responseBody = Buffer.concat(chunks).toString('utf8');
        }
      });
      
      next();
    };
  },
  
  /**
   * Middleware to log resource updates
   * @param {string} resource - Resource type being updated
   * @returns {Function} Middleware function
   */
  logUpdate: (resource) => {
    return async (req, res, next) => {
      // Store the original end function
      const originalEnd = res.end;
      
      // Override end function
      res.end = function(chunk, encoding) {
        // Restore original end function
        res.end = originalEnd;
        
        // Call original end function
        res.end(chunk, encoding);
        
        // Only log successful updates
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          const resourceId = req.params.id;
          
          // Create audit log
          auditMiddleware.createAuditLog({
            userId: req.user._id,
            action: 'update',
            resource,
            resourceId,
            details: {
              updatedFields: Object.keys(req.body)
            }
          }).catch(err => console.error('Background audit logging error:', err));
        }
      };
      
      next();
    };
  },
  
  /**
   * Middleware to log resource deletion
   * @param {string} resource - Resource type being deleted
   * @returns {Function} Middleware function
   */
  logDeletion: (resource) => {
    return async (req, res, next) => {
      // Store the original end function
      const originalEnd = res.end;
      
      // Override end function
      res.end = function(chunk, encoding) {
        // Restore original end function
        res.end = originalEnd;
        
        // Call original end function
        res.end(chunk, encoding);
        
        // Only log successful deletions
        if (res.statusCode >= 200 && res.statusCode < 300 && req.user) {
          const resourceId = req.params.id;
          
          // Create audit log
          auditMiddleware.createAuditLog({
            userId: req.user._id,
            action: 'delete',
            resource,
            resourceId,
            details: {
              method: req.method,
              path: req.path
            }
          }).catch(err => console.error('Background audit logging error:', err));
        }
      };
      
      next();
    };
  },
  
  /**
   * Middleware to log authentication events
   * @param {string} action - Authentication action (login, logout, etc.)
   * @returns {Function} Middleware function
   */
  logAuth: (action) => {
    return async (req, res, next) => {
      // Store the original end function
      const originalEnd = res.end;
      
      // Override end function
      res.end = function(chunk, encoding) {
        // Restore original end function
        res.end = originalEnd;
        
        // Call original end function
        res.end(chunk, encoding);
        
        // Only log successful authentication events
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const userId = req.user ? req.user._id : (
            // For login, try to extract user ID from response
            action === 'login' && res._responseBody ? 
              JSON.parse(res._responseBody).user?._id : 
              null
          );
          
          if (userId) {
            // Create audit log
            auditMiddleware.createAuditLog({
              userId,
              action,
              resource: 'user',
              details: {
                ip: req.ip,
                userAgent: req.headers['user-agent']
              }
            }).catch(err => console.error('Background audit logging error:', err));
          }
        }
      };
      
      // Capture response body for login to extract user ID
      if (action === 'login') {
        const originalWrite = res.write;
        const chunks = [];
        
        res.write = function(chunk) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
          return originalWrite.apply(res, arguments);
        };
        
        res.on('finish', () => {
          if (chunks.length) {
            res._responseBody = Buffer.concat(chunks).toString('utf8');
          }
        });
      }
      
      next();
    };
  }
};

export default auditMiddleware;