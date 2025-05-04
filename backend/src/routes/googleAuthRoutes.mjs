// src/routes/googleAuthRoutes.mjs
import express from 'express';
import { authMiddleware } from '../middleware/index.mjs';
import { 
    initiateGoogleAuthWithDI, 
    handleGoogleCallbackWithDI 
} from '../controllers/googleAuthController.mjs';

const router = express.Router();

// Route to start the Google OAuth flow
// Apply authentication and role restriction ONLY to this route
router.get(
  '/initiate', 
  authMiddleware.authenticate, // User must be logged in via Auth0
  authMiddleware.restrictTo('admin'), // User must have admin role
  initiateGoogleAuthWithDI
);

// Route Google redirects back to after user grants permission
// This route is PUBLIC because it comes from Google, 
// but we verify the 'state' parameter inside the controller
router.get(
  '/callback',
  handleGoogleCallbackWithDI
);

export default router; 