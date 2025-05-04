// Development-only service that mimics the Google Calendar API
// but generates fake Google Meet links for testing

import crypto from 'crypto';

class DevMeetLinkGenerator {
  constructor() {
    console.log('⚠️ DEVELOPMENT MODE: Using fake Google Meet link generator');
    console.log('This should NOT be used in production!');
  }

  /**
   * Generate a realistic-looking but fake Google Meet link
   * @returns {string} - A fake Google Meet link
   */
  generateMeetLink() {
    // Generate a random 10-character string (like real Meet codes)
    const randomCode = crypto.randomBytes(5).toString('hex');
    return `https://meet.google.com/${randomCode.substring(0, 3)}-${randomCode.substring(3, 7)}-${randomCode.substring(7, 10)}`;
  }

  /**
   * Create a fake meeting for an appointment
   * @param {string} userId - Any user ID (ignored in dev mode)
   * @param {string} appointmentId - The appointment ID
   * @returns {Promise<Object>} - Fake success response with meet link
   */
  async createMeetingForAppointment(userId, appointmentId) {
    console.log(`DEV MODE: Creating fake meeting for appointment ${appointmentId}`);
    
    try {
      // Generate a fake meet link
      const meetLink = this.generateMeetLink();
      const eventId = `dev_${crypto.randomUUID()}`;
      
      // Update the appointment with the fake link
      const Appointment = (await import('../models/Appointment.mjs')).default;
      
      await Appointment.findByIdAndUpdate(appointmentId, {
        googleMeetLink: meetLink,
        googleEventId: eventId,
        videoConferenceLink: meetLink
      });
      
      console.log(`DEV MODE: Created fake meeting link: ${meetLink}`);
      
      return {
        success: true,
        meetLink,
        eventId,
        event: {
          id: eventId,
          hangoutLink: meetLink,
          summary: "DEV MODE: Fake Google Meet Event"
        }
      };
    } catch (error) {
      console.error('Error in dev mode creating fake meet link:', error);
      throw new Error(`Failed to create fake meet link: ${error.message}`);
    }
  }
  
  /**
   * Update a fake meeting for an appointment
   * @param {string} userId - Any user ID (ignored in dev mode)
   * @param {string} appointmentId - The appointment ID
   * @returns {Promise<Object>} - Fake success response
   */
  async updateMeetingForAppointment(userId, appointmentId) {
    return this.createMeetingForAppointment(userId, appointmentId);
  }
  
  /**
   * Delete a fake meeting for an appointment
   * @param {string} userId - Any user ID (ignored in dev mode)
   * @param {string} appointmentId - The appointment ID
   * @returns {Promise<Object>} - Fake success response
   */
  async deleteMeetingForAppointment(userId, appointmentId) {
    console.log(`DEV MODE: Deleting fake meeting for appointment ${appointmentId}`);
    
    try {
      // Update the appointment to remove Google Meet info
      const Appointment = (await import('../models/Appointment.mjs')).default;
      
      await Appointment.findByIdAndUpdate(appointmentId, {
        googleMeetLink: null,
        googleEventId: null,
        videoConferenceLink: null
      });
      
      return {
        success: true,
        message: 'DEV MODE: Fake Google meeting deleted successfully'
      };
    } catch (error) {
      console.error('Error in dev mode deleting fake meet link:', error);
      throw new Error(`Failed to delete fake meet link: ${error.message}`);
    }
  }
}

export default new DevMeetLinkGenerator(); 