// src/routes/authRoutes.mjs

import express from 'express';
import {
  register,
  login,
  auth0Callback,
  logout,
  getMe,
  forgotPassword,
  resetPassword,
  updatePassword,
  refreshToken,
  registerValidation,
  loginValidation,
  forgotPasswordValidation,
  resetPasswordValidation,
  updatePasswordValidation
} from '../controllers/authController.mjs';

import {
  registerClinic,
  loginClinic,
  verifyClinicEmail,
  submitVerification,
  getClinicProfile,
  forgotPasswordClinic,
  resetPasswordClinic,
  updatePasswordClinic,
  refreshTokenClinic,
  registerClinicValidation,
  loginClinicValidation,
  verifyEmailValidation,
  forgotPasswordClinicValidation,
  resetPasswordClinicValidation,
  updatePasswordClinicValidation
} from '../controllers/clinicAuthController.mjs';

import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// User authentication routes
router.post('/register', registerValidation, register);
router.post('/login', loginValidation, login);
router.post('/auth0/callback', authMiddleware.verifyAuth0Token, auth0Callback);
router.post('/logout', authMiddleware.authenticate, logout);
router.get('/me', authMiddleware.authenticate, getMe);
router.post('/forgot-password', forgotPasswordValidation, forgotPassword);
router.put('/reset-password/:resetToken', resetPasswordValidation, resetPassword);
router.post('/update-password', authMiddleware.authenticate, updatePasswordValidation, updatePassword);
router.post('/refresh-token', authMiddleware.authenticate, refreshToken);

// Clinic authentication routes
router.post('/clinic/register', registerClinicValidation, registerClinic);
router.post('/clinic/login', loginClinicValidation, loginClinic);
router.post('/clinic/verify-email', verifyEmailValidation, verifyClinicEmail);
router.post('/clinic/submit-verification', authMiddleware.authenticate, authMiddleware.verifyClinicStatus, submitVerification);
router.get('/clinic/me', authMiddleware.authenticate, getClinicProfile);
router.post('/clinic/forgot-password', forgotPasswordClinicValidation, forgotPasswordClinic);
router.put('/clinic/reset-password/:resetToken', resetPasswordClinicValidation, resetPasswordClinic);
router.post('/clinic/update-password', authMiddleware.authenticate, updatePasswordClinicValidation, updatePasswordClinic);
router.post('/clinic/refresh-token', authMiddleware.authenticate, refreshTokenClinic);

export default router;