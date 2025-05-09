import { jest } from '@jest/globals';
import { AppError } from '../../src/utils/errorHandler.mjs';
import jwt from 'jsonwebtoken';

// Create mock chain methods that return the mock
const createMockChain = () => {
  const chain = {
    not: jest.fn().mockReturnValue(chain),
    isEmpty: jest.fn().mockReturnValue(chain),
    trim: jest.fn().mockReturnValue(chain),
    isEmail: jest.fn().mockReturnValue(chain),
    normalizeEmail: jest.fn().mockReturnValue(chain),
    isLength: jest.fn().mockReturnValue(chain),
    withMessage: jest.fn().mockReturnValue(chain),
    matches: jest.fn().mockReturnValue(chain),
    isIn: jest.fn().mockReturnValue(chain),
    isMobilePhone: jest.fn().mockReturnValue(chain),
    isBoolean: jest.fn().mockReturnValue(chain),
    optional: jest.fn().mockReturnValue(chain),
    isNumeric: jest.fn().mockReturnValue(chain),
    notEmpty: jest.fn().mockReturnValue(chain)
  };
  return chain;
};

// Mock modules first
jest.mock('express-validator', () => {
  // Create a function that returns an object with chainable methods
  const chainableMock = () => {
    // Define a function that returns itself to support chaining
    function chain() {
      return chain;
    }
    
    // Add methods that return the function
    chain.not = jest.fn().mockReturnValue(chain);
    chain.isEmpty = jest.fn().mockReturnValue(chain);
    chain.trim = jest.fn().mockReturnValue(chain);
    chain.isEmail = jest.fn().mockReturnValue(chain);
    chain.normalizeEmail = jest.fn().mockReturnValue(chain);
    chain.isLength = jest.fn().mockReturnValue(chain);
    chain.withMessage = jest.fn().mockReturnValue(chain);
    chain.matches = jest.fn().mockReturnValue(chain);
    chain.isIn = jest.fn().mockReturnValue(chain);
    chain.isMobilePhone = jest.fn().mockReturnValue(chain);
    chain.isBoolean = jest.fn().mockReturnValue(chain);
    chain.optional = jest.fn().mockReturnValue(chain);
    chain.isNumeric = jest.fn().mockReturnValue(chain);
    chain.notEmpty = jest.fn().mockReturnValue(chain);
    
    return chain;
  };
  
  return {
    validationResult: jest.fn(),
    check: jest.fn().mockImplementation(() => chainableMock())
  };
});

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-token'),
  decode: jest.fn().mockReturnValue({ 
    exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour from now
    id: 'user-id-123'
  })
}));

// Mock config
jest.mock('../../src/config/config.mjs', () => {
  return {
    __esModule: true,
    default: jest.fn().mockReturnValue({
      jwt: {
        secret: 'test-secret',
        expiresIn: '1h',
        cookieOptions: {
          maxAge: 24 * 60 * 60 * 1000, // 1 day
          secure: false
        }
      }
    })
  };
});

// Create mock services
const mockAuthService = {
  registerUser: jest.fn(),
  loginUser: jest.fn(),
  verifyMfa: jest.fn(),
  handleAuth0Login: jest.fn(),
  getUserProfile: jest.fn(),
  forgotPassword: jest.fn(),
  resetPassword: jest.fn(),
  updatePassword: jest.fn(),
  toggleMfa: jest.fn(),
  refreshToken: jest.fn(),
  verifyEmail: jest.fn()
};

const mockTokenBlacklistService = {
  addToBlacklist: jest.fn()
};

// Mock AuditLog import
jest.mock('../../src/models/index.mjs', () => ({
  AuditLog: {
    create: jest.fn()
  }
}));

// Import after mocks setup
import * as authController from '../../src/controllers/authController.mjs';

// Mock controllerHelper to inject services
jest.mock('../../src/utils/controllerHelper.mjs', () => ({
  withServices: jest.fn(fn => {
    return (req, res, next) => {
      const services = {
        authService: mockAuthService,
        tokenBlacklistService: mockTokenBlacklistService
      };
      return fn(req, res, next, services);
    };
  }),
  withServicesForController: jest.fn(controller => {
    const enhancedController = {};
    Object.keys(controller).forEach(methodName => {
      enhancedController[methodName] = (req, res, next) => {
        const services = {
          authService: mockAuthService,
          tokenBlacklistService: mockTokenBlacklistService
        };
        return controller[methodName](req, res, next, services);
      };
    });
    return enhancedController;
  })
}));

// Get a reference to the AuditLog mock for easier testing
const mockAuditLog = require('../../src/models/index.mjs').AuditLog;

describe('Auth Controller', () => {
  let req;
  let res;
  let next;
  let validationResultMock;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup request and response objects
    req = {
      body: {},
      user: {
        _id: 'user-id-123',
        role: 'patient'
      },
      cookies: {},
      headers: {
        authorization: 'Bearer test-token',
        'user-agent': 'test-user-agent'
      },
      ip: '127.0.0.1',
      params: {}
    };

    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      cookie: jest.fn()
    };

    next = jest.fn();

    // Setup validation result
    validationResultMock = {
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    };
    
    // Import express-validator and set the mock
    const { validationResult } = require('express-validator');
    validationResult.mockReturnValue(validationResultMock);
  });

  describe('register', () => {
    beforeEach(() => {
      req.body = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'Password123!',
        role: 'patient',
        phoneNumber: '1234567890'
      };

      mockAuthService.registerUser.mockResolvedValue({
        user: { _id: 'new-user-id', email: 'test@example.com' },
        roleSpecificRecord: { userId: 'new-user-id' },
        token: 'new-user-token'
      });
    });

    it('should register a new user successfully', async () => {
      await authController.registerWithDI(req, res, next);

      expect(mockAuthService.registerUser).toHaveBeenCalledWith(req.body, 'patient');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.cookie).toHaveBeenCalledWith('token', 'new-user-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'new-user-token',
        user: { _id: 'new-user-id', email: 'test@example.com' },
        roleData: null
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Email is required' }]);

      await authController.registerWithDI(req, res, next);

      expect(mockAuthService.registerUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('login', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        password: 'Password123!'
      };

      mockAuthService.loginUser.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'test@example.com' },
        token: 'login-token',
        roleData: { speciality: 'cardiology' }
      });
    });

    it('should login a user successfully', async () => {
      await authController.loginWithDI(req, res, next);

      expect(mockAuthService.loginUser).toHaveBeenCalledWith('test@example.com', 'Password123!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith('token', 'login-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'login-token',
        user: { _id: 'user-id-123', email: 'test@example.com' },
        roleData: { speciality: 'cardiology' }
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Email is required' }]);

      await authController.loginWithDI(req, res, next);

      expect(mockAuthService.loginUser).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });

    it('should handle MFA requirement', async () => {
      mockAuthService.loginUser.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'test@example.com' },
        requiresMfa: true
      });

      await authController.loginWithDI(req, res, next);

      expect(mockAuthService.loginUser).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        requiresMfa: true,
        user: { _id: 'user-id-123', email: 'test@example.com' }
      });
    });

    it('should handle unexpected errors', async () => {
      // Mock an error that's not handled by the inner try-catch
      req.body = null; // This will cause an error when trying to access req.body.email

      await authController.loginWithDI(req, res, next);

      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error during authentication'
      });
    });
  });

  describe('verifyMfa', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        mfaCode: '123456'
      };

      mockAuthService.verifyMfa.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'test@example.com' },
        token: 'mfa-token',
        roleData: { speciality: 'cardiology' }
      });
    });

    it('should verify MFA code successfully', async () => {
      await authController.verifyMfaWithDI(req, res, next);

      expect(mockAuthService.verifyMfa).toHaveBeenCalledWith('test@example.com', '123456');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith('token', 'mfa-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'mfa-token',
        user: { _id: 'user-id-123', email: 'test@example.com' },
        roleData: { speciality: 'cardiology' }
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'MFA code is required' }]);

      await authController.verifyMfaWithDI(req, res, next);

      expect(mockAuthService.verifyMfa).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('auth0Callback', () => {
    beforeEach(() => {
      req.body = {
        userType: 'patient'
      };
      req.auth0User = {
        sub: 'auth0|123',
        email: 'auth0@example.com'
      };

      mockAuthService.handleAuth0Login.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'auth0@example.com' },
        token: 'auth0-token'
      });
    });

    it('should handle Auth0 callback successfully', async () => {
      await authController.auth0CallbackWithDI(req, res, next);

      expect(mockAuthService.handleAuth0Login).toHaveBeenCalledWith(
        { sub: 'auth0|123', email: 'auth0@example.com' },
        'patient'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith('token', 'auth0-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'auth0-token',
        user: { _id: 'user-id-123', email: 'auth0@example.com' },
        roleData: null
      });
    });
  });

  describe('logout', () => {
    it('should logout user successfully with auth header token', async () => {
      await authController.logoutWithDI(req, res, next);

      expect(mockTokenBlacklistService.addToBlacklist).toHaveBeenCalledWith(
        'test-token',
        'user-id-123',
        expect.any(Date)
      );
      expect(mockAuditLog.create).toHaveBeenCalledWith({
        userId: 'user-id-123',
        action: 'logout',
        resource: 'user',
        details: {
          ip: '127.0.0.1',
          userAgent: 'test-user-agent'
        }
      });
      expect(res.cookie).toHaveBeenCalledWith('token', 'none', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });

    it('should logout user successfully with cookie token', async () => {
      req.headers.authorization = null;
      req.cookies.token = 'cookie-token';

      await authController.logoutWithDI(req, res, next);

      expect(mockTokenBlacklistService.addToBlacklist).toHaveBeenCalledWith(
        'cookie-token',
        'user-id-123',
        expect.any(Date)
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should handle successful logout even without a token', async () => {
      req.headers.authorization = null;
      req.cookies.token = null;

      await authController.logoutWithDI(req, res, next);

      expect(mockTokenBlacklistService.addToBlacklist).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Logged out successfully'
      });
    });
  });

  describe('getMe', () => {
    beforeEach(() => {
      mockAuthService.getUserProfile.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'test@example.com', role: 'patient' },
        roleData: { patientId: 'patient-123' }
      });
    });

    it('should get user profile successfully', async () => {
      await authController.getMeWithDI(req, res, next);

      expect(mockAuthService.getUserProfile).toHaveBeenCalledWith('user-id-123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        user: { _id: 'user-id-123', email: 'test@example.com', role: 'patient' },
        roleData: { patientId: 'patient-123' },
        role: 'patient'
      });
    });
  });

  describe('forgotPassword', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com'
      };
    });

    it('should handle forgot password request successfully', async () => {
      await authController.forgotPasswordWithDI(req, res, next);

      expect(mockAuthService.forgotPassword).toHaveBeenCalledWith('test@example.com');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'If an account with that email exists, a password reset link has been sent'
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Email is required' }]);

      await authController.forgotPasswordWithDI(req, res, next);

      expect(mockAuthService.forgotPassword).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('resetPassword', () => {
    beforeEach(() => {
      req.body = {
        password: 'NewPassword123!'
      };
      req.params = {
        resetToken: 'valid-reset-token'
      };

      mockAuthService.resetPassword.mockResolvedValue({
        user: { _id: 'user-id-123', email: 'test@example.com' },
        token: 'new-token'
      });
    });

    it('should reset password successfully', async () => {
      await authController.resetPasswordWithDI(req, res, next);

      expect(mockAuthService.resetPassword).toHaveBeenCalledWith('valid-reset-token', 'NewPassword123!');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.cookie).toHaveBeenCalledWith('token', 'new-token', expect.any(Object));
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'new-token',
        user: { _id: 'user-id-123', email: 'test@example.com' },
        roleData: null
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Password must be at least 8 characters' }]);

      await authController.resetPasswordWithDI(req, res, next);

      expect(mockAuthService.resetPassword).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updatePassword', () => {
    beforeEach(() => {
      req.body = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!'
      };
    });

    it('should update password successfully', async () => {
      await authController.updatePasswordWithDI(req, res, next);

      expect(mockAuthService.updatePassword).toHaveBeenCalledWith(
        'user-id-123',
        'OldPassword123!',
        'NewPassword123!'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Password updated successfully'
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Current password is required' }]);

      await authController.updatePasswordWithDI(req, res, next);

      expect(mockAuthService.updatePassword).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('toggleMfa', () => {
    beforeEach(() => {
      req.body = {
        enable: true,
        method: 'app'
      };

      mockAuthService.toggleMfa.mockResolvedValue({
        user: { 
          _id: 'user-id-123', 
          email: 'test@example.com',
          mfaEnabled: true,
          mfaMethod: 'app'
        }
      });
    });

    it('should enable MFA successfully', async () => {
      await authController.toggleMfaWithDI(req, res, next);

      expect(mockAuthService.toggleMfa).toHaveBeenCalledWith(
        'user-id-123',
        true,
        'app'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'MFA enabled successfully',
        user: { 
          _id: 'user-id-123', 
          email: 'test@example.com',
          mfaEnabled: true,
          mfaMethod: 'app'
        }
      });
    });

    it('should disable MFA successfully', async () => {
      req.body.enable = false;
      
      await authController.toggleMfaWithDI(req, res, next);

      expect(mockAuthService.toggleMfa).toHaveBeenCalledWith(
        'user-id-123',
        false,
        'app'
      );
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({
        message: 'MFA disabled successfully'
      }));
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Enable must be a boolean' }]);

      await authController.toggleMfaWithDI(req, res, next);

      expect(mockAuthService.toggleMfa).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('refreshToken', () => {
    beforeEach(() => {
      mockAuthService.refreshToken.mockReturnValue('refreshed-token');
    });

    it('should refresh token successfully', async () => {
      await authController.refreshTokenWithDI(req, res, next);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'user-id-123',
        'patient',
        {}
      );
      expect(res.cookie).toHaveBeenCalledWith('token', 'refreshed-token', expect.any(Object));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        token: 'refreshed-token'
      });
    });

    it('should pass clinicId if present in user object', async () => {
      req.user.clinicId = 'clinic-123';

      await authController.refreshTokenWithDI(req, res, next);

      expect(mockAuthService.refreshToken).toHaveBeenCalledWith(
        'user-id-123',
        'patient',
        { clinicId: 'clinic-123' }
      );
    });
  });

  describe('verifyEmail', () => {
    beforeEach(() => {
      req.body = {
        email: 'test@example.com',
        code: '123456'
      };
    });

    it('should verify email successfully', async () => {
      await authController.verifyEmailWithDI(req, res, next);

      expect(mockAuthService.verifyEmail).toHaveBeenCalledWith('test@example.com', '123456');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Email verified successfully'
      });
    });

    it('should handle validation errors', async () => {
      validationResultMock.isEmpty.mockReturnValue(false);
      validationResultMock.array.mockReturnValue([{ msg: 'Verification code is required' }]);

      await authController.verifyEmailWithDI(req, res, next);

      expect(mockAuthService.verifyEmail).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
}); 