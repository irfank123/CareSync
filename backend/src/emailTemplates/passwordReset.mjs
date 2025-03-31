// src/emailTemplates/passwordReset.mjs

/**
 * Generate password reset email template
 * @param {Object} params - Template parameters
 * @param {string} params.appName - Application name
 * @param {string} params.resetUrl - Password reset URL
 * @returns {Object} Email template HTML and text
 */
const passwordResetTemplate = (params) => {
    const { appName, resetUrl } = params;
    const currentYear = new Date().getFullYear();
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Reset Your Password</h2>
          <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
          <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </div>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Best regards,<br>The ${appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${currentYear} ${appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Reset Your ${appName} Password
      
      You are receiving this email because you (or someone else) has requested a password reset for your account.
      
      Please click the link below to reset your password. This link will expire in 1 hour.
      
      ${resetUrl}
      
      If you did not request a password reset, please ignore this email or contact support if you have concerns.
      
      Best regards,
      The ${appName} Team
      
      © ${currentYear} ${appName}. All rights reserved.
    `;
    
    return { html, text };
};
  
export default passwordResetTemplate;