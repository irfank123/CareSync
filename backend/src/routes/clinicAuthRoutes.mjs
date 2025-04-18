// src/routes/clinicAuthRoutes.mjs

import express from 'express';
import { 
  registerClinicWithDI, 
  loginClinicWithDI, 
  verifyClinicEmailWithDI, 
  submitVerificationWithDI, 
  getClinicProfileWithDI, 
  forgotPasswordWithDI,
  resetPasswordClinicWithDI,
  updatePasswordClinicWithDI,
  refreshTokenClinicWithDI,
  registerClinicValidation,
  loginClinicValidation,
  verifyEmailValidation,
  forgotPasswordClinicValidation,
  resetPasswordClinicValidation,
  updatePasswordClinicValidation
} from '../controllers/clinicAuthController.mjs';
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
  registerClinicValidation,
  auditMiddleware.logAuth('clinic-register'),
  registerClinicWithDI
);

router.post(
  '/login',
  loginClinicValidation,
  auditMiddleware.logAuth('clinic-login'),
  loginClinicWithDI
);

router.post(
  '/verify-email',
  verifyEmailValidation,
  verifyClinicEmailWithDI
);

router.post(
  '/forgot-password',
  forgotPasswordClinicValidation,
  forgotPasswordWithDI
);

router.put(
  '/reset-password/:resetToken',
  resetPasswordClinicValidation,
  resetPasswordClinicWithDI
);

// Protected routes
router.use(authMiddleware.authenticate); // All routes below this line require authentication

router.get(
  '/me',
  auditMiddleware.logAccess('clinic-profile'),
  getClinicProfileWithDI
);

router.post(
  '/submit-verification',
  auditMiddleware.logUpdate('clinic-verification'),
  submitVerificationWithDI
);

router.post(
  '/update-password',
  updatePasswordClinicValidation,
  updatePasswordClinicWithDI
);

router.post(
  '/refresh-token',
  refreshTokenClinicWithDI
);

export default router;