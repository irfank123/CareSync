import express from 'express';
import request from 'supertest';
import authRoutes from '@src/routes/authRoutes.mjs';

// Mock dependencies
jest.mock('@src/controllers/authController.mjs', () => ({
  registerWithDI: jest.fn((req, res) => res.status(201).json({ message: 'User registered' })),
  loginWithDI: jest.fn((req, res) => res.status(200).json({ token: 'test-token' })),
  verifyMfaWithDI: jest.fn((req, res) => res.status(200).json({ token: 'mfa-token' })),
  auth0CallbackWithDI: jest.fn((req, res) => res.status(200).json({ token: 'auth0-token' })),
  logoutWithDI: jest.fn((req, res) => res.status(200).json({ message: 'Logged out' })),
  getMeWithDI: jest.fn((req, res) => res.status(200).json({ user: { id: '1', email: 'test@example.com' } })),
  forgotPasswordWithDI: jest.fn((req, res) => res.status(200).json({ message: 'Reset email sent' })),
  resetPasswordWithDI: jest.fn((req, res) => res.status(200).json({ message: 'Password reset' })),
  updatePasswordWithDI: jest.fn((req, res) => res.status(200).json({ message: 'Password updated' })),
  toggleMfaWithDI: jest.fn((req, res) => res.status(200).json({ mfaEnabled: true })),
  refreshTokenWithDI: jest.fn((req, res) => res.status(200).json({ token: 'new-token' })),
  verifyEmailWithDI: jest.fn((req, res) => res.status(200).json({ message: 'Email verified' })),
  registerValidation: {},
  loginValidation: {},
  mfaValidation: {},
  forgotPasswordValidation: {},
  resetPasswordValidation: {},
  updatePasswordValidation: {},
  toggleMfaValidation: {},
  verifyEmailValidation: {}
}));

jest.mock('@src/middleware/index.mjs', () => ({
  authMiddleware: {
    authenticate: jest.fn((req, res, next) => next()),
    trackLoginAttempts: jest.fn((req, res, next) => next()),
    verifyAuth0Token: jest.fn((req, res, next) => next())
  },
  validationMiddleware: {
    validate: jest.fn(() => (req, res, next) => next())
  },
  auditMiddleware: {
    logAuth: jest.fn(() => (req, res, next) => next()),
    logAccess: jest.fn(() => (req, res, next) => next())
  },
  rateLimitMiddleware: {
    authLimiter: jest.fn((req, res, next) => next())
  }
}));

describe('Auth Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', authRoutes);
  });

  describe('POST /register', () => {
    test('should return 201 when registration is successful', async () => {
      const response = await request(app)
        .post('/register')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('User registered');
    });
  });

  describe('POST /login', () => {
    test('should return 200 and token when login is successful', async () => {
      const response = await request(app)
        .post('/login')
        .send({ email: 'test@example.com', password: 'password123' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBe('test-token');
    });
  });

  describe('POST /verify-mfa', () => {
    test('should return 200 and token when MFA verification is successful', async () => {
      const response = await request(app)
        .post('/verify-mfa')
        .send({ userId: '1', code: '123456' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('token');
      expect(response.body.token).toBe('mfa-token');
    });
  });

  describe('POST /forgot-password', () => {
    test('should return 200 when reset email is sent', async () => {
      const response = await request(app)
        .post('/forgot-password')
        .send({ email: 'test@example.com' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Reset email sent');
    });
  });

  describe('PUT /reset-password/:resetToken', () => {
    test('should return 200 when password is reset', async () => {
      const response = await request(app)
        .put('/reset-password/test-token')
        .send({ password: 'newpassword123' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Password reset');
    });
  });

  describe('GET /me', () => {
    test('should return 200 and user data', async () => {
      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('user');
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user).toHaveProperty('email');
    });
  });
}); 