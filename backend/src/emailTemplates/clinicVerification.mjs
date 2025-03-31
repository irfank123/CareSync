// src/emailTemplates/clinicVerification.mjs

/**
 * Generate clinic verification email template
 * @param {Object} params - Template parameters
 * @param {string} params.appName - Application name
 * @param {string} params.clinicName - Clinic name
 * @param {string} params.status - Verification status
 * @param {string} params.notes - Verification notes (for rejections)
 * @param {string} params.frontendUrl - Frontend URL
 * @returns {Object} Email template HTML and text
 */
const clinicVerificationTemplate = (params) => {
    const { appName, clinicName, status, notes, frontendUrl } = params;
    const currentYear = new Date().getFullYear();
    
    let title = '';
    let message = '';
    let actionButton = '';
    
    // Customize content based on verification status
    if (status === 'verified') {
      title = 'Congratulations!';
      message = `<p>Your clinic "${clinicName}" has been verified successfully. You can now access all features of the platform.</p>`;
      actionButton = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}/clinic/dashboard" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
        </div>
      `;
    } else if (status === 'rejected') {
      title = 'Verification Update';
      message = `
        <p>We're sorry, but your clinic "${clinicName}" verification has been rejected for the following reason:</p>
        <div style="background-color: #f5f5f5; padding: 15px; margin: 20px 0;">
          <p>${notes || 'No reason provided.'}</p>
        </div>
        <p>Please address these issues and resubmit your verification documents.</p>
      `;
      actionButton = `
        <div style="text-align: center; margin: 30px 0;">
          <a href="${frontendUrl}/clinic/verification" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Update Verification</a>
        </div>
      `;
    } else if (status === 'in_review') {
      title = 'Verification In Progress';
      message = `
        <p>Your clinic "${clinicName}" verification documents have been received and are currently under review.</p>
        <p>This process typically takes 1-3 business days. We will notify you once the review is complete.</p>
      `;
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>${title}</h2>
          ${message}
          ${actionButton}
          <p>If you have any questions, please contact our support team.</p>
          <p>Best regards,<br>The ${appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${currentYear} ${appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    // Build plain text version
    let textTitle = '';
    let textMessage = '';
    
    if (status === 'verified') {
      textTitle = 'Congratulations!';
      textMessage = `Your clinic "${clinicName}" has been verified successfully. You can now access all features of the platform.`;
    } else if (status === 'rejected') {
      textTitle = 'Verification Update';
      textMessage = `We're sorry, but your clinic "${clinicName}" verification has been rejected for the following reason:\n\n${notes || 'No reason provided.'}\n\nPlease address these issues and resubmit your verification documents.`;
    } else if (status === 'in_review') {
      textTitle = 'Verification In Progress';
      textMessage = `Your clinic "${clinicName}" verification documents have been received and are currently under review.\n\nThis process typically takes 1-3 business days. We will notify you once the review is complete.`;
    }
    
    const text = `
      ${textTitle}
      
      ${textMessage}
      
      If you have any questions, please contact our support team.
      
      Best regards,
      The ${appName} Team
      
      © ${currentYear} ${appName}. All rights reserved.
    `;
    
    return { html, text };
  };
  
  export default clinicVerificationTemplate;