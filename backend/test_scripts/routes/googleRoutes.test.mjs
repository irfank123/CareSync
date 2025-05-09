import express from 'express';
import request from 'supertest';
import googleRoutes from '@src/routes/googleRoutes.mjs';

// Mock services
jest.mock('@src/services/googleService.mjs', () => ({
  __esModule: true,
  default: {
    generateAuthUrl: jest.fn((userId) => `https://accounts.google.com/o/oauth2/auth?state=${userId}`),
    getTokensFromCode: jest.fn((code) => Promise.resolve({ 
      access_token: 'fake-access-token', 
      refresh_token: 'fake-refresh-token', 
      id_token: 'fake-id-token' 
    })),
    saveRefreshToken: jest.fn((userId, refreshToken) => Promise.resolve(true))
  }
}));

// Mock controllers
jest.mock('@src/controllers/googleAuthController.mjs', () => ({
  __esModule: true,
  default: {
    getGoogleAuthUrl: jest.fn((req, res) => res.status(200).json({ 
      success: true, 
      url: 'https://accounts.google.com/o/oauth2/auth' 
    })),
    handleGoogleAuthCallback: jest.fn((req, res) => res.redirect('/dashboard')),
    createMeetLinkForAppointment: jest.fn((req, res) => res.status(201).json({ 
      success: true, 
      meetLink: 'https://meet.google.com/abc-defg-hij' 
    })),
    createMeetLinkWithToken: jest.fn((req, res) => res.status(201).json({ 
      success: true, 
      meetLink: 'https://meet.google.com/xyz-uvwx-rst' 
    }))
  }
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // Define middleware functions
  const actualAuthenticateMiddleware = jest.fn();
  const actualProtectMiddleware = jest.fn();
  const actualRestrictToMiddleware = jest.fn();

  // Factories
  const restrictToFactory = jest.fn((...roles) => actualRestrictToMiddleware);

  return {
    __esModule: true,
    authMiddleware: {
      authenticate: actualAuthenticateMiddleware,
      protect: actualProtectMiddleware,
      restrictTo: restrictToFactory
    }
  };
});

// Mock error handler
jest.mock('@src/utils/errorHandler.mjs', () => ({
  __esModule: true,
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
    }
  }
}));

// Mock config
jest.mock('@src/config/config.mjs', () => ({
  __esModule: true,
  default: {
    frontendUrl: 'http://localhost:3000'
  }
}));

describe('Google Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks
    const { authMiddleware } = require('@src/middleware/index.mjs');
    
    // Configure auth middleware
    authMiddleware.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'doctor' };
      next();
    });

    authMiddleware.protect.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'admin' };
      next();
    });

    authMiddleware.restrictTo.mockImplementation((...expectedRoles) => {
      return jest.fn((req, res, next) => {
        if (req.user && expectedRoles.includes(req.user.role)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            message: 'You do not have permission to perform this action'
          });
        }
      });
    });

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/google', googleRoutes);
  });

  describe('GET /connect', () => {
    test('should redirect to Google consent screen when authenticated', async () => {
      const response = await request(app)
        .get('/google/connect')
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('https://accounts.google.com/o/oauth2/auth?state=testUserId');

      const { authMiddleware } = require('@src/middleware/index.mjs');
      const googleService = require('@src/services/googleService.mjs').default;
      
      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(googleService.generateAuthUrl).toHaveBeenCalledWith('testUserId');
    }, 10000);

    test('should return 401 when not authenticated', async () => {
      const { authMiddleware } = require('@src/middleware/index.mjs');
      
      // Mock auth middleware to simulate failed authentication
      authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        return res.status(401).json({
          success: false,
          message: 'Authentication required'
        });
      });

      const response = await request(app)
        .get('/google/connect')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication required');

      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('GET /callback', () => {
    test('should handle successful Google callback and redirect to settings page', async () => {
      const response = await request(app)
        .get('/google/callback')
        .query({ code: 'auth-code', state: 'testUserId' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('http://localhost:3000/settings?google_connected=true');

      const googleService = require('@src/services/googleService.mjs').default;
      
      expect(googleService.getTokensFromCode).toHaveBeenCalledWith('auth-code');
      expect(googleService.saveRefreshToken).toHaveBeenCalledWith('testUserId', 'fake-refresh-token');
    }, 10000);

    test('should handle missing code and return 400', async () => {
      const response = await request(app)
        .get('/google/callback')
        .query({ state: 'testUserId' })
        .expect(400);

      expect(response.text).toBe('Authorization code missing from Google callback');
    }, 10000);

    test('should handle missing state and redirect with error', async () => {
      const response = await request(app)
        .get('/google/callback')
        .query({ code: 'auth-code' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('http://localhost:3000/settings?google_connected=false&error=state_missing');
    }, 10000);

    test('should handle case when no refresh token is received', async () => {
      const googleService = require('@src/services/googleService.mjs').default;
      
      // Mock no refresh token in response
      googleService.getTokensFromCode.mockResolvedValueOnce({ 
        access_token: 'fake-access-token', 
        id_token: 'fake-id-token' 
      });

      const response = await request(app)
        .get('/google/callback')
        .query({ code: 'auth-code', state: 'testUserId' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('http://localhost:3000/settings?google_connected=partial');
      expect(googleService.saveRefreshToken).not.toHaveBeenCalled();
    }, 10000);

    test('should handle API errors and redirect with error message', async () => {
      const googleService = require('@src/services/googleService.mjs').default;
      
      // Mock API error
      googleService.getTokensFromCode.mockRejectedValueOnce(new Error('API Error'));

      const response = await request(app)
        .get('/google/callback')
        .query({ code: 'auth-code', state: 'testUserId' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('http://localhost:3000/settings?google_connected=false&error=API%20Error');
    }, 10000);
  });

  describe('GET /auth/callback', () => {
    test('should handle Google auth callback and redirect to dashboard', async () => {
      const response = await request(app)
        .get('/google/auth/callback')
        .query({ code: 'auth-code', state: 'some-state' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('/dashboard');

      const googleAuthController = require('@src/controllers/googleAuthController.mjs').default;
      expect(googleAuthController.handleGoogleAuthCallback).toHaveBeenCalledTimes(1);
    }, 10000);
  });
}); 