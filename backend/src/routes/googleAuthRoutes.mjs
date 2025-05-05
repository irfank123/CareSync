import express from 'express';
import { 
  initiateGoogleAuth,
  handleGoogleAuthCallback
} from '../controllers/googleAuthController.mjs';
import { authMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// Route to initiate the Google OAuth flow
// Requires user to be logged in (e.g., via existing JWT or Auth0 middleware)
router.get(
  '/initiate',
  // authMiddleware.authenticate, // Use Auth0 validation since frontend sends Auth0 token
  authMiddleware.validateAuth0Token, 
  initiateGoogleAuth 
);

// Route Google redirects to after user consent
router.get(
  '/callback',
  handleGoogleAuthCallback
);

export default router; 