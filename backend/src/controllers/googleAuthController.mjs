import { google } from 'googleapis';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import loadAndValidateConfig from '../config/config.mjs';
const config = loadAndValidateConfig();
import User from '../models/User.mjs'; // Assuming direct model usage for simplicity here
import Clinic from '../models/Clinic.mjs'; // Assuming direct model usage for simplicity here
import { AppError } from '../utils/errorHandler.mjs'; // Correct path
import Appointment from '../models/Appointment.mjs';
import googleService from '../services/googleService.mjs';

// --- Google OAuth2 Client Setup ---
// Read from the loaded config object
const GOOGLE_CLIENT_ID = config.google.clientId;
const GOOGLE_CLIENT_SECRET = config.google.clientSecret;
const GOOGLE_REDIRECT_URI = config.google.redirectUri; // From .env file

console.log('Google OAuth Setup:', {
  clientId: GOOGLE_CLIENT_ID ? '✅ Set' : '❌ Missing',
  clientSecret: GOOGLE_CLIENT_SECRET ? '✅ Set' : '❌ Missing',
  redirectUri: GOOGLE_REDIRECT_URI
});

if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REDIRECT_URI) {
  console.error('Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) must be set.');
  // Potentially throw an error or exit in a real app if config is critical
}

const oauth2Client = new google.auth.OAuth2(
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  GOOGLE_REDIRECT_URI
);

// --- Controller Methods ---

/**
 * @desc    Generate Google OAuth URL
 * @route   GET /api/google/auth/url
 * @access  Private (Clinic Admin)
 */
const getGoogleAuthUrl = async (req, res) => {
  if (!req.user || !req.user._id) {
    return res.status(401).json({ success: false, message: 'User not authenticated.' });
  }
  const userId = req.user._id.toString();

  // Generate a secure random nonce
  const nonce = crypto.randomBytes(16).toString('hex');

  // Create the state payload
  const statePayload = {
    userId: userId,
    nonce: nonce // Add nonce to prevent replay attacks on the state itself
  };

  // Sign the state payload using JWT secret (ensure config.jwt.secret is strong)
  const signedState = jwt.sign(statePayload, config.jwt.secret, { expiresIn: '15m' }); // Short expiry for state

  console.log(`Generated signed state for user ${userId}`);

  // --- ADD LOGGING HERE ---
  const redirectUriUsed = config.google.redirectUri; // Get the URI from loaded config
  console.log('[getGoogleAuthUrl] Using redirect URI for Google Auth URL:', redirectUriUsed);
  // Check if it seems valid (basic check)
  if (!redirectUriUsed || !redirectUriUsed.startsWith('http')) {
      console.error('[getGoogleAuthUrl] CRITICAL: Invalid or missing GOOGLE_REDIRECT_URI in configuration!');
      // You might want to return an error here instead of proceeding
      return res.status(500).json({ success: false, message: 'Server configuration error for Google Redirect URI.' });
  }
  // --- END LOGGING ---

  // Define the required scopes
  const scopes = [
    'https://www.googleapis.com/auth/calendar.events',
    'https://www.googleapis.com/auth/calendar'
  ];

  // Generate the authorization URL using the LOGGED URI
  const authorizationUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent',
    include_granted_scopes: true,
    state: signedState,
    redirect_uri: redirectUriUsed // Explicitly pass the redirect_uri used for logging
  });

  // Send the URL back to the frontend
  res.status(200).json({
    success: true,
    url: authorizationUrl,
  });
};

/**
 * @desc    Handle Google OAuth Callback
 * @route   GET /api/google/auth/callback
 * @access  Public (redirect target from Google)
 */
const handleGoogleAuthCallback = async (req, res) => {
  const { code, state: signedState, error } = req.query;
  const frontendRedirectBase = config.frontendUrl || 'http://localhost:3000'; // Fallback frontend URL
  const redirectUrl = (path, params = {}) => {
      const url = new URL(path, frontendRedirectBase);
      Object.entries(params).forEach(([key, value]) => url.searchParams.set(key, value));
      return url.toString();
  };

  // --- Basic Error Handling ---
  if (error) {
    console.error('[Google Callback] Received error from Google:', error);
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: error }));
  }

  if (!code) {
    console.error('[Google Callback] Missing authorization code.');
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: 'missing_code' }));
  }

  if (!signedState) {
    console.error('[Google Callback] Missing state parameter.');
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: 'missing_state' }));
  }
  console.log('[Google Callback] Received code and state. Proceeding with state verification...');

  // --- State Verification ---
  let adminUserId;
  try {
    const decodedState = jwt.verify(signedState, config.jwt.secret);
    if (!decodedState || !decodedState.userId) {
      throw new Error('Invalid state payload structure.');
    }
    adminUserId = decodedState.userId;
    console.log(`[Google Callback] State verified successfully for user ID: ${adminUserId}`);
  } catch (stateError) {
    console.error('[Google Callback] State verification failed:', stateError.message);
    let redirectError = 'state_verification_failed';
    if (stateError.name === 'TokenExpiredError') redirectError = 'state_expired';
    else if (stateError.name === 'JsonWebTokenError') redirectError = 'state_invalid_signature';
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: redirectError }));
  }

  // --- Token Exchange ---
  let tokens;
  try {
    console.log(`[Google Callback] Exchanging code for tokens for user: ${adminUserId}...`);
    const tokenResponse = await oauth2Client.getToken(code);
    tokens = tokenResponse.tokens; // Extract tokens object
    
    if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
         throw new Error('Invalid token response received from Google.');
    }
    
    console.log(`[Google Callback] Tokens received: Access token? ${!!tokens.access_token}, Refresh token? ${!!tokens.refresh_token}`);
    
  } catch (tokenError) {
    console.error('[Google Callback] Error exchanging code for tokens:', tokenError.response?.data || tokenError.message);
    const googleError = tokenError.response?.data?.error || 'token_exchange_failed';
    const errorDescription = tokenError.response?.data?.error_description || tokenError.message;
    // Pass Google's specific error if available
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: googleError, google_auth_error_desc: errorDescription }));
  }

  // --- Store Refresh Token (if received) ---
  if (!tokens.refresh_token) {
    console.warn(`[Google Callback] No refresh token received for user ${adminUserId}. This is expected if the user previously authorized the app. Ensure 'prompt=consent' was used if a new token is needed.`);
    // Decide if this is an error or success. If only access token is needed for immediate use, it might be okay.
    // For long-term access (creating meet links later), the refresh token is crucial.
    // Redirecting as success, but frontend might need to check if Google is truly "connected".
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_success: 'true', google_auth_warning: 'no_refresh_token' }));
  }

  // Proceed only if we have a refresh token and a valid user ID
  try {
    console.log(`[Google Callback] Finding admin user ${adminUserId} to locate clinic...`);
    const adminUser = await User.findById(adminUserId).select('clinicId');
    if (!adminUser) {
      throw new AppError(`Admin user ${adminUserId} not found during callback.`, 404);
    }
    if (!adminUser.clinicId) {
      throw new AppError(`Admin user ${adminUserId} is not associated with any clinic. Cannot save token.`, 400);
    }
    const clinicId = adminUser.clinicId.toString();
    console.log(`[Google Callback] Found clinic ID: ${clinicId}. Saving refresh token via googleService...`);

    // Call the service to securely save the token
    const saveResult = await googleService.saveRefreshTokenForClinic(clinicId, tokens.refresh_token);

    if (saveResult) {
        console.log(`[Google Callback] Successfully saved refresh token for clinic ${clinicId}. Redirecting to dashboard.`);
        return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_success: 'true' }));
    } else {
        // This case should ideally be caught by an error in the service, but handle defensively
        throw new Error('googleService.saveRefreshTokenForClinic returned false or undefined.');
    }

  } catch (error) { // Catch errors from User lookup or token saving
    console.error('[Google Callback] Error finding user, clinic, or saving token:', error);
    const errorMessage = error instanceof AppError ? error.message : 'token_storage_failed';
    const errorCode = error instanceof AppError ? error.statusCode : 500; // Use AppError status code if available
    // Provide a more specific error message if possible
    return res.redirect(redirectUrl('/clinic-dashboard', { google_auth_error: errorMessage, google_auth_error_code: errorCode }));
  }
};

/**
 * @desc    Create Google Calendar event with Meet link for an appointment
 * @route   POST /api/google/appointments/:appointmentId/meet
 * @access  Private (Admin, Doctor, Staff - roles that manage appointments)
 */
const createMeetLinkForAppointment = async (req, res, next) => {
    const { appointmentId } = req.params;

    // 1. Validate User and Clinic Association
    if (!req.user || !req.user.clinicId) {
        return next(new AppError('User not authenticated or not associated with a clinic', 401));
    }
    const clinicId = req.user.clinicId.toString();

    try {
        // 2. Fetch the Appointment
        const appointment = await Appointment.findById(appointmentId).populate('patientId', 'email firstName lastName').populate('doctorId', 'email firstName lastName');
        if (!appointment) {
            return next(new AppError('Appointment not found', 404));
        }

        // Optional: Check if appointment belongs to the user's clinic
        if (appointment.clinicId.toString() !== clinicId) {
             return next(new AppError('Appointment does not belong to your clinic', 403));
        }

        // Check if a link already exists
        if (appointment.googleMeetLink) {
            return res.status(200).json({ 
                success: true, 
                message: 'Meet link already exists for this appointment', 
                appointment 
            });
        }

        // 3. Prepare Google Calendar Event Details
        const attendees = [];
        if (appointment.patientId?.email) {
            attendees.push({ email: appointment.patientId.email });
        }
        if (appointment.doctorId?.email) {
             attendees.push({ email: appointment.doctorId.email });
        }
        // Add the clinic admin/creator? Maybe not necessary unless they attend.

        const eventDetails = {
            summary: `CareSync Appointment: ${appointment.patientId?.firstName || 'Patient'} with Dr. ${appointment.doctorId?.lastName || 'Doctor'}`,
            description: `Virtual consultation for appointment ID: ${appointmentId}.\nNotes: ${appointment.notes || 'N/A'}`,
            startDateTime: appointment.startTime.toISOString(), // Ensure startTime is a Date object
            endDateTime: appointment.endTime.toISOString(),     // Ensure endTime is a Date object
            attendees: attendees,
            // calendarId: 'primary' // Use primary calendar of the authorized account
        };

        // 4. Call Google Service to Create Event
        const googleEvent = await googleService.createCalendarEventWithMeet(clinicId, eventDetails);

        // 5. Update Appointment with Meet Link and Event ID
        appointment.googleMeetLink = googleEvent.hangoutLink;
        appointment.googleEventId = googleEvent.id;
        await appointment.save();

        console.log(`Meet link added to appointment ${appointmentId}: ${googleEvent.hangoutLink}`);

        // 6. Send Response
        res.status(200).json({
            success: true,
            message: 'Google Meet link created and added to appointment successfully.',
            appointment // Return the updated appointment
        });

    } catch (error) {
        console.error(`Error creating Meet link for appointment ${appointmentId}:`, error);
        // Pass error to global error handler or handle specifically
        next(error);
    }
};

/**
 * Generate a Google Meet link for an appointment using an existing token
 * @param {Object} req - Express request 
 * @param {Object} res - Express response
 */
export const createMeetLinkWithToken = async (req, res) => {
  try {
    const { appointmentId } = req.params;
    const userId = req.user.id;
    const { accessToken, refreshToken } = req.body;
    
    if (!accessToken) {
      return res.status(400).json({
        success: false,
        message: 'Access token is required'
      });
    }
    
    console.log(`Creating Google Meet link with provided token for appointment ${appointmentId}`);
    
    // Import the Google Calendar service
    const googleCalendarService = (await import('../services/googleCalendarService.mjs')).default;
    
    // Create tokens object
    const tokens = {
      access_token: accessToken,
      refresh_token: refreshToken
    };
    
    // Create or update the meeting using directly provided tokens
    const result = await googleCalendarService.createMeetingForAppointment(
      userId, 
      appointmentId,
      tokens
    );
    
    return res.status(200).json({
      success: true,
      message: 'Google Meet link generated successfully',
      data: {
        meetLink: result.meetLink,
        eventId: result.eventId
      }
    });
  } catch (error) {
    console.error('Error generating meeting link with token:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Failed to generate meeting link'
    });
  }
};

// --- Export Controller Methods ---
export default {
  getGoogleAuthUrl,
  handleGoogleAuthCallback,
  createMeetLinkForAppointment,
  createMeetLinkWithToken
}; 