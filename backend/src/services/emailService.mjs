// src/services/emailService.mjs

import config from '../config/config.mjs';
import nodemailer from 'nodemailer';

/**
 * Email Service for sending various types of emails
 */
class EmailService {
  constructor() {
    this.from = config.email.from;
    
    // Create transporter based on environment
    if (process.env.NODE_ENV === 'production') {
      // In production, use configured email provider
      this.transporter = nodemailer.createTransport({
        host: config.email.host,
        port: config.email.port,
        secure: config.email.port === 465, // true for 465, false for other ports
        auth: {
          user: config.email.auth.user,
          pass: config.email.auth.pass
        }
      });
    } else {
      // In development, log emails to console and/or use a test service
      // like Ethereal (https://ethereal.email/) or Mailtrap
      this.setupDevTransport();
    }
  }
  
  /**
   * Set up development email transport
   * This creates a test account with Ethereal for preview
   */
  async setupDevTransport() {
    // Generate test SMTP service account from ethereal.email
    const testAccount = await nodemailer.createTestAccount();
    
    // Create a reusable transporter object using the default SMTP transport
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    
    console.log('Development email setup complete');
    console.log('Test Email Account:', testAccount.user);
  }
  
  /**
   * Send an email
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    try {
      const mailOptions = {
        from: `"${config.appName}" <${this.from}>`,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html
      };
      
      // Add CC if specified
      if (options.cc) {
        mailOptions.cc = options.cc;
      }
      
      // Add BCC if specified
      if (options.bcc) {
        mailOptions.bcc = options.bcc;
      }
      
      // Add attachments if specified
      if (options.attachments && Array.isArray(options.attachments)) {
        mailOptions.attachments = options.attachments;
      }
      
      // Send email
      const info = await this.transporter.sendMail(mailOptions);
      
      // Log email preview URL in development
      if (process.env.NODE_ENV !== 'production') {
        console.log('Email preview URL:', nodemailer.getTestMessageUrl(info));
      }
      
      return {
        success: true,
        messageId: info.messageId,
        info
      };
    } catch (error) {
      console.error('Email sending failed:', error);
      throw new Error(`Failed to send email: ${error.message}`);
    }
  }
  
  /**
   * Send welcome email
   * @param {string} email - Recipient email
   * @param {string} firstName - Recipient first name
   * @param {string} role - User role (patient, doctor, etc.)
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(email, firstName, role) {
    const subject = `Welcome to ${config.appName}!`;
    
    // Personalize email based on role
    let roleText = '';
    if (role === 'patient') {
      roleText = 'access your health records, schedule appointments, and communicate with healthcare providers';
    } else if (role === 'doctor') {
      roleText = 'manage your schedule, conduct virtual consultations, and communicate with patients';
    } else if (role === 'staff') {
      roleText = 'assist with clinic operations, manage appointments, and support patients and doctors';
    } else if (role === 'clinic') {
      roleText = 'manage your clinic, staff, and patients all in one place';
    }
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${config.appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Welcome, ${firstName}!</h2>
          <p>Thank you for joining ${config.appName}. We're excited to have you on board!</p>
          <p>As a ${role}, you can now ${roleText}.</p>
          <p>To get started, please take a moment to complete your profile and explore the features available to you.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${config.frontendUrl}/dashboard" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Dashboard</a>
          </div>
          <p>If you have any questions or need assistance, please don't hesitate to contact our support team.</p>
          <p>Best regards,<br>The ${config.appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
          <p>
            <a href="${config.frontendUrl}/privacy-policy" style="color: #4a90e2; text-decoration: none;">Privacy Policy</a> | 
            <a href="${config.frontendUrl}/terms-of-service" style="color: #4a90e2; text-decoration: none;">Terms of Service</a>
          </p>
        </div>
      </div>
    `;
    
    const text = `
      Welcome to ${config.appName}, ${firstName}!
      
      Thank you for joining ${config.appName}. We're excited to have you on board!
      
      As a ${role}, you can now ${roleText}.
      
      To get started, please take a moment to complete your profile and explore the features available to you.
      
      Visit your dashboard: ${config.frontendUrl}/dashboard
      
      If you have any questions or need assistance, please don't hesitate to contact our support team.
      
      Best regards,
      The ${config.appName} Team
      
      © ${new Date().getFullYear()} ${config.appName}. All rights reserved.
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
  
  /**
   * Send verification email
   * @param {string} email - Recipient email
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationEmail(email, code) {
    const subject = `Verify your ${config.appName} email address`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${config.appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Verify Your Email Address</h2>
          <p>Thank you for registering with ${config.appName}. To complete your registration, please verify your email address using the code below:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f5f5f5; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${code}
            </div>
          </div>
          <p>This code will expire in 24 hours. If you did not request this verification, please ignore this email.</p>
          <p>Best regards,<br>The ${config.appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Verify Your ${config.appName} Email Address
      
      Thank you for registering with ${config.appName}. To complete your registration, please verify your email address using the code below:
      
      ${code}
      
      This code will expire in 24 hours. If you did not request this verification, please ignore this email.
      
      Best regards,
      The ${config.appName} Team
      
      © ${new Date().getFullYear()} ${config.appName}. All rights reserved.
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
  
  /**
   * Send password reset email
   * @param {string} email - Recipient email
   * @param {string} resetUrl - Password reset URL
   * @returns {Promise<Object>} Send result
   */
  async sendPasswordResetEmail(email, resetUrl) {
    const subject = `Reset your ${config.appName} password`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${config.appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Reset Your Password</h2>
          <p>You are receiving this email because you (or someone else) has requested a password reset for your account.</p>
          <p>Please click the button below to reset your password. This link will expire in 1 hour.</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Reset Password</a>
          </div>
          <p>If you did not request a password reset, please ignore this email or contact support if you have concerns.</p>
          <p>Best regards,<br>The ${config.appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Reset Your ${config.appName} Password
      
      You are receiving this email because you (or someone else) has requested a password reset for your account.
      
      Please click the link below to reset your password. This link will expire in 1 hour.
      
      ${resetUrl}
      
      If you did not request a password reset, please ignore this email or contact support if you have concerns.
      
      Best regards,
      The ${config.appName} Team
      
      © ${new Date().getFullYear()} ${config.appName}. All rights reserved.
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
  
  /**
   * Send MFA code
   * @param {string} email - Recipient email
   * @param {string} code - MFA code
   * @returns {Promise<Object>} Send result
   */
  async sendMfaEmail(email, code) {
    const subject = `Your ${config.appName} verification code`;
    
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #4a90e2; padding: 20px; text-align: center; color: white;">
          <h1>${config.appName}</h1>
        </div>
        <div style="padding: 20px; border: 1px solid #e9e9e9; border-top: none;">
          <h2>Your Verification Code</h2>
          <p>You've requested to log in to your ${config.appName} account. Please use the verification code below to complete your login:</p>
          <div style="text-align: center; margin: 30px 0;">
            <div style="background-color: #f5f5f5; padding: 15px; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
              ${code}
            </div>
          </div>
          <p>This code will expire in 10 minutes. If you did not attempt to log in, please change your password immediately.</p>
          <p>Best regards,<br>The ${config.appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
        </div>
      </div>
    `;
    
    const text = `
      Your ${config.appName} Verification Code
      
      You've requested to log in to your ${config.appName} account. Please use the verification code below to complete your login:
      
      ${code}
      
      This code will expire in 10 minutes. If you did not attempt to log in, please change your password immediately.
      
      Best regards,
      The ${config.appName} Team
      
      © ${new Date().getFullYear()} ${config.appName}. All rights reserved.
    `;
    
    return this.sendEmail({
      to: email,
      subject,
      html,
      text
    });
  }
  
  /**
   * Send appointment confirmation
   * @param {Object} appointment - Appointment data
   * @param {Object} patient - Patient data
   * @param {Object} doctor - Doctor data
   * @returns {Promise<Object>} Send result
   */
  async sendAppointmentConfirmation(appointment, patient, doctor) {
    const to = patient.email;
    const subject = `Your appointment with Dr. ${doctor.lastName} is confirmed`;
    
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
          <h1>${config.appName}</h1>
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
              <a href="${config.frontendUrl}/appointments/${appointment._id}" style="background-color: #4a90e2; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Go to Appointment</a>
            </div>
          ` : ''}
          <p>If you need to reschedule or cancel, please do so at least 24 hours in advance.</p>
          <p>Best regards,<br>The ${config.appName} Team</p>
        </div>
        <div style="background-color: #f5f5f5; padding: 15px; text-align: center; font-size: 12px; color: #666;">
          <p>© ${new Date().getFullYear()} ${config.appName}. All rights reserved.</p>
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
      Visit: ${config.frontendUrl}/appointments/${appointment._id}` : ''}
      
      If you need to reschedule or cancel, please do so at least 24 hours in advance.
      
      Best regards,
      The ${config.appName} Team
      
      © ${new Date().getFullYear()} ${config.appName}. All rights reserved.
    `;
    
    return this.sendEmail({
      to,
      subject,
      html,
      text
    });
  }
}


export default new EmailService();