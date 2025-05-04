import express from 'express';
import googleService from '../services/googleService.mjs';
import { authMiddleware } from '../middleware/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';
import config from '../config/config.mjs';
import googleAuthController from '../controllers/googleAuthController.mjs';

const router = express.Router();

// Redirect user to Google's consent screen
router.get('/connect', authMiddleware.authenticate, (req, res, next) => {
  try {
    if (!req.user || !req.user._id) {
      // This should ideally be caught by authenticate middleware, but double-check
      return next(new AppError('Authentication required to connect Google account', 401));
    }
    const userId = req.user._id.toString(); // Get user ID from authenticated user
    console.log(`Initiating Google connect for user: ${userId}`);
    
    // Pass the userId in the state parameter
    const url = googleService.generateAuthUrl(userId);
    console.log('Redirecting user to Google consent screen:', url);
    res.redirect(url);
  } catch (error) {
    console.error('Error generating Google auth URL:', error);
    res.status(500).send('Failed to initiate Google connection');
  }
});

// Handle the callback from Google
router.get('/callback', async (req, res) => {
  const code = req.query.code;
  const state = req.query.state; // This should contain the userId we passed
  
  console.log('Received Google callback with code:', !!code, 'and state:', state);

  if (!code) {
    return res.status(400).send('Authorization code missing from Google callback');
  }
  if (!state) {
    // If state is missing, we cannot securely identify the user
    console.error('State parameter missing from Google callback. Cannot verify user.');
    return res.redirect(`${config.frontendUrl}/settings?google_connected=false&error=state_missing`);
  }

  // In this simple case, the state *is* the userId. 
  // For production, consider more robust state management (e.g., signed state)
  const userId = state;

  try {
    const tokens = await googleService.getTokensFromCode(code);
    
    if (tokens.refresh_token) {
      // Use the userId retrieved securely from the state parameter
      await googleService.saveRefreshToken(userId, tokens.refresh_token);
      console.log(`Refresh token saved for user ${userId}`);
      res.redirect(`${config.frontendUrl}/settings?google_connected=true`);
    } else {
      console.warn(`No refresh token received for user ${userId}. User might need to re-authenticate with prompt=consent.`);
      res.redirect(`${config.frontendUrl}/settings?google_connected=partial`);
    }

  } catch (error) {
    console.error(`Error handling Google callback for user ${userId}:`, error);
    res.redirect(`${config.frontendUrl}/settings?google_connected=false&error=${encodeURIComponent(error.message)}`);
  }
});

// Route to initiate Google OAuth flow
// Protect this route: only authenticated clinic admins should initiate
router.get(
  '/auth/url',
  authMiddleware.protect, // Ensure user is logged in via regular or clinic auth
  authMiddleware.restrictTo('admin'), // Ensure user has the admin role
  googleAuthController.getGoogleAuthUrl
);

// Route Google redirects to after user consent
router.get(
  '/auth/callback',
  googleAuthController.handleGoogleAuthCallback
);

// Route to create a Google Meet link for a specific appointment
router.post(
    '/appointments/:appointmentId/meet',
    authMiddleware.protect, // Ensure user is logged in
    authMiddleware.restrictTo('admin', 'doctor', 'staff'), // Define allowed roles
    googleAuthController.createMeetLinkForAppointment
);

// Add a route for creating a Meet link with an existing token
router.post(
  '/appointment/:appointmentId/meet-link-with-token', 
  authMiddleware.authenticate, 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'),
  googleAuthController.createMeetLinkWithToken
);

// TODO: Add route for actually creating the Meet link (e.g., POST /meetings)
// This route would:
// 1. Be protected (authMiddleware.protect, authMiddleware.restrictTo('admin'))
// 2. Retrieve the stored refresh token for the logged-in user
// 3. Use the refresh token to get a fresh access token
// 4. Use the access token and googleapis library to call the Calendar API
//    (calendar.events.insert) to create an event with conference data.
// 5. Return the event details (including the Meet link) to the frontend.

export default router; 