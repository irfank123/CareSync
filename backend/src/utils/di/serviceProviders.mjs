// src/utils/di/serviceProviders.mjs

import container from './container.mjs';
import nodemailer from 'nodemailer';
import config from '../../config/config.mjs';

// Import services
import userService from '../../services/userService.mjs';
import patientService from '../../services/patientService.mjs';
import doctorService from '../../services/doctorService.mjs';
import staffService from '../../services/staffService.mjs';
import appointmentService from '../../services/appointmentService.mjs';
import authService from '../../services/authService.mjs';
import clinicAuthService from '../../services/clinicAuthService.mjs';
import tokenBlacklistService from '../../services/tokenBlacklistService.mjs';
import availabilityService from '../../services/availabilityService.mjs';
import emailService from '../../services/emailService.mjs';

/**
 * Core service provider with required services
 */
class CoreServiceProvider {
  /**
   * Register core services with the container
   * @returns {Object} The container
   */
  register() {
    // Register transporter factory
    container.factory('emailTransporter', () => {
      if (process.env.NODE_ENV === 'production') {
        // In production, use configured email provider
        return nodemailer.createTransport({
          host: config.email.host,
          port: config.email.port,
          secure: config.email.port === 465, // true for 465, false for other ports
          auth: {
            user: config.email.auth.user,
            pass: config.email.auth.pass
          }
        });
      } else {
        // For development, create a mock transporter
        return {
          sendMail: (options) => {
            console.log('Development mode - Email would be sent:', options);
            return Promise.resolve({ messageId: 'dev-mode-no-email-sent' });
          },
          // Flag to indicate it's a mock
          isMock: true
        };
      }
    });
    
    // Email service factory with async initialization
    container.factory('emailService', async (transporter) => {
      // Set up the real transporter if we're using a mock
      if (transporter.isMock && process.env.NODE_ENV !== 'production') {
        try {
          const testAccount = await nodemailer.createTestAccount();
          transporter = nodemailer.createTransport({
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
          // Keep using the mock transporter
        }
      }
      
      // Update the emailService with the transporter
      emailService.transporter = transporter;
      emailService.initialized = true;
      
      // Process any queued emails
      if (emailService._processQueue) {
        await emailService._processQueue();
      }
      
      return emailService;
    }, ['emailTransporter']);
    
    // Register basic services
    container.register('tokenBlacklistService', tokenBlacklistService);
    
    // Auth services with dependencies
    container.register('authService', authService, ['emailService']);
    container.register('clinicAuthService', clinicAuthService, ['emailService']);
    
    // Core domain services
    container.register('userService', userService);
    container.register('patientService', patientService, ['userService']);
    container.register('doctorService', doctorService, ['userService']);
    container.register('staffService', staffService, ['userService']);
    
    // Services that depend on multiple other services
    container.register('availabilityService', availabilityService, ['doctorService']);
    container.register('appointmentService', appointmentService, 
      ['patientService', 'doctorService', 'emailService']);
      
    return container;
  }
}

/**
 * Auth service provider for authentication services
 */
class AuthServiceProvider {
  /**
   * Register auth services with the container
   * @returns {Object} The container
   */
  register() {
    // Only register these if they haven't been registered already
    if (!container.has('authService')) {
      container.register('authService', authService, ['emailService']);
    }
    
    if (!container.has('clinicAuthService')) {
      container.register('clinicAuthService', clinicAuthService, ['emailService']);
    }
    
    if (!container.has('tokenBlacklistService')) {
      container.register('tokenBlacklistService', tokenBlacklistService);
    }
    
    return container;
  }
}

/**
 * User management service provider
 */
class UserServiceProvider {
  /**
   * Register user-related services with the container
   * @returns {Object} The container
   */
  register() {
    // Only register these if they haven't been registered already
    if (!container.has('userService')) {
      container.register('userService', userService);
    }
    
    if (!container.has('patientService')) {
      container.register('patientService', patientService, ['userService']);
    }
    
    if (!container.has('doctorService')) {
      container.register('doctorService', doctorService, ['userService']);
    }
    
    if (!container.has('staffService')) {
      container.register('staffService', staffService, ['userService']);
    }
    
    return container;
  }
}

/**
 * Appointment management service provider
 */
class AppointmentServiceProvider {
  /**
   * Register appointment-related services with the container
   * @returns {Object} The container
   */
  register() {
    // Make sure dependencies are registered
    if (!container.has('patientService')) {
      container.register('patientService', patientService, ['userService']);
    }
    
    if (!container.has('doctorService')) {
      container.register('doctorService', doctorService, ['userService']);
    }
    
    if (!container.has('emailService')) {
      // If not registered, register email service with its dependencies
      if (!container.has('emailTransporter')) {
        // Register the email transporter factory
        container.factory('emailTransporter', () => {
          if (process.env.NODE_ENV === 'production') {
            // In production, use configured email provider
            return nodemailer.createTransport({
              host: config.email.host,
              port: config.email.port,
              secure: config.email.port === 465,
              auth: {
                user: config.email.auth.user,
                pass: config.email.auth.pass
              }
            });
          } else {
            return { 
              sendMail: options => Promise.resolve({ messageId: 'mock-email' }),
              isMock: true
            };
          }
        });
      }
      
      // Register email service with transporter dependency
      container.factory('emailService', async (transporter) => {
        emailService.transporter = transporter;
        emailService.initialized = true;
        return emailService;
      }, ['emailTransporter']);
    }
    
    // Register availability service if not already registered
    if (!container.has('availabilityService')) {
      container.register('availabilityService', availabilityService, ['doctorService']);
    }
    
    // Register appointment service with its dependencies
    container.register('appointmentService', appointmentService, 
      ['patientService', 'doctorService', 'emailService', 'availabilityService']);
    
    return container;
  }
}

/**
 * Application service provider for registering all services
 */
class AppServiceProvider {
  /**
   * Register all services with the container
   * @returns {Object} The container
   */
  static registerAll() {
    // Register all services
    new CoreServiceProvider().register();
    new AuthServiceProvider().register();
    new UserServiceProvider().register();
    new AppointmentServiceProvider().register();
    
    return container;
  }
  
  /**
   * Initialize async services
   * @returns {Promise<void>}
   */
  static async initializeAsync() {
    // Make sure all services are registered
    AppServiceProvider.registerAll();
    
    // Get and initialize email service which has async initialization
    await container.get('emailService');
    
    console.log('All services initialized successfully');
    
    return container;
  }
  
  /**
   * Get a service from the container
   * @param {string} name - Service name
   * @returns {Object} Service instance
   */
  static getService(name) {
    return container.get(name);
  }
}

export {
  CoreServiceProvider,
  AuthServiceProvider,
  UserServiceProvider,
  AppointmentServiceProvider,
  AppServiceProvider
};

export default AppServiceProvider;