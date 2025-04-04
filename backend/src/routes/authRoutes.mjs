// src/routes/authRoutes.mjs

import express from 'express';
import * as authController from '../controllers/authController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  auditMiddleware,
  rateLimitMiddleware 
} from '../middleware/index.mjs';

const router = express.Router();

// Rate limiting for auth routes
router.use(rateLimitMiddleware.authLimiter);

// Public routes
router.post(
  '/register',
  validationMiddleware.validate(validationMiddleware.chains.registerUser),
  auditMiddleware.logAuth('register'),
  authController.register
);

router.post(
  '/login',
  authMiddleware.trackLoginAttempts,
  validationMiddleware.validate(validationMiddleware.chains.login),
  auditMiddleware.logAuth('login'),
  authController.login
);

router.post(
  '/verify-mfa',
  validationMiddleware.validate(authController.mfaValidation),
  auditMiddleware.logAuth('verify-mfa'),
  authController.verifyMfa
);

router.post(
  '/forgot-password',
  validationMiddleware.validate(authController.forgotPasswordValidation),
  authController.forgotPassword
);

router.put(
  '/reset-password/:resetToken',
  validationMiddleware.validate(authController.resetPasswordValidation),
  authController.resetPassword
);

router.post(
  '/verify-email',
  validationMiddleware.validate(authController.verifyEmailValidation),
  authController.verifyEmail
);

// Auth0 callback
router.post(
  '/auth0/callback',
  authMiddleware.verifyAuth0Token,
  auditMiddleware.logAuth('auth0-login'),
  authController.auth0Callback
);

// Protected routes
router.use(authMiddleware.authenticate); // All routes below this line require authentication

router.get(
  '/me', 
  auditMiddleware.logAccess('user-profile'),
  authController.getMe
);

router.post(
  '/logout',
  auditMiddleware.logAuth('logout'),
  authController.logout
);

router.post(
  '/update-password',
  validationMiddleware.validate(authController.updatePasswordValidation),
  authController.updatePassword
);

router.post(
  '/refresh-token',
  authController.refreshToken
);

router.post(
  '/toggle-mfa',
  validationMiddleware.validate(authController.toggleMfaValidation),
  authController.toggleMfa
);

export default router;