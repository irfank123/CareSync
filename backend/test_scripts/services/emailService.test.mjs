import emailService from '../../src/services/emailService.mjs';
import nodemailer from 'nodemailer';
import {
  welcomeTemplate,
  verificationTemplate,
  passwordResetTemplate,
  mfaCodeTemplate,
  appointmentConfirmationTemplate,
  clinicVerificationTemplate,
  appointmentReminderTemplate
} from '../../src/emailTemplates/index.mjs';

// Mock dependencies
jest.mock('nodemailer', () => ({
  createTransport: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({
      messageId: 'test-message-id',
      response: 'test-response'
    })
  }),
  createTestAccount: jest.fn().mockResolvedValue({
    user: 'test-user',
    pass: 'test-pass'
  }),
  getTestMessageUrl: jest.fn().mockReturnValue('https://ethereal.email/test-message-url')
}));

jest.mock('../../src/emailTemplates/index.mjs', () => ({
  welcomeTemplate: jest.fn().mockReturnValue({
    html: '<p>Welcome HTML</p>',
    text: 'Welcome Text'
  }),
  verificationTemplate: jest.fn().mockReturnValue({
    html: '<p>Verification HTML</p>',
    text: 'Verification Text'
  }),
  passwordResetTemplate: jest.fn().mockReturnValue({
    html: '<p>Password Reset HTML</p>',
    text: 'Password Reset Text'
  }),
  mfaCodeTemplate: jest.fn().mockReturnValue({
    html: '<p>MFA Code HTML</p>',
    text: 'MFA Code Text'
  }),
  appointmentConfirmationTemplate: jest.fn().mockReturnValue({
    html: '<p>Appointment Confirmation HTML</p>',
    text: 'Appointment Confirmation Text'
  }),
  clinicVerificationTemplate: jest.fn().mockReturnValue({
    html: '<p>Clinic Verification HTML</p>',
    text: 'Clinic Verification Text'
  }),
  appointmentReminderTemplate: jest.fn().mockReturnValue({
    html: '<p>Appointment Reminder HTML</p>',
    text: 'Appointment Reminder Text'
  })
}));

// Mock config
jest.mock('../../src/config/config.mjs', () => () => ({
  appName: 'CareSync Test',
  email: {
    from: 'test@caresync.com',
    host: 'smtp.test.com',
    port: 587,
    auth: {
      user: 'test-user',
      pass: 'test-pass'
    }
  },
  frontendUrl: 'https://test.caresync.com'
}));

describe('EmailService', () => {
  let originalNodeEnv;
  let mockTransporterSendMail;

  beforeEach(() => {
    originalNodeEnv = process.env.NODE_ENV;
    mockTransporterSendMail = nodemailer.createTransport().sendMail;
    
    // Reset mocks
    jest.clearAllMocks();

    // Set our private properties for testing
    emailService.initialized = true;
    emailService.transporter = nodemailer.createTransport();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('constructor', () => {
    it('should create a production transporter when NODE_ENV is production', () => {
      process.env.NODE_ENV = 'production';
      
      // Create a new instance to test constructor
      const EmailServiceClass = emailService.constructor;
      const instance = new EmailServiceClass();
      
      expect(instance.initialized).toBe(true);
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.test.com',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass'
        }
      });
    });

    it('should not create a transporter in non-production environment', () => {
      process.env.NODE_ENV = 'development';
      
      // Reset nodemailer mock call count
      nodemailer.createTransport.mockClear();
      
      // Create a new instance to test constructor
      const EmailServiceClass = emailService.constructor;
      const instance = new EmailServiceClass();
      
      expect(instance.initialized).toBe(false);
      expect(instance.transporter).toBeNull();
      expect(nodemailer.createTransport).not.toHaveBeenCalled();
    });
  });

  describe('setupDevTransport', () => {
    it('should create a test transport in development', async () => {
      // Reset the initialized flag to simulate initial setup
      emailService.initialized = false;
      emailService.transporter = null;

      await emailService.setupDevTransport();

      expect(nodemailer.createTestAccount).toHaveBeenCalled();
      expect(nodemailer.createTransport).toHaveBeenCalledWith({
        host: 'smtp.ethereal.email',
        port: 587,
        secure: false,
        auth: {
          user: 'test-user',
          pass: 'test-pass'
        }
      });
      expect(emailService.initialized).toBe(true);
    });

    it('should handle errors when setting up dev transport', async () => {
      // Reset the initialized flag to simulate initial setup
      emailService.initialized = false;
      emailService.transporter = null;

      // Mock console.error to prevent output during test
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force an error in createTestAccount
      nodemailer.createTestAccount.mockRejectedValueOnce(new Error('Test Error'));

      await emailService.setupDevTransport();

      // Should have a dummy transport
      expect(emailService.initialized).toBe(true);
      expect(emailService.transporter).toBeDefined();
      expect(console.error).toHaveBeenCalledWith('Failed to set up dev email transport:', expect.any(Error));

      // Restore console.error
      console.error = originalConsoleError;
    });

    it('should test dummy transport sendMail function directly when setup fails', async () => {
      // Reset the initialized flag to simulate initial setup
      emailService.initialized = false;
      emailService.transporter = null;

      // Mock console functions to prevent output during test
      const originalConsoleError = console.error;
      const originalConsoleLog = console.log;
      console.error = jest.fn();
      console.log = jest.fn();

      // Force an error in createTestAccount
      nodemailer.createTestAccount.mockRejectedValueOnce(new Error('Test Error'));

      await emailService.setupDevTransport();

      // Should have a dummy transport
      expect(emailService.initialized).toBe(true);
      
      // Test the dummy transport's sendMail function directly
      const emailOptions = { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' };
      const result = await emailService.transporter.sendMail(emailOptions);
      
      expect(console.log).toHaveBeenCalledWith('Email would be sent:', emailOptions);
      expect(result).toEqual({ messageId: 'dev-mode-no-email-sent' });

      // Restore console functions
      console.error = originalConsoleError;
      console.log = originalConsoleLog;
    });

    it('should return existing transporter if already initialized', async () => {
      // Setup already initialized
      emailService.initialized = true;
      const existingTransporter = emailService.transporter;

      const result = await emailService.setupDevTransport();

      expect(result).toBe(existingTransporter);
      expect(nodemailer.createTestAccount).not.toHaveBeenCalled();
    });

    it('should process queued emails after initialization', async () => {
      // Reset and queue an email
      emailService.initialized = false;
      emailService.transporter = null;
      emailService.emailQueue = [{
        options: { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' },
        resolve: jest.fn(),
        reject: jest.fn()
      }];

      // Mock console.log to prevent output during test
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      await emailService.setupDevTransport();

      // Should have processed the queue
      expect(emailService.emailQueue).toHaveLength(0);
      expect(mockTransporterSendMail).toHaveBeenCalled();
      expect(emailService.emailQueue[0]?.resolve).not.toBeDefined(); // Should have been removed from queue

      // Restore console.log
      console.log = originalConsoleLog;
    });
  });

  describe('sendEmail', () => {
    it('should send email when initialized', async () => {
      const options = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        attachments: [{ filename: 'test.txt', content: 'Test content' }]
      };

      const result = await emailService.sendEmail(options);

      expect(mockTransporterSendMail).toHaveBeenCalledWith({
        from: '"CareSync Test" <test@caresync.com>',
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text',
        cc: 'cc@example.com',
        bcc: 'bcc@example.com',
        attachments: [{ filename: 'test.txt', content: 'Test content' }]
      });

      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
        info: {
          messageId: 'test-message-id',
          response: 'test-response'
        }
      });
    });

    it('should queue email when not initialized', async () => {
      // Set service as not initialized
      emailService.initialized = false;
      emailService.emailQueue = [];

      const options = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text'
      };

      // Mock console.log to prevent output during test
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      const sendPromise = emailService.sendEmail(options);

      // Email should be queued
      expect(emailService.emailQueue).toHaveLength(1);
      expect(emailService.emailQueue[0].options).toEqual(options);

      // Resolving the queue
      emailService.initialized = true;
      await emailService._processQueue();
      
      // Get result of the promise
      const result = await sendPromise;
      
      expect(result).toEqual({
        success: true,
        messageId: 'test-message-id',
        info: {
          messageId: 'test-message-id',
          response: 'test-response'
        }
      });

      // Restore console.log
      console.log = originalConsoleLog;
    });

    it('should handle errors when sending email', async () => {
      // Mock the sendMail to reject
      mockTransporterSendMail.mockRejectedValueOnce(new Error('Send failure'));

      // Mock console.error to prevent output during test
      const originalConsoleError = console.error;
      console.error = jest.fn();

      const options = {
        to: 'recipient@example.com',
        subject: 'Test Subject',
        html: '<p>Test HTML</p>',
        text: 'Test Text'
      };

      await expect(emailService.sendEmail(options)).rejects.toThrow('Failed to send email: Send failure');
      expect(console.error).toHaveBeenCalledWith('Email sending failed:', expect.any(Error));

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('sendVerificationEmail', () => {
    it('should send verification email with the correct template', async () => {
      const email = 'user@example.com';
      const code = '123456';

      await emailService.sendVerificationEmail(email, code);

      expect(verificationTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        code: '123456'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Verify your CareSync Test email address',
        html: '<p>Verification HTML</p>',
        text: 'Verification Text'
      }));
    });
  });

  describe('sendPasswordResetEmail', () => {
    it('should send password reset email with the correct template', async () => {
      const email = 'user@example.com';
      const resetUrl = 'https://caresync.com/reset-password?token=abc123';

      await emailService.sendPasswordResetEmail(email, resetUrl);

      expect(passwordResetTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        resetUrl
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Reset your CareSync Test password',
        html: '<p>Password Reset HTML</p>',
        text: 'Password Reset Text'
      }));
    });
  });

  describe('sendMfaEmail', () => {
    it('should send MFA code email with the correct template', async () => {
      const email = 'user@example.com';
      const code = '654321';

      await emailService.sendMfaEmail(email, code);

      expect(mfaCodeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        code
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Your CareSync Test verification code',
        html: '<p>MFA Code HTML</p>',
        text: 'MFA Code Text'
      }));
    });
  });

  describe('sendAppointmentConfirmation', () => {
    it('should send appointment confirmation email with the correct template', async () => {
      const appointment = {
        _id: 'appt123',
        date: '2023-07-15',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        isVirtual: true
      };
      const patient = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };
      const doctor = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      await emailService.sendAppointmentConfirmation(appointment, patient, doctor);

      expect(appointmentConfirmationTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        appointment,
        patient,
        doctor,
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: patient.email,
        subject: 'Your appointment with Dr. Smith is confirmed',
        html: '<p>Appointment Confirmation HTML</p>',
        text: 'Appointment Confirmation Text'
      }));
    });
  });

  describe('sendClinicVerificationEmail', () => {
    it('should send verified clinic email with the correct template', async () => {
      const clinic = {
        name: 'Test Clinic',
        email: 'clinic@example.com'
      };
      const status = 'verified';

      await emailService.sendClinicVerificationEmail(clinic, status);

      expect(clinicVerificationTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        clinicName: clinic.name,
        status,
        notes: '',
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: clinic.email,
        subject: 'Your Clinic Has Been Verified',
        html: '<p>Clinic Verification HTML</p>',
        text: 'Clinic Verification Text'
      }));
    });

    it('should send rejected clinic email with notes', async () => {
      const clinic = {
        name: 'Test Clinic',
        email: 'clinic@example.com'
      };
      const status = 'rejected';
      const notes = 'Missing required documentation';

      await emailService.sendClinicVerificationEmail(clinic, status, notes);

      expect(clinicVerificationTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        clinicName: clinic.name,
        status,
        notes,
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: clinic.email,
        subject: 'Clinic Verification Update',
        html: '<p>Clinic Verification HTML</p>',
        text: 'Clinic Verification Text'
      }));
    });

    it('should send in-review clinic email', async () => {
      const clinic = {
        name: 'Test Clinic',
        email: 'clinic@example.com'
      };
      const status = 'in_review';

      await emailService.sendClinicVerificationEmail(clinic, status);

      expect(clinicVerificationTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        clinicName: clinic.name,
        status,
        notes: '',
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: clinic.email,
        subject: 'Clinic Verification In Progress',
        html: '<p>Clinic Verification HTML</p>',
        text: 'Clinic Verification Text'
      }));
    });
  });

  describe('sendWelcomeEmail', () => {
    it('should send welcome email to patient with correct role text', async () => {
      const email = 'patient@example.com';
      const firstName = 'John';
      const role = 'patient';

      await emailService.sendWelcomeEmail(email, firstName, role);

      expect(welcomeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        firstName,
        role,
        roleText: 'access your health records, schedule appointments, and communicate with healthcare providers',
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: email,
        subject: 'Welcome to CareSync Test!',
        html: '<p>Welcome HTML</p>',
        text: 'Welcome Text'
      }));
    });

    it('should send welcome email to doctor with correct role text', async () => {
      const email = 'doctor@example.com';
      const firstName = 'Jane';
      const role = 'doctor';

      await emailService.sendWelcomeEmail(email, firstName, role);

      expect(welcomeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        firstName,
        role,
        roleText: 'manage your schedule, conduct virtual consultations, and communicate with patients',
        frontendUrl: 'https://test.caresync.com'
      });
    });

    it('should send welcome email to staff with correct role text', async () => {
      const email = 'staff@example.com';
      const firstName = 'Alex';
      const role = 'staff';

      await emailService.sendWelcomeEmail(email, firstName, role);

      expect(welcomeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        firstName,
        role,
        roleText: 'assist with clinic operations, manage appointments, and support patients and doctors',
        frontendUrl: 'https://test.caresync.com'
      });
    });

    it('should send welcome email to clinic with correct role text', async () => {
      const email = 'clinic@example.com';
      const firstName = 'Health';
      const role = 'clinic';

      await emailService.sendWelcomeEmail(email, firstName, role);

      expect(welcomeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        firstName,
        role,
        roleText: 'manage your clinic, staff, and patients all in one place',
        frontendUrl: 'https://test.caresync.com'
      });
    });

    it('should handle unknown roles gracefully', async () => {
      const email = 'unknown@example.com';
      const firstName = 'Unknown';
      const role = 'unknown';

      await emailService.sendWelcomeEmail(email, firstName, role);

      expect(welcomeTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        firstName,
        role,
        roleText: '', // Should have empty role text
        frontendUrl: 'https://test.caresync.com'
      });
    });
  });

  describe('sendAppointmentReminder', () => {
    it('should send appointment reminder email with the correct template', async () => {
      const appointment = {
        _id: 'appt123',
        date: '2023-07-15',
        startTime: '10:00 AM',
        endTime: '11:00 AM',
        isVirtual: true
      };
      const patient = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com'
      };
      const doctor = {
        firstName: 'Jane',
        lastName: 'Smith'
      };

      await emailService.sendAppointmentReminder(appointment, patient, doctor);

      expect(appointmentReminderTemplate).toHaveBeenCalledWith({
        appName: 'CareSync Test',
        appointment,
        patient,
        doctor,
        frontendUrl: 'https://test.caresync.com'
      });

      expect(mockTransporterSendMail).toHaveBeenCalledWith(expect.objectContaining({
        to: patient.email,
        subject: 'Reminder: Your Appointment with Dr. Smith',
        html: '<p>Appointment Reminder HTML</p>',
        text: 'Appointment Reminder Text'
      }));
    });
  });

  describe('_processQueue', () => {
    it('should process all queued emails', async () => {
      emailService.emailQueue = [
        {
          options: { to: 'test1@example.com', subject: 'Test 1', html: '<p>Test 1</p>', text: 'Test 1' },
          resolve: jest.fn(),
          reject: jest.fn()
        },
        {
          options: { to: 'test2@example.com', subject: 'Test 2', html: '<p>Test 2</p>', text: 'Test 2' },
          resolve: jest.fn(),
          reject: jest.fn()
        }
      ];

      // Mock console.log to prevent output during test
      const originalConsoleLog = console.log;
      console.log = jest.fn();

      await emailService._processQueue();

      expect(emailService.emailQueue).toHaveLength(0);
      expect(mockTransporterSendMail).toHaveBeenCalledTimes(2);
      expect(emailService.emailQueue[0]?.resolve).not.toBeDefined(); // Should have been removed from queue
      expect(emailService.emailQueue[1]?.resolve).not.toBeDefined(); // Should have been removed from queue

      // Restore console.log
      console.log = originalConsoleLog;
    });

    it('should handle errors in queued emails', async () => {
      const mockResolve = jest.fn();
      const mockReject = jest.fn();

      emailService.emailQueue = [
        {
          options: { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' },
          resolve: mockResolve,
          reject: mockReject
        }
      ];

      // Mock transporter.sendMail to reject
      mockTransporterSendMail.mockRejectedValueOnce(new Error('Send failure'));

      // Mock console.log and console.error to prevent output during test
      const originalConsoleLog = console.log;
      const originalConsoleError = console.error;
      console.log = jest.fn();
      console.error = jest.fn();

      await emailService._processQueue();

      expect(emailService.emailQueue).toHaveLength(0);
      expect(mockReject).toHaveBeenCalledWith(expect.any(Error));
      expect(mockResolve).not.toHaveBeenCalled();

      // Restore console functions
      console.log = originalConsoleLog;
      console.error = originalConsoleError;
    });

    it('should do nothing when not initialized', async () => {
      emailService.initialized = false;
      emailService.emailQueue = [
        {
          options: { to: 'test@example.com', subject: 'Test', html: '<p>Test</p>', text: 'Test' },
          resolve: jest.fn(),
          reject: jest.fn()
        }
      ];

      await emailService._processQueue();

      expect(emailService.emailQueue).toHaveLength(1); // Should not be processed
      expect(mockTransporterSendMail).not.toHaveBeenCalled();
    });

    it('should do nothing when queue is empty', async () => {
      emailService.emailQueue = [];

      await emailService._processQueue();

      expect(mockTransporterSendMail).not.toHaveBeenCalled();
    });
  });
}); 