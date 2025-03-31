// src/emailTemplates/welcome.mjs

/**
 * Generate welcome email template
 * @param {Object} params - Template parameters
 * @param {string} params.appName - Application name
 * @param {string} params.firstName - Recipient's first name
 * @param {string} params.role - User role (patient, doctor, etc.)
 * @param {string} params.roleText - Role-specific text
 * @param {string} params.frontendUrl - Frontend URL
 * @returns {Object} Email template HTML and text
 */
const welcomeTemplate = (params) => {
    const { appName, firstName, role, roleText, frontendUrl } = params;
    const currentYear = new Date().getFullYear();
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Welcome, ${firstName}!</h2>
          <p>Thank you for joining ${appName}. We're excited to have you on board!</p>
          <p>As a ${role}, you can now ${roleText}.</p>
          <p>To get started, please take a moment to complete your profile and explore the features available to you.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${frontendUrl}/dashboard" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
          </div>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The ${appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${currentYear} ${appName}. All rights reserved.</p>
          <p>
            <a href="${frontendUrl}/privacy-policy" style="color: #4a90e2; text-decoration: none;">Privacy Policy</a> | 
            <a href="${frontendUrl}/terms-of-service" style="color: #4a90e2; text-decoration: none;">Terms of Service</a>
          </p>
        </div>
      </div>
    `;
    
    const text = `
      Welcome to ${appName}, ${firstName}!
      
      Thank you for joining ${appName}. We're excited to have you on board!
      
      As a ${role}, you can now ${roleText}.
      
      To get started, please take a moment to complete your profile and explore the features available to you.
      
      Visit your dashboard: ${frontendUrl}/dashboard
      
      If you have any questions or need assistance, please don't hesitate to contact our support team.
      
      Best regards,
      The ${appName} Team
      
      © ${currentYear} ${appName}. All rights reserved.
    `;
    
    return { html, text };
  };
  
  export default welcomeTemplate;