import mongoose from 'mongoose';
import { AppError } from '../../src/utils/errorHandler.mjs';
import errorMiddleware from '../../src/middleware/error/errorMiddleware.mjs';

// Save original console.error to restore after tests
const originalConsoleError = console.error;

describe('errorMiddleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Mock Express request, response and next function
    req = {
      method: 'GET',
      originalUrl: '/api/test',
      ip: '127.0.0.1',
      user: { _id: 'user123' },
      id: 'req-123'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Mock console.error to avoid cluttering test output
    console.error = jest.fn();
  });
  
  afterEach(() => {
    // Restore console.error
    console.error = originalConsoleError;
  });
  
  describe('catchAsync', () => {
    it('should pass the error to next() when the function throws', async () => {
      const error = new Error('Test error');
      const asyncFn = jest.fn().mockRejectedValue(error);
      const middleware = errorMiddleware.catchAsync(asyncFn);
      
      await middleware(req, res, next);
      
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).toHaveBeenCalledWith(error);
    });
    
    it('should not call next() with an error when the function resolves', async () => {
      const asyncFn = jest.fn().mockResolvedValue('success');
      const middleware = errorMiddleware.catchAsync(asyncFn);
      
      await middleware(req, res, next);
      
      expect(asyncFn).toHaveBeenCalledWith(req, res, next);
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe('handleCastError', () => {
    it('should return an AppError with status code 400', () => {
      const err = {
        path: '_id',
        value: 'invalid-id'
      };
      
      const result = errorMiddleware.handleCastError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(400);
      expect(result.message).toBe('Invalid _id: invalid-id');
    });
  });
  
  describe('handleValidationError', () => {
    it('should return an AppError with status code 400', () => {
      const err = {
        errors: {
          name: { message: 'Name is required' },
          email: { message: 'Email is invalid' }
        }
      };
      
      const result = errorMiddleware.handleValidationError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('Name is required');
      expect(result.message).toContain('Email is invalid');
    });
  });
  
  describe('handleDuplicateKeyError', () => {
    it('should return an AppError with status code 400', () => {
      const err = {
        keyValue: { email: 'test@example.com' }
      };
      
      const result = errorMiddleware.handleDuplicateKeyError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(400);
      expect(result.message).toContain('Duplicate value for \'email\': test@example.com');
    });
  });
  
  describe('handleJwtError', () => {
    it('should return AppError with status 401 for JsonWebTokenError', () => {
      const err = {
        name: 'JsonWebTokenError'
      };
      
      const result = errorMiddleware.handleJwtError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Invalid authentication token. Please log in again.');
    });
    
    it('should return AppError with status 401 for TokenExpiredError', () => {
      const err = {
        name: 'TokenExpiredError'
      };
      
      const result = errorMiddleware.handleJwtError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Your authentication token has expired. Please log in again.');
    });
    
    it('should return AppError with status 401 for other JWT errors', () => {
      const err = {
        name: 'OtherJwtError'
      };
      
      const result = errorMiddleware.handleJwtError(err);
      
      expect(result).toBeInstanceOf(AppError);
      expect(result.statusCode).toBe(401);
      expect(result.message).toBe('Authentication failed');
    });
  });
  
  describe('sendErrorDev', () => {
    it('should send detailed error response in development', () => {
      const err = new AppError('Test error', 400);
      err.stack = 'Error stack';
      
      errorMiddleware.sendErrorDev(err, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 'fail',
        message: 'Test error',
        stack: 'Error stack',
        error: err
      });
    });
    
    it('should use status code 500 if not specified', () => {
      const err = new Error('Test error');
      
      errorMiddleware.sendErrorDev(err, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });
  
  describe('sendErrorProd', () => {
    it('should send error message for operational errors', () => {
      const err = new AppError('Test error', 400);
      err.isOperational = true;
      
      errorMiddleware.sendErrorProd(err, res);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 'fail',
        message: 'Test error'
      });
    });
    
    it('should send generic error message for non-operational errors', () => {
      const err = new Error('Test error');
      
      errorMiddleware.sendErrorProd(err, res);
      
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        status: 'error',
        message: 'Something went wrong on the server'
      });
      expect(console.error).toHaveBeenCalled();
    });
  });
  
  describe('globalErrorHandler', () => {
    beforeEach(() => {
      // Mock process.env.NODE_ENV
      process.env.NODE_ENV = 'development';
    });
    
    it('should handle CastError', () => {
      const err = new Error('Cast error');
      err.name = 'CastError';
      err.path = '_id';
      err.value = 'invalid-id';
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].message).toContain('Invalid _id: invalid-id');
    });
    
    it('should handle ValidationError', () => {
      const err = new Error('Validation error');
      err.name = 'ValidationError';
      err.errors = {
        name: { message: 'Name is required' }
      };
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].message).toContain('Name is required');
    });
    
    it('should handle duplicate key error', () => {
      const err = new Error('Duplicate key error');
      err.code = 11000;
      err.keyValue = { email: 'test@example.com' };
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].message).toContain('Duplicate value for \'email\': test@example.com');
    });
    
    it('should handle JWT errors', () => {
      const err = new Error('JWT error');
      err.name = 'JsonWebTokenError';
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalled();
      expect(res.json.mock.calls[0][0].message).toContain('Invalid authentication token');
    });
    
    it('should use development error handler in development mode', () => {
      process.env.NODE_ENV = 'development';
      const err = new Error('Test error');
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.json.mock.calls[0][0]).toHaveProperty('stack');
    });
    
    it('should use production error handler in production mode', () => {
      process.env.NODE_ENV = 'production';
      const err = new Error('Test error');
      
      errorMiddleware.globalErrorHandler(err, req, res, next);
      
      expect(res.json.mock.calls[0][0]).not.toHaveProperty('stack');
    });
  });
  
  describe('notFound', () => {
    it('should create a 404 error and pass it to next()', () => {
      errorMiddleware.notFound(req, res, next);
      
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(404);
      expect(error.message).toContain('Cannot find GET /api/test on this server');
    });
  });
  
  describe('payloadTooLarge', () => {
    it('should handle entity too large errors', () => {
      const err = new Error('Request entity too large');
      err.type = 'entity.too.large';
      
      errorMiddleware.payloadTooLarge(err, req, res, next);
      
      expect(next).toHaveBeenCalled();
      const error = next.mock.calls[0][0];
      expect(error).toBeInstanceOf(AppError);
      expect(error.statusCode).toBe(413);
      expect(error.message).toBe('Request entity too large');
    });
    
    it('should pass other errors to next()', () => {
      const err = new Error('Other error');
      
      errorMiddleware.payloadTooLarge(err, req, res, next);
      
      expect(next).toHaveBeenCalledWith(err);
    });
  });
}); 