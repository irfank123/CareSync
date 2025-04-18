// src/routes/authRoutes.mjs

import express from 'express';
import {
  registerWithDI,
  loginWithDI,
  verifyMfaWithDI,
  auth0CallbackWithDI,
  logoutWithDI,
  getMeWithDI,
  forgotPasswordWithDI,
  resetPasswordWithDI,
  updatePasswordWithDI,
  toggleMfaWithDI,
  refreshTokenWithDI,
  verifyEmailWithDI,
  registerValidation,
  loginValidation,
  mfaValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updatePasswordValidation,
  toggleMfaValidation,
  verifyEmailValidation
} from '../controllers/authController.mjs';
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
  validationMiddleware.validate(registerValidation),
  auditMiddleware.logAuth('register'),
  registerWithDI
);

router.post(
  '/login',
  authMiddleware.trackLoginAttempts,
  validationMiddleware.validate(loginValidation),
  auditMiddleware.logAuth('login'),
  loginWithDI
);

router.post(
  '/verify-mfa',
  validationMiddleware.validate(mfaValidation),
  auditMiddleware.logAuth('verify-mfa'),
  verifyMfaWithDI
);

router.post(
  '/forgot-password',
  validationMiddleware.validate(forgotPasswordValidation),
  forgotPasswordWithDI
);

router.put(
  '/reset-password/:resetToken',
  validationMiddleware.validate(resetPasswordValidation),
  resetPasswordWithDI
);

router.post(
  '/verify-email',
  validationMiddleware.validate(verifyEmailValidation),
  verifyEmailWithDI
);

// Auth0 callback
router.post(
  '/auth0/callback',
  authMiddleware.verifyAuth0Token,
  auditMiddleware.logAuth('auth0-login'),
  auth0CallbackWithDI
);

// Protected routes
router.use(authMiddleware.authenticate); // All routes below this line require authentication

router.get(
  '/me', 
  auditMiddleware.logAccess('user-profile'),
  getMeWithDI
);

router.post(
  '/logout',
  auditMiddleware.logAuth('logout'),
  logoutWithDI
);

router.post(
  '/update-password',
  validationMiddleware.validate(updatePasswordValidation),
  updatePasswordWithDI
);

router.post(
  '/refresh-token',
  refreshTokenWithDI
);

router.post(
  '/toggle-mfa',
  validationMiddleware.validate(toggleMfaValidation),
  toggleMfaWithDI
);

export default router;