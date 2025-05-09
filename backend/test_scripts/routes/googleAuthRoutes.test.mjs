import express from 'express';
import request from 'supertest';
import googleAuthRoutes from '@src/routes/googleAuthRoutes.mjs';

// Mock controllers
jest.mock('@src/controllers/googleAuthController.mjs', () => ({
  initiateGoogleAuth: jest.fn((req, res) => res.redirect('https://accounts.google.com/o/oauth2/auth')),
  handleGoogleAuthCallback: jest.fn((req, res) => res.redirect('/dashboard'))
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // Define middleware functions
  const actualValidateAuth0TokenMiddleware = jest.fn();

  return {
    __esModule: true,
    authMiddleware: {
      validateAuth0Token: actualValidateAuth0TokenMiddleware
    }
  };
});

describe('Google Auth Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks
    const { authMiddleware } = require('@src/middleware/index.mjs');
    
    // Configure auth middleware
    authMiddleware.validateAuth0Token.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'patient' };
      next();
    });

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/google-auth', googleAuthRoutes);
  });

  describe('GET /initiate', () => {
    test('should initiate Google OAuth flow and redirect when authenticated', async () => {
      const response = await request(app)
        .get('/google-auth/initiate')
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('https://accounts.google.com/o/oauth2/auth');

      const { authMiddleware } = require('@src/middleware/index.mjs');
      const googleAuthController = require('@src/controllers/googleAuthController.mjs');
      
      expect(authMiddleware.validateAuth0Token).toHaveBeenCalledTimes(1);
      expect(googleAuthController.initiateGoogleAuth).toHaveBeenCalledTimes(1);
    }, 10000);

    test('should return 401 when not authenticated', async () => {
      const { authMiddleware } = require('@src/middleware/index.mjs');
      
      // Mock auth middleware to simulate failed authentication
      authMiddleware.validateAuth0Token.mockImplementationOnce((req, res, next) => {
        return res.status(401).json({
          success: false,
          message: 'Authentication failed'
        });
      });

      const response = await request(app)
        .get('/google-auth/initiate')
        .expect('Content-Type', /json/)
        .expect(401);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Authentication failed');

      expect(authMiddleware.validateAuth0Token).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('GET /callback', () => {
    test('should handle Google OAuth callback and redirect to dashboard', async () => {
      const response = await request(app)
        .get('/google-auth/callback')
        .query({ code: 'google-auth-code' })
        .expect(302); // Expect redirect

      expect(response.header.location).toBe('/dashboard');

      const googleAuthController = require('@src/controllers/googleAuthController.mjs');
      expect(googleAuthController.handleGoogleAuthCallback).toHaveBeenCalledTimes(1);
    }, 10000);

    test('should handle Google OAuth callback error', async () => {
      const googleAuthController = require('@src/controllers/googleAuthController.mjs');
      
      // Mock controller to simulate an error
      googleAuthController.handleGoogleAuthCallback.mockImplementationOnce((req, res) => {
        return res.status(400).json({
          success: false,
          message: 'Invalid authorization code'
        });
      });

      const response = await request(app)
        .get('/google-auth/callback')
        .query({ error: 'access_denied' })
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid authorization code');

      expect(googleAuthController.handleGoogleAuthCallback).toHaveBeenCalledTimes(1);
    }, 10000);
  });
}); 