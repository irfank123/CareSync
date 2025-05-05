import { google } from 'googleapis';
import crypto from 'crypto';
import User from '../models/User.mjs';
import Appointment from '../models/Appointment.mjs';
import Clinic from '../models/Clinic.mjs';
import loadAndValidateConfig from '../config/config.mjs';

// Call the function to get the actual config object
const config = loadAndValidateConfig();

class GoogleCalendarService {
  constructor() {
    this.oAuth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    
    // Required scopes for Calendar + Meet
    this.requiredScopes = [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events'
    ];
    
    // Define encryption/decryption methods for token storage
    this.algorithm = 'aes-256-cbc';
    this.encryptionKey = config.google.refreshTokenEncryptionKey;
    if (!this.encryptionKey) {
      console.warn('⚠️ Google refresh token encryption key not set. Token security may be compromised.');
    }
  }

  /**
   * Creates a Google Meet event for an appointment
   * @param {string} userId - The user ID of the admin/clinic user creating the event
   * @param {Object} appointmentData - Appointment data including IDs, date, times
   * @param {Object} tokens - Optional direct token object if already authenticated
   * @returns {Promise<Object>} - The created event with meet link
   */
  async createMeetingForAppointment(userId, appointmentId, tokens = null, session = null) {
    console.log(`Creating Google Meet event for appointment ${appointmentId} by user ${userId}` + (session ? ' within transaction' : ''));
    
    try {
      if (tokens && tokens.access_token) {
        console.log('Using directly provided access token');
        // Set the credentials directly with the provided tokens
        this.oAuth2Client.setCredentials(tokens);
      } else {
        // --- Modified Token Retrieval Logic: Always use Clinic Token --- 
        console.log(`[Meet Creation] Attempting to use Clinic token for user ${userId}`);
        
        // Get the user ONLY to find their clinicId
        const user = await User.findById(userId).select('clinicId');
        if (!user || !user.clinicId) {
          throw new Error('User not found or not associated with a clinic. Cannot determine which clinic token to use.');
        }
        
        console.log(`[Meet Creation] User belongs to clinic ${user.clinicId}. Fetching clinic token.`);
        const clinic = await Clinic.findById(user.clinicId).select('googleRefreshToken');
        
        if (!clinic || !clinic.googleRefreshToken) {
          // Error if the CLINIC has no token
          console.error(`[Meet Creation] Clinic ${user.clinicId} has not connected a Google account.`);
          throw new Error('The clinic has not connected a Google account. Please configure Google Calendar integration in clinic settings.');
        }
        
        // Decrypt and use the clinic's refresh token
        const refreshToken = this.decryptToken(clinic.googleRefreshToken);
        console.log(`[Meet Creation] Using Google token from Clinic ${user.clinicId}.`);
        
        // Set the refresh token for this OAuth client
        this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
        // --- End Modified Token Retrieval Logic ---
      }
      
      // Get the appointment details with all necessary user information
      console.log(`[Meet Creation] Finding appointment ${appointmentId}` + (session ? ' using transaction session' : ''));
      const appointmentQuery = Appointment.findById(appointmentId)
        .populate({ 
          path: 'patientId', 
          select: 'firstName lastName',
          populate: { path: 'userId', select: 'email firstName lastName' }
        })
        .populate({ 
          path: 'doctorId', 
          select: 'firstName lastName',
          populate: { path: 'userId', select: 'email firstName lastName' }
        });
        
      if (session) {
        appointmentQuery.session(session);
      }
      
      const appointment = await appointmentQuery;
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      console.log('Populated appointment data for Meet link creation:', {
        appointmentId: appointment._id,
        doctorEmail: appointment.doctorId?.userId?.email,
        patientEmail: appointment.patientId?.userId?.email
      });
      
      // Create a Calendar API client
      const calendar = google.calendar({
        version: 'v3',
        auth: this.oAuth2Client
      });
      
      // Parse appointment date and times to create a proper Google Calendar event
      const appointmentDate = new Date(appointment.date);
      const [startHour, startMinute] = appointment.startTime.split(':').map(num => parseInt(num));
      const [endHour, endMinute] = appointment.endTime.split(':').map(num => parseInt(num));
      
      const startDateTime = new Date(appointmentDate);
      startDateTime.setHours(startHour, startMinute, 0);
      
      const endDateTime = new Date(appointmentDate);
      endDateTime.setHours(endHour, endMinute, 0);
      
      // Define the event
      const event = {
        summary: `Appointment: ${appointment.patientId.firstName} ${appointment.patientId.lastName} with Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`,
        description: appointment.reasonForVisit || 'Medical appointment',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/New_York', // Should be configurable or use the user's timezone
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/New_York', // Should be configurable or use the user's timezone
        },
        conferenceData: {
          createRequest: {
            requestId: crypto.randomUUID(),
            conferenceSolutionKey: { type: 'hangoutsMeet' }
          }
        },
        attendees: [
          // Add doctor and patient emails if available
          ...(appointment.doctorId.userId?.email ? [{ email: appointment.doctorId.userId.email }] : []),
          ...(appointment.patientId.userId?.email ? [{ email: appointment.patientId.userId.email }] : [])
        ],
        reminders: {
          useDefault: false,
          overrides: [
            { method: 'email', minutes: 24 * 60 },
            { method: 'popup', minutes: 30 }
          ]
        }
      };
      
      // Add the event to the calendar with conference data
      try {
        console.log('Creating Google Calendar event with conference data...');
        const response = await calendar.events.insert({
          calendarId: 'primary',
          resource: event,
          conferenceDataVersion: 1,
          sendNotifications: false,
          sendUpdates: 'none'
        });
        
        // Verify we actually got a Google Meet link
        if (!response.data.hangoutLink) {
          console.error('Google Calendar event created but no Meet link was generated:', response.data);
          
          // Check if conference data was included in the response
          if (!response.data.conferenceData) {
            throw new Error('Google Calendar API did not generate conference data. Ensure Google Meet is enabled for your Google Workspace account and this user has required permissions.');
          }
          
          throw new Error('Google Calendar API did not generate a Meet link. The event was created but without video conferencing capabilities.');
        }
        
        console.log('Google Calendar event created with Meet link:', response.data.hangoutLink);
        console.log('Google Calendar event ID:', response.data.id);
        
        // Update the appointment with the Meet link and event ID
        const googleMeetLink = response.data.hangoutLink;
        const googleEventId = response.data.id;
        
        console.log(`[Meet Creation] Updating appointment ${appointmentId} with Meet info` + (session ? ' using transaction session' : ''));
        const updateQuery = Appointment.findByIdAndUpdate(appointmentId, {
          googleMeetLink,
          googleEventId,
          videoConferenceLink: googleMeetLink // For backward compatibility
        });
        
        if (session) {
          updateQuery.session(session);
        }
        
        await updateQuery;
        
        return {
          success: true,
          meetLink: googleMeetLink,
          eventId: googleEventId,
          event: response.data
        };
      } catch (calendarError) {
        // Special handling for Google API errors
        if (calendarError.code === 403) {
          console.error('Permission denied when creating Google Calendar event:', calendarError);
          throw new Error('Google Calendar permission denied. Make sure the user has the Calendar API enabled and proper permissions.');
        } else if (calendarError.code === 401) {
          console.error('Google OAuth token is invalid or expired:', calendarError);
          throw new Error('Google account authentication failed. Please reconnect your Google account.');
        } else {
          console.error('Error creating Google Calendar event:', calendarError);
          throw calendarError;
        }
      }
      
    } catch (error) {
      console.error('Error creating Google Meet event:', error);
      throw new Error(`Failed to create Google Meet event: ${error.message}`);
    }
  }
  
  /**
   * Updates an existing Google Calendar event
   * @param {string} userId - The user ID of the admin updating the event
   * @param {string} appointmentId - The appointment ID
   * @returns {Promise<Object>} - The updated event
   */
  async updateMeetingForAppointment(userId, appointmentId) {
    console.log(`Updating Google Meet event for appointment ${appointmentId} by user ${userId}`);
    
    try {
      // Get the user to find their clinic
      const user = await User.findById(userId).select('clinicId googleRefreshToken');
      
      let refreshToken = null;
      
      // First try to get the token from the user if they have one
      if (user && user.googleRefreshToken) {
        console.log('User has their own Google token, using that');
        refreshToken = this.decryptToken(user.googleRefreshToken);
      } 
      // Otherwise, fall back to the clinic token
      else if (user && user.clinicId) {
        console.log('User does not have a Google token, trying to use clinic token');
        const clinic = await Clinic.findById(user.clinicId).select('googleRefreshToken');
        
        if (!clinic || !clinic.googleRefreshToken) {
          throw new Error('Neither user nor clinic has connected a Google account');
        }
        
        refreshToken = this.decryptToken(clinic.googleRefreshToken);
        console.log('Using clinic Google token instead');
      } 
      // If no user or clinic token is found
      else {
        throw new Error('No Google account connected - neither user nor clinic has a refresh token');
      }
      
      // Get the appointment details
      const appointment = await Appointment.findById(appointmentId)
        .populate('patientId', 'firstName lastName')
        .populate('doctorId', 'firstName lastName');
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (!appointment.googleEventId) {
        // If there's no event ID, create a new meeting instead
        return this.createMeetingForAppointment(userId, appointmentId);
      }
      
      // Set the refresh token for this OAuth client
      this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
      
      // Create a Calendar API client
      const calendar = google.calendar({
        version: 'v3',
        auth: this.oAuth2Client
      });
      
      // Parse appointment date and times
      const appointmentDate = new Date(appointment.date);
      const [startHour, startMinute] = appointment.startTime.split(':').map(num => parseInt(num));
      const [endHour, endMinute] = appointment.endTime.split(':').map(num => parseInt(num));
      
      const startDateTime = new Date(appointmentDate);
      startDateTime.setHours(startHour, startMinute, 0);
      
      const endDateTime = new Date(appointmentDate);
      endDateTime.setHours(endHour, endMinute, 0);
      
      // First, get the existing event
      const existingEvent = await calendar.events.get({
        calendarId: 'primary',
        eventId: appointment.googleEventId
      });
      
      // Update the event details
      const updatedEvent = {
        ...existingEvent.data,
        summary: `Appointment: ${appointment.patientId.firstName} ${appointment.patientId.lastName} with Dr. ${appointment.doctorId.firstName} ${appointment.doctorId.lastName}`,
        description: appointment.reasonForVisit || 'Medical appointment',
        start: {
          dateTime: startDateTime.toISOString(),
          timeZone: 'America/New_York',
        },
        end: {
          dateTime: endDateTime.toISOString(),
          timeZone: 'America/New_York',
        }
      };
      
      // Update the event
      const response = await calendar.events.update({
        calendarId: 'primary',
        eventId: appointment.googleEventId,
        resource: updatedEvent,
        sendUpdates: 'none'
      });
      
      console.log('Google Calendar event updated:', response.data.id);
      
      // Update the appointment with any changed meet link
      if (response.data.hangoutLink !== appointment.googleMeetLink) {
        await Appointment.findByIdAndUpdate(appointmentId, {
          googleMeetLink: response.data.hangoutLink,
          videoConferenceLink: response.data.hangoutLink
        });
      }
      
      return {
        success: true,
        meetLink: response.data.hangoutLink,
        eventId: response.data.id,
        event: response.data
      };
      
    } catch (error) {
      console.error('Error updating Google Meet event:', error);
      throw new Error(`Failed to update Google Meet event: ${error.message}`);
    }
  }
  
  /**
   * Deletes a Google Calendar event for a canceled appointment
   * @param {string} userId - The user ID of the admin deleting the event
   * @param {string} appointmentId - The appointment ID
   * @returns {Promise<Object>} - Success status
   */
  async deleteMeetingForAppointment(userId, appointmentId) {
    console.log(`Deleting Google Meet event for appointment ${appointmentId} by user ${userId}`);
    
    try {
      // Get the user to find their clinic
      const user = await User.findById(userId).select('clinicId googleRefreshToken');
      
      let refreshToken = null;
      
      // First try to get the token from the user if they have one
      if (user && user.googleRefreshToken) {
        console.log('User has their own Google token, using that');
        refreshToken = this.decryptToken(user.googleRefreshToken);
      } 
      // Otherwise, fall back to the clinic token
      else if (user && user.clinicId) {
        console.log('User does not have a Google token, trying to use clinic token');
        const clinic = await Clinic.findById(user.clinicId).select('googleRefreshToken');
        
        if (!clinic || !clinic.googleRefreshToken) {
          throw new Error('Neither user nor clinic has connected a Google account');
        }
        
        refreshToken = this.decryptToken(clinic.googleRefreshToken);
        console.log('Using clinic Google token instead');
      } 
      // If no user or clinic token is found
      else {
        throw new Error('No Google account connected - neither user nor clinic has a refresh token');
      }
      
      // Get the appointment details
      const appointment = await Appointment.findById(appointmentId);
      
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      if (!appointment.googleEventId) {
        // If there's no event ID, nothing to delete
        return { success: true, message: 'No Google Calendar event exists for this appointment' };
      }
      
      // Set the refresh token for this OAuth client
      this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
      
      // Create a Calendar API client
      const calendar = google.calendar({
        version: 'v3',
        auth: this.oAuth2Client
      });
      
      // Delete the event
      await calendar.events.delete({
        calendarId: 'primary',
        eventId: appointment.googleEventId,
        sendUpdates: 'none'
      });
      
      console.log('Google Calendar event deleted:', appointment.googleEventId);
      
      // Update the appointment to remove Google Meet info
      await Appointment.findByIdAndUpdate(appointmentId, {
        googleMeetLink: null,
        googleEventId: null,
        videoConferenceLink: null
      });
      
      return {
        success: true,
        message: 'Google Calendar event successfully deleted'
      };
      
    } catch (error) {
      console.error('Error deleting Google Meet event:', error);
      throw new Error(`Failed to delete Google Meet event: ${error.message}`);
    }
  }
  
  /**
   * Encrypt a token for secure storage in the database
   * @param {string} token - The token to encrypt
   * @returns {string} - The encrypted token
   */
  encryptToken(token) {
    if (!this.encryptionKey) return token; // If no key, return unencrypted
    
    try {
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
      let encrypted = cipher.update(token, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return `${iv.toString('hex')}:${encrypted}`;
    } catch (error) {
      console.error('Error encrypting token:', error);
      return token; // Return unencrypted on error
    }
  }
  
  /**
   * Decrypt a token from the database
   * @param {string} encryptedToken - The encrypted token
   * @returns {string} - The decrypted token
   */
  decryptToken(encryptedToken) {
    if (!this.encryptionKey || !encryptedToken.includes(':')) return encryptedToken;
    
    try {
      const parts = encryptedToken.split(':');
      const iv = Buffer.from(parts[0], 'hex');
      const encryptedText = parts[1];
      const decipher = crypto.createDecipheriv(this.algorithm, Buffer.from(this.encryptionKey, 'hex'), iv);
      let decrypted = decipher.update(encryptedText, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Error decrypting token:', error);
      return encryptedToken; // Return original on error
    }
  }

  /**
   * Verify if user has proper Google API permissions
   * @param {string} userId - User ID to check permissions for
   * @returns {Promise<boolean>} - True if permissions are valid
   */
  async checkPermissions(userId) {
    try {
      const user = await User.findById(userId).select('googleRefreshToken');
      
      if (!user || !user.googleRefreshToken) {
        console.log('No Google refresh token found for user', userId);
        return false;
      }
      
      const refreshToken = this.decryptToken(user.googleRefreshToken);
      this.oAuth2Client.setCredentials({ refresh_token: refreshToken });
      
      // Check if token is valid and has calendar scopes
      try {
        console.log('Checking token info and scopes for user', userId);
        const tokenInfo = await this.oAuth2Client.getTokenInfo(refreshToken);
        
        // Check if token has required scopes
        const hasRequiredScopes = this.requiredScopes.every(
          scope => tokenInfo.scopes.includes(scope)
        );
        
        if (!hasRequiredScopes) {
          console.log('Missing required scopes. Found:', tokenInfo.scopes);
          console.log('Required:', this.requiredScopes);
          return false;
        }
        
        console.log('Token valid with required scopes for user', userId);
        return true;
      } catch (error) {
        console.error('Error validating token or scopes:', error);
        return false;
      }
    } catch (error) {
      console.error('Error checking permissions:', error);
      return false;
    }
  }
}

export default new GoogleCalendarService(); 