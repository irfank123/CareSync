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
import createAuthService from '../../services/authService.mjs';
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
    
    // Register basic services first (no dependencies)
    container.register('tokenBlacklistService', tokenBlacklistService);
    
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
    
    // Register core domain services
    container.register('userService', userService);
    container.register('patientService', patientService);
    container.register('doctorService', doctorService); 
    container.register('staffService', staffService);
    
    // Auth services with dependencies
    // Create auth service through factory function to avoid circular dependencies
    container.factory('authService', (emailService) => {
      return createAuthService(emailService);
    }, ['emailService']);
    
    // Pass emailService to clinicAuthService - should update implementation to match authService pattern
    container.register('clinicAuthService', clinicAuthService);
    
    // Services that depend on multiple other services
    container.register('availabilityService', availabilityService);
    
    // Register appointment service last since it has many dependencies
    container.register('appointmentService', appointmentService);
      
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
    // Register all services through core provider
    new CoreServiceProvider().register();
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

export { AppServiceProvider };

export default AppServiceProvider;