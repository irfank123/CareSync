// src/services/emailService.mjs

import nodemailer from 'nodemailer';
import loadAndValidateConfig from '../config/config.mjs';
const config = loadAndValidateConfig();

import {
  welcomeTemplate,
  verificationTemplate,
  passwordResetTemplate,
  mfaCodeTemplate,
  appointmentConfirmationTemplate,
  clinicVerificationTemplate,
  appointmentReminderTemplate
} from '../emailTemplates/index.mjs';

/**
 * Email Service for sending various types of emails
 */
class EmailService {
  constructor() {
    this.from = config.email.from;
    this.frontendUrl = config.frontendUrl;
    this.initialized = false;
    this.emailQueue = [];
    
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
      this.initialized = true;
    } else {
      // In development, we'll set up the transporter later
      this.transporter = null;
    }
  }
  
  /**
   * Set up development email transport (Ethereal)
   * This creates a test account with Ethereal for preview
   */
  async setupDevTransport() {
    if (this.transporter) {
      return this.transporter; // Already initialized
    }
    
    try {
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
      
      this.initialized = true;
      
      // Process any queued emails
      await this._processQueue();
      
      return this.transporter;
    } catch (error) {
      console.error('Failed to set up dev email transport:', error);
      // Set up a dummy transport that logs emails
      this.transporter = {
        sendMail: (options) => {
          console.log('Email would be sent:', options);
          return Promise.resolve({ messageId: 'dev-mode-no-email-sent' });
        }
      };
      this.initialized = true;
      
      // Process any queued emails
      await this._processQueue();
      
      return this.transporter;
    }
  }
  
  /**
   * Process any emails in the queue
   * @private
   */
  async _processQueue() {
    if (!this.initialized || this.emailQueue.length === 0) {
      return;
    }
    
    console.log(`Processing ${this.emailQueue.length} queued emails`);
    
    // Process all emails in the queue
    const queue = [...this.emailQueue];
    this.emailQueue = [];
    
    for (const { options, resolve, reject } of queue) {
      try {
        const result = await this._sendEmailImmediate(options);
        resolve(result);
      } catch (error) {
        reject(error);
      }
    }
  }
  
  /**
   * Send an email (will queue if not initialized)
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   */
  async sendEmail(options) {
    // If not initialized, queue the email
    if (!this.initialized) {
      return new Promise((resolve, reject) => {
        this.emailQueue.push({ options, resolve, reject });
        console.log('Email queued until service is initialized');
      });
    }
    
    // Otherwise send immediately
    return this._sendEmailImmediate(options);
  }
  
  /**
   * Send an email immediately (internal method)
   * @param {Object} options - Email options
   * @returns {Promise<Object>} Send result
   * @private
   */
  async _sendEmailImmediate(options) {
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
   * Send verification email
   * @param {string} email - Recipient email
   * @param {string} code - Verification code
   * @returns {Promise<Object>} Send result
   */
  async sendVerificationEmail(email, code) {
    // Generate email content from template
    const { html, text } = verificationTemplate({
      appName: config.appName,
      code
    });
    
    return this.sendEmail({
      to: email,
      subject: `Verify your ${config.appName} email address`,
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
    // Generate email content from template
    const { html, text } = passwordResetTemplate({
      appName: config.appName,
      resetUrl
    });
    
    return this.sendEmail({
      to: email,
      subject: `Reset your ${config.appName} password`,
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
    // Generate email content from template
    const { html, text } = mfaCodeTemplate({
      appName: config.appName,
      code
    });
    
    return this.sendEmail({
      to: email,
      subject: `Your ${config.appName} verification code`,
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
    // Generate email content from template
    const { html, text } = appointmentConfirmationTemplate({
      appName: config.appName,
      appointment,
      patient,
      doctor,
      frontendUrl: this.frontendUrl
    });
    
    return this.sendEmail({
      to: patient.email,
      subject: `Your appointment with Dr. ${doctor.lastName} is confirmed`,
      html,
      text
    });
  }
  
  /**
   * Send clinic verification email
   * @param {Object} clinic - Clinic data
   * @param {string} status - Verification status
   * @param {string} notes - Verification notes (for rejections)
   * @returns {Promise<Object>} Send result
   */
  async sendClinicVerificationEmail(clinic, status, notes = '') {
    // Generate email content from template
    const { html, text } = clinicVerificationTemplate({
      appName: config.appName,
      clinicName: clinic.name,
      status,
      notes,
      frontendUrl: this.frontendUrl
    });
    
    // Set subject based on status
    let subject = 'Clinic Verification Update';
    if (status === 'verified') {
      subject = 'Your Clinic Has Been Verified';
    } else if (status === 'in_review') {
      subject = 'Clinic Verification In Progress';
    }
    
    return this.sendEmail({
      to: clinic.email,
      subject,
      html,
      text
    });
  }
  
  /**
   * Send welcome email
   * @param {string} email - Recipient email
   * @param {string} firstName - Recipient first name
   * @param {string} role - User role (patient, doctor, etc.)
   * @returns {Promise<Object>} Send result
   */
  async sendWelcomeEmail(email, firstName, role) {
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
    
    // Generate email content from template
    const { html, text } = welcomeTemplate({
      appName: config.appName,
      firstName,
      role,
      roleText,
      frontendUrl: this.frontendUrl
    });
    
    return this.sendEmail({
      to: email,
      subject: `Welcome to ${config.appName}!`,
      html,
      text
    });
  }

  /**
   * Send appointment reminder email
   * @param {Object} appointment - Appointment data
   * @param {Object} patient - Patient data
   * @param {Object} doctor - Doctor data
   * @returns {Promise<Object>} Send result
   */
  async sendAppointmentReminder(appointment, patient, doctor) {
    // Generate email content from template
    const { html, text } = appointmentReminderTemplate({
      appName: config.appName,
      appointment,
      patient,
      doctor,
      frontendUrl: this.frontendUrl
    });
    
    return this.sendEmail({
      to: patient.email,
      subject: `Reminder: Your Appointment with Dr. ${doctor.lastName}`,
      html,
      text
    });
  }
}

// Export a single instance
export default new EmailService();