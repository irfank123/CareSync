import { AppError, formatValidationErrors, globalErrorHandler } from '@src/utils/errorHandler.mjs';

// Mock console methods
global.console.error = jest.fn();
global.console.log = jest.fn(); // Although not directly used, good practice to mock if tests might trigger it indirectly

describe('Error Handling Utilities', () => {

  // --- Mocks for req, res, next ---
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      id: 'test-req-id',
      originalUrl: '/test/path',
      method: 'GET',
      ip: '127.0.0.1',
      user: { _id: 'user-123' }, // Mock user property
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();

    // Clear console mocks
    console.error.mockClear();
    console.log.mockClear();
  });

  afterAll(() => {
    // Restore console
    if (global.console.error.mockRestore) global.console.error.mockRestore();
    if (global.console.log.mockRestore) global.console.log.mockRestore();
  });

  // --- Tests for AppError ---
  describe('AppError', () => {
    test('should create an error instance with correct properties', () => {
      const message = 'Test operational error';
      const statusCode = 404;
      const error = new AppError(message, statusCode);

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
      expect(error.message).toBe(message);
      expect(error.statusCode).toBe(statusCode);
      expect(error.status).toBe('fail'); // 4xx status codes
      expect(error.isOperational).toBe(true);
      expect(error.stack).toBeDefined();
    });

    test('should set status to "error" for 5xx status codes', () => {
      const error = new AppError('Server error', 500);
      expect(error.status).toBe('error');
    });
  });

  // --- Tests for formatValidationErrors ---
  describe('formatValidationErrors', () => {
    test('should format express-validator errors correctly', () => {
      const validationErrors = [
        { param: 'email', msg: 'Invalid email format' },
        { param: 'password', msg: 'Password too short' },
      ];
      const formatted = formatValidationErrors(validationErrors);

      expect(formatted).toEqual({
        success: false,
        status: 'fail',
        statusCode: 400,
        message: 'Validation failed',
        errors: {
          email: 'Invalid email format',
          password: 'Password too short',
        },
      });
    });
  });

  // --- Tests for globalErrorHandler ---
  describe('globalErrorHandler', () => {
    let originalNodeEnv;

    beforeAll(() => {
      originalNodeEnv = process.env.NODE_ENV;
    });

    afterAll(() => {
      process.env.NODE_ENV = originalNodeEnv;
    });

    // Helper to test different error types
    const testErrorHandler = (env, errorInput, expectedStatusCode, expectedResponsePartial) => {
      process.env.NODE_ENV = env;
      globalErrorHandler(errorInput, mockReq, mockRes, mockNext);
      expect(mockRes.status).toHaveBeenCalledWith(expectedStatusCode);
      expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining(expectedResponsePartial));
      expect(console.error).toHaveBeenCalled(); // Basic check that logging occurred
    };

    // --- Development Environment Tests ---
    describe('Development Environment', () => {
      const env = 'development';

      test('should send detailed AppError in dev', () => {
        const error = new AppError('Resource not found', 404);
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(404);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Resource not found',
          error: expect.objectContaining({
            message: 'Resource not found',
            statusCode: 404,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
        expect(console.error).toHaveBeenCalled();
      });

      test('should send detailed generic Error in dev (default 500)', () => {
        const error = new Error('Something broke');
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(500);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Something broke',
          error: expect.objectContaining({
            message: 'Something broke',
            statusCode: 500
          }),
          stack: expect.any(String),
        }));
        expect(console.error).toHaveBeenCalled();
      });

      test('should handle CastError in dev', () => {
        const error = new Error('Cast to ObjectId failed');
        error.name = 'CastError';
        error.path = 'userId';
        error.value = 'badId';
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Invalid userId: badId',
          error: expect.objectContaining({
            message: 'Invalid userId: badId',
            statusCode: 400,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
      });
      
      test('should handle ValidationError in dev', () => {
        const error = new Error('Validation Failed');
        error.name = 'ValidationError';
        error.errors = { field1: { message: 'msg1'}, field2: { message: 'msg2'}};
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Invalid input data. msg1. msg2',
           error: expect.objectContaining({
            message: 'Invalid input data. msg1. msg2',
            statusCode: 400,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
      });

      test('should handle Duplicate Key Error (11000) in dev', () => {
        const error = new Error('Duplicate key');
        error.code = 11000;
        error.keyValue = { email: 'test@test.com' };
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(400);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Duplicate field value: test@test.com. Please use another value for email.',
          error: expect.objectContaining({
            message: 'Duplicate field value: test@test.com. Please use another value for email.',
            statusCode: 400,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
      });
      
      test('should handle JsonWebTokenError in dev', () => {
        const error = new Error('jwt malformed');
        error.name = 'JsonWebTokenError';
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
         expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Invalid token. Please log in again.',
           error: expect.objectContaining({
            message: 'Invalid token. Please log in again.',
            statusCode: 401,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
      });
      
       test('should handle TokenExpiredError in dev', () => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        process.env.NODE_ENV = env;
        globalErrorHandler(error, mockReq, mockRes, mockNext);
        expect(mockRes.status).toHaveBeenCalledWith(401);
        expect(mockRes.json).toHaveBeenCalledWith(expect.objectContaining({
          success: false,
          message: 'Your token has expired. Please log in again.',
           error: expect.objectContaining({
            message: 'Your token has expired. Please log in again.',
            statusCode: 401,
            status: 'fail',
            isOperational: true
          }),
          stack: expect.any(String),
        }));
      });
    });

    // --- Production Environment Tests ---
    describe('Production Environment', () => {
      const env = 'production';

      test('should send operational AppError message in prod', () => {
        const error = new AppError('User input invalid', 400);
        testErrorHandler(env, error, 400, {
          success: false,
          message: 'User input invalid',
        });
        // Should NOT include stack or full error object
        expect(mockRes.json.mock.calls[0][0].error).toBeUndefined();
        expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
      });

      test('should send generic message for non-operational errors in prod', () => {
        const error = new Error('Programming error details'); // Not an AppError, so isOperational is false
        testErrorHandler(env, error, 500, {
          success: false,
          message: 'Something went wrong',
        });
         // Should NOT include stack or full error object
        expect(mockRes.json.mock.calls[0][0].error).toBeUndefined();
        expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
      });
      
      test('should send operational message for CastError (converted to AppError) in prod', () => {
        const error = new Error('Cast to ObjectId failed');
        error.name = 'CastError';
        error.path = 'resourceId';
        error.value = 'badValue';
         testErrorHandler(env, error, 400, {
          success: false,
          message: 'Invalid resourceId: badValue',
        });
        expect(mockRes.json.mock.calls[0][0].error).toBeUndefined();
        expect(mockRes.json.mock.calls[0][0].stack).toBeUndefined();
      });
      
      // Add similar tests for ValidationError, 11000, JWT errors in production
      // They all get converted to AppError (isOperational=true), so should show their specific messages.
      test('should send operational message for ValidationError in prod', () => {
        const error = new Error('Validation Failed');
        error.name = 'ValidationError';
        error.errors = { field1: { message: 'msg1'}};
        testErrorHandler(env, error, 400, {
          success: false,
          message: 'Invalid input data. msg1',
        });
      });
      
      test('should send operational message for Duplicate Key Error (11000) in prod', () => {
        const error = new Error('Duplicate key');
        error.code = 11000;
        error.keyValue = { username: 'dupUser' };
        testErrorHandler(env, error, 400, {
          success: false,
          message: 'Duplicate field value: dupUser. Please use another value for username.',
        });
      });
      
      test('should send operational message for JsonWebTokenError in prod', () => {
        const error = new Error('jwt malformed');
        error.name = 'JsonWebTokenError';
        testErrorHandler(env, error, 401, {
          success: false,
          message: 'Invalid token. Please log in again.',
        });
      });
      
       test('should send operational message for TokenExpiredError in prod', () => {
        const error = new Error('jwt expired');
        error.name = 'TokenExpiredError';
        testErrorHandler(env, error, 401, {
          success: false,
          message: 'Your token has expired. Please log in again.',
        });
      });
      
    });
  });
}); 