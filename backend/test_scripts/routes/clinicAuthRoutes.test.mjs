import express from 'express';
import request from 'supertest';
import clinicAuthRoutes from '@src/routes/clinicAuthRoutes.mjs';

// Mock controllers
jest.mock('@src/controllers/clinicAuthController.mjs', () => ({
  registerClinicWithDI: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 'newClinicId' } })),
  loginClinicWithDI: jest.fn((req, res) => res.status(200).json({ success: true, token: 'jwt-token' })),
  verifyClinicEmailWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Verification email sent' })),
  submitVerificationWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Verification submitted' })),
  getClinicProfileWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.user._id, name: 'Test Clinic' } })),
  forgotPasswordWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Password reset email sent' })),
  resetPasswordClinicWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Password has been reset' })),
  updatePasswordClinicWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Password updated' })),
  refreshTokenClinicWithDI: jest.fn((req, res) => res.status(200).json({ success: true, token: 'new-jwt-token' })),
  initiateClinicAuth0LoginWithDI: jest.fn((req, res) => res.redirect('https://auth0.com/authorize')),
  handleClinicAuth0CallbackWithDI: jest.fn((req, res) => res.redirect('/dashboard')),
  
  // Validation middleware mocks
  registerClinicValidation: jest.fn((req, res, next) => next()),
  loginClinicValidation: jest.fn((req, res, next) => next()),
  verifyEmailValidation: jest.fn((req, res, next) => next()),
  forgotPasswordClinicValidation: jest.fn((req, res, next) => next()),
  resetPasswordClinicValidation: jest.fn((req, res, next) => next()),
  updatePasswordClinicValidation: jest.fn((req, res, next) => next())
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // Define middleware functions
  const actualAuthenticateMiddleware = jest.fn();
  const actualCheckClinicStatusMiddleware = jest.fn();
  const actualLogAuthMiddleware = jest.fn();
  const actualLogAccessMiddleware = jest.fn();
  const actualLogUpdateMiddleware = jest.fn();
  const actualAuthLimiterMiddleware = jest.fn();

  // Factories
  const logAuthFactory = jest.fn((action) => actualLogAuthMiddleware);
  const logAccessFactory = jest.fn((resource) => actualLogAccessMiddleware);
  const logUpdateFactory = jest.fn((resource) => actualLogUpdateMiddleware);

  return {
    __esModule: true,
    authMiddleware: {
      authenticate: actualAuthenticateMiddleware,
      checkClinicStatus: actualCheckClinicStatusMiddleware
    },
    auditMiddleware: {
      logAuth: logAuthFactory,
      logAccess: logAccessFactory,
      logUpdate: logUpdateFactory
    },
    rateLimitMiddleware: {
      authLimiter: actualAuthLimiterMiddleware
    }
  };
});

describe('Clinic Auth Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks
    const { authMiddleware, auditMiddleware, rateLimitMiddleware } = require('@src/middleware/index.mjs');
    
    // Configure rate limiter
    rateLimitMiddleware.authLimiter.mockImplementation((req, res, next) => next());

    // Configure auth middleware
    authMiddleware.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'testClinicId', role: 'clinic', status: 'active' };
      next();
    });

    authMiddleware.checkClinicStatus.mockImplementation((req, res, next) => {
      if (req.user && req.user.status === 'active') {
        next();
      } else {
        res.status(403).json({
          success: false,
          message: 'Clinic account is not active'
        });
      }
    });

    // Configure audit middleware
    auditMiddleware.logAuth.mockImplementation((action) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Auth action ${action}`);
        next();
      });
    });

    auditMiddleware.logAccess.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Accessing ${resource}`);
        next();
      });
    });

    auditMiddleware.logUpdate.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Updating ${resource}`);
        next();
      });
    });

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/clinic-auth', clinicAuthRoutes);
  });

  // Public routes tests
  describe('POST /verify-email', () => {
    test('should request email verification and return 200', async () => {
      const verifyData = {
        email: 'clinic@test.com'
      };
      
      const response = await request(app)
        .post('/clinic-auth/verify-email')
        .send(verifyData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Verification email sent');

      const { rateLimitMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.verifyEmailValidation).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.verifyClinicEmailWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('POST /forgot-password', () => {
    test('should request password reset and return 200', async () => {
      const forgotData = {
        email: 'clinic@test.com'
      };
      
      const response = await request(app)
        .post('/clinic-auth/forgot-password')
        .send(forgotData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password reset email sent');

      const { rateLimitMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.forgotPasswordClinicValidation).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.forgotPasswordWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('PUT /reset-password/:resetToken', () => {
    test('should reset password and return 200', async () => {
      const resetToken = 'valid-reset-token';
      const resetData = {
        password: 'NewPassword123!',
        passwordConfirm: 'NewPassword123!'
      };
      
      const response = await request(app)
        .put(`/clinic-auth/reset-password/${resetToken}`)
        .send(resetData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password has been reset');

      const { rateLimitMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.resetPasswordClinicValidation).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.resetPasswordClinicWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('GET /clinic-auth0-return', () => {
    test('should handle Auth0 callback and redirect to dashboard', async () => {
      const response = await request(app)
        .get('/clinic-auth/clinic-auth0-return')
        .query({ code: 'auth0-code' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('/dashboard');

      const { rateLimitMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.handleClinicAuth0CallbackWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('POST /update-password', () => {
    test('should update password when authenticated and return 200', async () => {
      const passwordData = {
        currentPassword: 'OldPassword123!',
        newPassword: 'NewPassword123!',
        newPasswordConfirm: 'NewPassword123!'
      };
      
      const response = await request(app)
        .post('/clinic-auth/update-password')
        .send(passwordData)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Password updated');

      const { rateLimitMiddleware, authMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.updatePasswordClinicValidation).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.updatePasswordClinicWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('POST /refresh-token', () => {
    test('should refresh token when authenticated and return 200 with new token', async () => {
      const response = await request(app)
        .post('/clinic-auth/refresh-token')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.token).toBe('new-jwt-token');

      const { rateLimitMiddleware, authMiddleware } = require('@src/middleware/index.mjs');
      const clinicAuthController = require('@src/controllers/clinicAuthController.mjs');
      
      expect(rateLimitMiddleware.authLimiter).toHaveBeenCalledTimes(1);
      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(clinicAuthController.refreshTokenClinicWithDI).toHaveBeenCalledTimes(1);
    }, 10000);
  });
}); 