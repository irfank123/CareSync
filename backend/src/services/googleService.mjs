import { google } from 'googleapis';
import loadAndValidateConfig from '../config/config.mjs';
import { encryptToken, decryptToken } from '../utils/encryption.mjs';
import { User } from '../models/index.mjs'; // Adjust path if needed
import Clinic from '../models/Clinic.mjs';
import { AppError } from '../utils/errorHandler.mjs'; // <-- Correct path

const config = loadAndValidateConfig();

// Check if Google OAuth is properly configured
const isGoogleConfigured = config.google && 
                         config.google.clientId && 
                         config.google.clientSecret && 
                         config.google.redirectUri;

// Only initialize OAuth client if Google config is available
const oauth2Client = isGoogleConfigured ? new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  config.google.redirectUri
) : null;

const SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'openid'
];

class GoogleService {
  constructor() {
    this.isEnabled = isGoogleConfigured;
    
    if (!this.isEnabled) {
      console.warn('Google OAuth environment variables (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) are not fully configured. Google authentication features will be disabled.');
      return;
    }
    
    // Use the loaded config object
    this.baseOAuth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
  }

  generateAuthUrl(userId) {
    if (!this.isEnabled) {
      throw new AppError('Google authentication is not configured on this server', 501);
    }
    
    if (!userId) {
      throw new Error('Cannot generate Google Auth URL without a userId for state.');
    }
    return oauth2Client.generateAuthUrl({
      access_type: 'offline', // Important for getting refresh token
      scope: SCOPES,
      prompt: 'consent', // Force consent screen for refresh token
      state: userId // Use userId as the state parameter
    });
  }

  async getTokensFromCode(code) {
    if (!this.isEnabled) {
      throw new AppError('Google authentication is not configured on this server', 501);
    }
    
    try {
      const { tokens } = await oauth2Client.getToken(code);
      console.log('Tokens received from Google:', { accessToken: !!tokens.access_token, refreshToken: !!tokens.refresh_token });
      // oauth2Client.setCredentials(tokens); // Set credentials for potential immediate use
      return tokens; // Contains access_token, refresh_token, scope, token_type, expiry_date
    } catch (error) {
      console.error('Error retrieving access token from code:', error);
      throw new Error('Failed to exchange authorization code for tokens.');
    }
  }

  async saveRefreshToken(userId, refreshToken) {
    if (!refreshToken) {
      console.warn('No refresh token provided to save for user:', userId);
      return; // Or throw error?
    }
    try {
      const encryptedToken = encryptToken(refreshToken);
      if (!encryptedToken) {
        throw new Error('Failed to encrypt refresh token.');
      }
      await User.findByIdAndUpdate(userId, { googleRefreshToken: encryptedToken });
      console.log('Saved encrypted refresh token for user:', userId);
    } catch (error) {
      console.error(`Error saving refresh token for user ${userId}:`, error);
      throw new Error('Failed to save refresh token.');
    }
  }

  async getRefreshedClient(userId) {
    try {
      // Need to query with +field to get selected: false field
      const user = await User.findById(userId).select('+googleRefreshToken');
      if (!user || !user.googleRefreshToken) {
        throw new Error('User has not connected their Google account or refresh token is missing.');
      }

      const refreshToken = decryptToken(user.googleRefreshToken);
      if (!refreshToken) {
        throw new Error('Failed to decrypt refresh token.');
      }

      const client = new google.auth.OAuth2(
        config.google.clientId,
        config.google.clientSecret,
        config.google.redirectUri
      );
      client.setCredentials({ refresh_token: refreshToken });

      // Optionally refresh the access token immediately to check validity
      // const { token } = await client.getAccessToken();
      // console.log('Refreshed access token obtained.');

      return client;
    } catch (error) {
      console.error(`Error getting refreshed Google client for user ${userId}:`, error);
      throw error; // Re-throw the specific error
    }
  }

  async createCalendarEventWithMeet(clinicId, eventDetails) {
    const { 
      summary, 
      description, 
      startDateTime, 
      endDateTime, 
      attendees = [], 
      calendarId = 'primary'
    } = eventDetails;

    if (!summary || !startDateTime || !endDateTime) {
      throw new AppError('Missing required event details: summary, startDateTime, endDateTime', 400);
    }

    // Get authenticated client for the clinic
    const authClient = await this.getAuthenticatedClient(clinicId);

    // Create Calendar API client
    const calendar = google.calendar({ version: 'v3', auth: authClient });

    // Prepare event resource
    const eventResource = {
      summary: summary,
      description: description,
      start: {
        dateTime: startDateTime,
        // timeZone: 'America/Los_Angeles' // Optional: Specify timezone if needed
      },
      end: {
        dateTime: endDateTime,
        // timeZone: 'America/Los_Angeles'
      },
      attendees: attendees,
      conferenceData: {
        createRequest: {
          requestId: `caresync-${clinicId}-${Date.now()}`, // Unique ID for the meet creation request
          conferenceSolutionKey: {
            type: 'hangoutsMeet'
          }
        }
      },
      // Optional: Add reminders, etc.
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 60 }, // 1 hour before
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    try {
      console.log('Creating Google Calendar event with Meet link...');
      const createdEvent = await calendar.events.insert({
        calendarId: 'primary', // Use the user's primary calendar
        resource: eventResource,
        conferenceDataVersion: 1, // Crucial to generate Meet link
        sendNotifications: true, // Optionally send notifications to attendees
      });
      console.log('Google Calendar event created:', createdEvent.data.id);
      return createdEvent.data; // Contains the hangoutLink
    } catch (error) {
      console.error('Error creating Google Calendar event:', error.response?.data?.error || error.message);
      throw new Error('Failed to create Google Calendar event.');
    }
  }

  /**
   * Encrypts and saves a Google refresh token for a specific clinic.
   * @param {string} clinicId - The ID of the clinic.
   * @param {string} refreshToken - The refresh token to save.
   * @returns {Promise<boolean>} True if successful, throws error otherwise.
   * @throws {AppError} If encryption or saving fails.
   */
  async saveRefreshTokenForClinic(clinicId, refreshToken) {
    if (!refreshToken) {
      throw new AppError('Refresh token is required to save.', 400);
    }
    if (!clinicId) {
       throw new AppError('Clinic ID is required to save refresh token.', 400);
    }

    console.log(`[Service] Attempting to save refresh token for clinic ${clinicId}...`);

    let encryptedToken;
    try {
      encryptedToken = encryptToken(refreshToken);
      if (!encryptedToken) {
        // encryptToken returns null on failure, but also check config availability
        if (!config.google.refreshTokenEncryptionKey) {
            console.warn('[Service] REFRESH_TOKEN_ENCRYPTION_KEY is missing. Saving token unencrypted (not recommended for production).');
            encryptedToken = refreshToken; // Save unencrypted if key is missing
        } else {
            throw new Error('Encryption resulted in null or undefined, possibly due to an internal crypto error.');
        }
      } else {
          console.log('[Service] Token encrypted successfully.');
      }
    } catch (encError) {
        console.error(`[Service] Encryption failed for clinic ${clinicId}:`, encError);
        // Throw a specific error indicating encryption failure
        throw new AppError(`Failed to encrypt token for clinic ${clinicId}: ${encError.message}`, 500);
    }
    
    // Proceed with database update
    try {
      console.log(`[Service] Updating clinic ${clinicId} in database with token...`);
      // Update using updateOne for more detailed response
      const updateResult = await Clinic.updateOne(
        { _id: clinicId },
        { $set: { googleRefreshToken: encryptedToken } }
      );
      
      console.log('[Service] MongoDB update result:', JSON.stringify(updateResult));

      if (updateResult.matchedCount === 0) {
        // This shouldn't happen if the clinic was found just before encryption, but handle defensively.
        throw new AppError(`Clinic with ID ${clinicId} was not found during the final update step.`, 404);
      }
      
      if (updateResult.modifiedCount === 0 && updateResult.matchedCount > 0) {
          // If a document was matched but not modified, the token might be the same, which is okay.
          console.warn(`[Service] No changes made to clinic ${clinicId} - token might be identical.`);
      }
      
      // Optional: Verify the token was saved by retrieving it (can be disabled for performance)
      // const verifyClinic = await Clinic.findById(clinicId).select('googleRefreshToken');
      // if (!verifyClinic || verifyClinic.googleRefreshToken !== encryptedToken) {
      //   throw new Error('Verification failed: Token in DB does not match saved token.');
      // }
      // console.log('[Service] Verified token successfully saved in database.')

      console.log(`[Service] ✅ Successfully saved token for clinic ${clinicId}.`);
      return true; // Explicitly return true on success

    } catch (dbError) {
      console.error(`[Service] Database error saving refresh token for clinic ${clinicId}:`, dbError);
      // Re-throw database errors, potentially wrapping them in AppError if not already
      if (dbError instanceof AppError) throw dbError;
      throw new AppError(`Database error saving token for clinic ${clinicId}: ${dbError.message}`, 500);
    }
  }

  /**
   * Creates an authenticated Google API client for a specific clinic.
   * Uses the stored refresh token to get necessary access tokens.
   * @param {string} clinicId - The ID of the clinic.
   * @returns {Promise<google.auth.OAuth2>} Authenticated OAuth2 client.
   * @throws {AppError} If clinic or refresh token is not found or decryption fails.
   */
  async getAuthenticatedClient(clinicId) {
    if (!clinicId) {
      throw new AppError('Clinic ID is required to get authenticated Google client', 400);
    }

    const clinic = await Clinic.findById(clinicId).select('+googleRefreshToken');

    if (!clinic) {
      throw new AppError(`Clinic not found with ID: ${clinicId}`, 404);
    }
    if (!clinic.googleRefreshToken) {
      throw new AppError(`No Google account connected for clinic: ${clinicId}. Please connect via settings.`, 400);
    }

    let refreshToken = clinic.googleRefreshToken;
    
    // Check if the token appears to be encrypted (has the format iv:encryptedData)
    if (refreshToken.includes(':')) {
      try {
        const decryptedToken = decryptToken(refreshToken);
        if (decryptedToken) {
          refreshToken = decryptedToken;
          console.log(`Successfully decrypted refresh token for clinic ${clinicId}`);
        } else {
          console.warn(`Token appears to be encrypted but decryption failed. Will try to use it as is.`);
        }
      } catch (decryptError) {
        console.warn(`Error during token decryption for clinic ${clinicId}. Will try using token as is:`, decryptError.message);
      }
    } else {
      console.log(`Using non-encrypted refresh token for clinic ${clinicId}`);
    }

    const authClient = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    authClient.setCredentials({ refresh_token: refreshToken });

    try {
      const { token } = await authClient.getAccessToken();
      if (!token) throw new Error('Failed to retrieve access token using refresh token.');
      console.log(`Successfully obtained Google access token for clinic ${clinicId}`);
      return authClient;
    } catch (error) {
      console.error(`Error refreshing Google token for clinic ${clinicId}:`, error.response?.data || error.message);
      throw new AppError(`Failed to authenticate with Google. Your refresh token may be invalid or expired. Please reconnect your Google account. Error: ${error.response?.data?.error_description || error.message}`, 401);
    }
  }
}

export default new GoogleService(); 