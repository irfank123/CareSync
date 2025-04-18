// src/emailTemplates/appointmentConfirmation.mjs

/**
 * Generate appointment confirmation email template
 * @param {Object} params - Template parameters
 * @param {string} params.appName - Application name
 * @param {Object} params.appointment - Appointment details
 * @param {Object} params.patient - Patient details
 * @param {Object} params.doctor - Doctor details
 * @param {string} params.frontendUrl - Frontend URL
 * @returns {Object} Email template HTML and text
 */
const appointmentConfirmationTemplate = (params) => {
    const { appName, appointment, patient, doctor, frontendUrl } = params;
    const currentYear = new Date().getFullYear();
    
    // Format date and time for display
    const appointmentDate = new Date(appointment.date);
    const formattedDate = appointmentDate.toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Appointment Confirmation</h2>
          <p>Dear ${patient.firstName},</p>
          <p>Your appointment with Dr. ${doctor.firstName} ${doctor.lastName} has been confirmed for:</p>
          <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Time:</strong> ${appointment.startTime} - ${appointment.endTime}</p>
            <p><strong>Type:</strong> ${appointment.isVirtual ? 'Virtual Consultation' : 'In-Person Visit'}</p>
          </div>
          ${appointment.isVirtual ? `
            <p>You will be able to join the virtual consultation through your dashboard at the scheduled time.</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${frontendUrl}/appointments/${appointment._id}" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Appointment</a>
            </div>
          ` : ''}
          <p>If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
          <p>Best regards,<br>The ${appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${currentYear} ${appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Appointment Confirmation
      
      Dear ${patient.firstName},
      
      Your appointment with Dr. ${doctor.firstName} ${doctor.lastName} has been confirmed for:
      
      Date: ${formattedDate}
      Time: ${appointment.startTime} - ${appointment.endTime}
      Type: ${appointment.isVirtual ? 'Virtual Consultation' : 'In-Person Visit'}
      
      ${appointment.isVirtual ? `You will be able to join the virtual consultation through your dashboard at the scheduled time.
      Visit: ${frontendUrl}/appointments/${appointment._id}` : ''}
      
      If you need to reschedule or cancel, please do so at least 24 hours in advance.
      
      Best regards,
      The ${appName} Team
      
      © ${currentYear} ${appName}. All rights reserved.
    `;
    
    return { html, text };
};
  
export default appointmentConfirmationTemplate;