// src/routes/clinicAuthRoutes.mjs

import express from 'express';
import * as clinicAuthController from '../controllers/clinicAuthController.mjs';
import { 
  authMiddleware, 
  auditMiddleware,
  rateLimitMiddleware 
} from '../middleware/index.mjs';

const router = express.Router();

// Rate limiting for auth routes
router.use(rateLimitMiddleware.authLimiter);

// Public routes
router.post(
  '/register',
  clinicAuthController.registerClinicValidation,
  auditMiddleware.logAuth('clinic-register'),
  clinicAuthController.registerClinic
);

router.post(
  '/login',
  clinicAuthController.loginClinicValidation,
  auditMiddleware.logAuth('clinic-login'),
  clinicAuthController.loginClinic
);

router.post(
  '/verify-email',
  clinicAuthController.verifyEmailValidation,
  clinicAuthController.verifyClinicEmail
);

router.post(
  '/forgot-password',
  clinicAuthController.forgotPasswordClinicValidation,
  clinicAuthController.forgotPassword
);

router.put(
  '/reset-password/:resetToken',
  clinicAuthController.resetPasswordClinicValidation,
  clinicAuthController.resetPasswordClinic
);

// Protected routes
router.use(authMiddleware.authenticate); // All routes below this line require authentication

router.get(
  '/me',
  auditMiddleware.logAccess('clinic-profile'),
  clinicAuthController.getClinicProfile
);

router.post(
  '/submit-verification',
  auditMiddleware.logUpdate('clinic-verification'),
  clinicAuthController.submitVerification
);

router.post(
  '/update-password',
  clinicAuthController.updatePasswordClinicValidation,
  clinicAuthController.updatePasswordClinic
);

router.post(
  '/refresh-token',
  clinicAuthController.refreshTokenClinic
);

export default router;