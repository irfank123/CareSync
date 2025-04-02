
// src/services/emailService.mjs

import config from '../config/config.mjs';
import nodemailer from 'nodemailer';
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
      // In development, set up a default transporter
      // We'll initialize it properly when needed
      this.transporter = null;
      // Initialize asynchronously
      this.initDevTransport();
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
      frontendUrl: config.frontendUrl
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
      frontendUrl: config.frontendUrl
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
      frontendUrl: config.frontendUrl
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
    const { appointmentReminderTemplate } = await import('../emailTemplates/index.mjs');
    
    const { html, text } = appointmentReminderTemplate({
      appName: config.appName,
      appointment,
      patient,
      doctor,
      frontendUrl: config.frontendUrl
    });
    
    return this.sendEmail({
      to: patient.email,
      subject: `Reminder: Your Appointment with Dr. ${doctor.lastName}`,
      html,
      text
    });
  }
    
  //method to handle async initialization
  async initDevTransport() {
    try {
      const testAccount = await nodemailer.createTestAccount();
      
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
    } catch (error) {
      console.error('Failed to set up dev email transport:', error);
      // Set up a dummy transport that logs emails
      this.transporter = {
        sendMail: (options) => {
          console.log('Email would be sent:', options);
          return Promise.resolve({ messageId: 'dev-mode-no-email-sent' });
        }
      };
    }
  } 
}