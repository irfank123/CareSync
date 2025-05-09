import auditMiddleware from '../../src/middleware/audit/auditMiddleware.mjs';
import { AuditLog } from '../../src/models/index.mjs';

// Mock the dependencies
jest.mock('../../src/models/index.mjs', () => ({
  AuditLog: {
    create: jest.fn()
  }
}));

describe('auditMiddleware', () => {
  let req;
  let res;
  let next;
  let consoleErrorSpy;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Set up console.error spy
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    
    // Mock Express request, response and next function
    req = {
      user: { _id: 'user123', role: 'doctor' },
      method: 'GET',
      path: '/api/test',
      params: { id: 'resource123' },
      query: { limit: 10 },
      body: { field1: 'value1' },
      ip: '127.0.0.1',
      headers: {
        'user-agent': 'Test User Agent'
      }
    };
    
    res = {
      statusCode: 200,
      end: jest.fn(),
      write: jest.fn(),
      on: jest.fn(),
      _responseBody: JSON.stringify({
        success: true,
        data: {
          _id: 'resource123'
        }
      })
    };
    
    next = jest.fn();
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  describe('createAuditLog', () => {
    it('should create an audit log entry', async () => {
      const logData = {
        userId: 'user123',
        action: 'test',
        resource: 'testResource'
      };
      
      AuditLog.create.mockResolvedValueOnce({ ...logData, _id: 'log123' });
      
      const result = await auditMiddleware.createAuditLog(logData);
      
      expect(AuditLog.create).toHaveBeenCalledWith(logData);
      expect(result).toMatchObject({ _id: 'log123', ...logData });
    });

    it('should handle errors without throwing', async () => {
      const logData = {
        userId: 'user123',
        action: 'test',
        resource: 'testResource'
      };
      
      const error = new Error('Database error');
      AuditLog.create.mockRejectedValueOnce(error);
      
      await auditMiddleware.createAuditLog(logData);
      
      expect(AuditLog.create).toHaveBeenCalledWith(logData);
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe('Audit log creation error:');
      expect(consoleErrorSpy.mock.calls[0][1]).toEqual(error);
    });
  });

  describe('logAccess', () => {
    it('should create an audit log for resource access', async () => {
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logAccess('testResource');
      await middleware(req, res, next);
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'view',
        resource: 'testResource',
        resourceId: 'resource123',
        details: {
          method: 'GET',
          path: '/api/test',
          query: { limit: 10 }
        }
      });
      expect(next).toHaveBeenCalled();
    });

    it('should skip audit logging if user is not authenticated', async () => {
      // Set user to null to simulate unauthenticated request
      req.user = null;
      
      const middleware = auditMiddleware.logAccess('testResource');
      await middleware(req, res, next);
      
      expect(auditMiddleware.createAuditLog).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });

    it('should continue to next middleware even if audit logging fails', async () => {
      // Mock createAuditLog to reject
      jest.spyOn(auditMiddleware, 'createAuditLog').mockRejectedValueOnce(new Error('Audit error'));
      
      const middleware = auditMiddleware.logAccess('testResource');
      await middleware(req, res, next);
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe('Audit middleware error:');
      expect(next).toHaveBeenCalled();
    });
  });

  describe('logCreation', () => {
    it('should override res.end to log resource creation', async () => {
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logCreation('testResource');
      await middleware(req, res, next);
      
      // Should have modified res.end and res.write
      expect(res.end).not.toBe(jest.fn());
      expect(res.write).not.toBe(jest.fn());
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'create',
        resource: 'testResource',
        resourceId: 'resource123',
        details: {
          requestBody: { field1: 'value1' }
        }
      });
    });

    it('should not log creation for failed requests', async () => {
      // Set status code to error
      res.statusCode = 400;
      
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logCreation('testResource');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).not.toHaveBeenCalled();
    });

    it('should handle parsing errors without blocking the request', async () => {
      // Set invalid JSON
      res._responseBody = '{invalid json}';
      
      const middleware = auditMiddleware.logCreation('testResource');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(consoleErrorSpy).toHaveBeenCalled();
      expect(consoleErrorSpy.mock.calls[0][0]).toBe('Audit response parsing error:');
    });
  });

  describe('logUpdate', () => {
    it('should override res.end to log resource updates', async () => {
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logUpdate('testResource');
      await middleware(req, res, next);
      
      // Should have modified res.end
      expect(res.end).not.toBe(jest.fn());
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'update',
        resource: 'testResource',
        resourceId: 'resource123',
        details: {
          updatedFields: ['field1']
        }
      });
    });

    it('should not log updates for failed requests', async () => {
      // Set status code to error
      res.statusCode = 400;
      
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logUpdate('testResource');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('logDeletion', () => {
    it('should override res.end to log resource deletion', async () => {
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logDeletion('testResource');
      await middleware(req, res, next);
      
      // Should have modified res.end
      expect(res.end).not.toBe(jest.fn());
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'delete',
        resource: 'testResource',
        resourceId: 'resource123',
        details: {
          method: 'GET',
          path: '/api/test'
        }
      });
    });

    it('should not log deletion for failed requests', async () => {
      // Set status code to error
      res.statusCode = 400;
      
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logDeletion('testResource');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).not.toHaveBeenCalled();
    });
  });

  describe('logAuth', () => {
    it('should override res.end to log authentication events', async () => {
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logAuth('login');
      await middleware(req, res, next);
      
      // Should have modified res.end
      expect(res.end).not.toBe(jest.fn());
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user123',
        action: 'login',
        resource: 'user',
        details: {
          ip: '127.0.0.1',
          userAgent: 'Test User Agent'
        }
      });
    });

    it('should extract userId from response for login when req.user is not available', async () => {
      // Remove req.user to simulate login request
      req.user = null;
      res._responseBody = JSON.stringify({
        user: { _id: 'user456' }
      });
      
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logAuth('login');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).toHaveBeenCalledWith({
        userId: 'user456',
        action: 'login',
        resource: 'user',
        details: {
          ip: '127.0.0.1',
          userAgent: 'Test User Agent'
        }
      });
    });

    it('should not log authentication events for failed requests', async () => {
      // Set status code to error
      res.statusCode = 401;
      
      // Mock createAuditLog to resolve immediately
      jest.spyOn(auditMiddleware, 'createAuditLog').mockResolvedValueOnce({});
      
      const middleware = auditMiddleware.logAuth('login');
      await middleware(req, res, next);
      
      // Call the modified res.end function
      res.end('chunk', 'utf-8');
      
      expect(auditMiddleware.createAuditLog).not.toHaveBeenCalled();
    });
  });
}); 