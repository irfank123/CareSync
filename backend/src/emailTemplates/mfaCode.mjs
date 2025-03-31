// src/emailTemplates/mfaCode.mjs

/**
 * Generate MFA code email template
 * @param {Object} params - Template parameters
 * @param {string} params.appName - Application name
 * @param {string} params.code - MFA code
 * @returns {Object} Email template HTML and text
 */
const mfaCodeTemplate = (params) => {
    const { appName, code } = params;
    const currentYear = new Date().getFullYear();
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Your Verification Code</h2>
          <p>You've requested to log in to your ${appName} account. Please use the verification code below to complete your login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f5f5f5; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${code}
            </div>
          </div>
          <p>This code will expire in 10 minutes. If you did not attempt to log in, please change your password immediately.</p>
          <p>Best regards,<br>The ${appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${currentYear} ${appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Your ${appName} Verification Code
      
      You've requested to log in to your ${appName} account. Please use the verification code below to complete your login:
      
      ${code}
      
      This code will expire in 10 minutes. If you did not attempt to log in, please change your password immediately.
      
      Best regards,
      The ${appName} Team
      
      © ${currentYear} ${appName}. All rights reserved.
    `;
    
    return { html, text };
  };
  
  export default mfaCodeTemplate;