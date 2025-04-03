// src/routes/authRoutes.mjs

import express from 'express';
import * as authController from '../controllers/authController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';

const router = express.Router();

// Public routes
router.post('/register', authController.registerValidation, authController.register);
router.post('/login', authController.loginValidation, authController.login);
router.post('/verify-mfa', authController.mfaValidation, authController.verifyMfa);
router.post('/forgot-password', authController.forgotPasswordValidation, authController.forgotPassword);
router.put('/reset-password/:resetToken', authController.resetPasswordValidation, authController.resetPassword);
router.post('/verify-email', authController.verifyEmailValidation, authController.verifyEmail);

// Auth0 callback
router.post('/auth0/callback', authMiddleware.verifyAuth0Token, authController.auth0Callback);

// Protected routes
router.use(authMiddleware.authenticate); // All routes below this line require authentication

router.get('/me', authController.getMe);
router.post('/logout', authController.logout);
router.post('/update-password', authController.updatePasswordValidation, authController.updatePassword);
router.post('/refresh-token', authController.refreshToken);
router.post('/toggle-mfa', authController.toggleMfaValidation, authController.toggleMfa);

export default router;