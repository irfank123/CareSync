import { google } from 'googleapis';
import config from '../config/config.mjs';
import { withServicesForController } from '../utils/controllerHelper.mjs';
import { User } from '../models/index.mjs'; // Import User model

// Configure Google OAuth2 client
const oauth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
);

/**
 * @desc    Initiate Google OAuth 2.0 flow
 * @route   GET /api/auth/google/initiate
 * @access  Private (Clinic Admin)
 */
const initiateGoogleAuth = (req, res) => {
  // Scopes required for creating calendar events and meet links
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events'
    // Add other scopes if needed later (e.g., profile, email)
  ];

  // Generate the url that will be used for the consent dialog.
  const authorizeUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline', // Crucial for getting a refresh token
    scope: scopes,
    // Include the user's ID from our system in the state parameter
    // This helps us associate the callback with the correct user
    state: req.user._id.toString() // Use the logged-in user's ID
  });

  // Send the URL back to the frontend in the JSON response
  console.log(`[Google Auth] Sending authorization URL to frontend for user ${req.user._id}`);
  res.status(200).json({ success: true, authorizationUrl: authorizeUrl });
  // DO NOT REDIRECT FROM BACKEND: res.redirect(authorizeUrl);
};

/**
 * @desc    Handle callback from Google after OAuth flow
 * @route   GET /api/auth/google/callback
 * @access  Public (Redirect from Google)
 */
const handleGoogleCallback = async (req, res) => {
  console.log('[Google Callback] Entered handleGoogleCallback controller.');
  const { code, state, error } = req.query;
  const loggedInUserId = state; // Retrieve our user ID from the state

  if (error) {
    console.error('[Google Callback] Error from Google:', error);
    // Redirect to a frontend error page or status
    return res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=error&message=${encodeURIComponent(error)}`);
  }

  if (!code) {
     console.error('[Google Callback] Missing authorization code from Google.');
     return res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=error&message=Missing authorization code`);
  }

  if (!loggedInUserId) {
      console.error('[Google Callback] Missing state parameter (user ID).');
      return res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=error&message=User session context lost`);
  }
  
  console.log(`[Google Callback] Received code for user ID: ${loggedInUserId}. Exchanging for tokens...`);

  try {
    // Exchange authorization code for tokens
    const { tokens } = await oauth2Client.getToken(code);
    console.log('[Google Callback] Tokens received from Google:', { hasRefreshToken: !!tokens.refresh_token }); // Log if refresh token present
    // oauth2Client.setCredentials(tokens); // Not strictly needed here, just need refresh token

    if (!tokens.refresh_token) {
      // This can happen if the user has previously authorized and didn't revoke
      // Or if the consent screen prompt wasn't forced for offline access again
      // For simplicity now, we require a refresh token on the first go.
      // More robust handling might check if a refresh token already exists.
      console.warn(`[Google Callback] Refresh token not received for user ${loggedInUserId}. User might need to re-authorize fully.`);
      return res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=error&message=Authorization incomplete. Please try removing app access from Google account and re-authorize.`);
    }

    // Securely store the refresh token associated with the user
    const user = await User.findByIdAndUpdate(
        loggedInUserId,
        { $set: { googleRefreshToken: tokens.refresh_token } },
        { new: true } // Don't need the full user doc back usually
    );

    if (!user) {
        console.error(`[Google Callback] Failed to find user ${loggedInUserId} to store refresh token.`);
        throw new Error('Failed to associate Google authorization with user account.');
    }

    console.log(`[Google Callback] Successfully stored refresh token for user ${loggedInUserId}.`);

    // Redirect back to the frontend dashboard, indicating success
    res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=success`);

  } catch (error) {
    console.error('[Google Callback] Error exchanging code or storing token:', error.message);
    res.redirect(`${config.frontendUrl}/clinic-dashboard?google_auth_status=error&message=${encodeURIComponent(error.message || 'Failed to process Google authorization')}`);
  }
};

// --- Controller Object and DI --- //
const googleAuthController = {
    initiateGoogleAuth,
    handleGoogleCallback
};

const dependencies = {
    // Add service dependencies if needed later
};

const enhancedController = withServicesForController(googleAuthController, dependencies);

export const { 
    initiateGoogleAuth: initiateGoogleAuthWithDI, 
    handleGoogleCallback: handleGoogleCallbackWithDI 
} = enhancedController;

export default enhancedController; 