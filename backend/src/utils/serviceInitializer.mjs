// src/utils/serviceInitializer.mjs

import serviceContainer from './serviceContainer.mjs';
import config from '../config/config.mjs';

// Import all services
import userService from '../services/userService.mjs';
import patientService from '../services/patientService.mjs';
import doctorService from '../services/doctorService.mjs';
import staffService from '../services/staffService.mjs';
import appointmentService from '../services/appointmentService.mjs';
import authService from '../services/authService.mjs';
import clinicAuthService from '../services/clinicAuthService.mjs';
import tokenBlacklistService from '../services/tokenBlacklistService.mjs';
import availabilityService from '../services/availabilityService.mjs';
import emailService from '../services/emailService.mjs';

/**
 * Initialize all application services
 */
export async function initializeServices() {
  console.log('Initializing services...');
  
  // Register services with dependencies
  
  // Basic services with no dependencies
  serviceContainer.register('tokenBlacklistService', tokenBlacklistService);
  
  // Email service requires async initialization
  serviceContainer.register('emailService', emailService, [], 
    async function() {
      // For email service, we need to ensure the transporter is ready
      if (process.env.NODE_ENV !== 'production' && !this.transporter) {
        await this.setupDevTransport();
      }
      console.log('Email service initialized');
    }
  );
  
  // Auth services depend on email
  serviceContainer.register('authService', authService, ['emailService']);
  serviceContainer.register('clinicAuthService', clinicAuthService, ['emailService']);
  
  // Core domain services
  serviceContainer.register('userService', userService);
  serviceContainer.register('patientService', patientService, ['userService']);
  serviceContainer.register('doctorService', doctorService, ['userService']);
  serviceContainer.register('staffService', staffService, ['userService']);
  
  // Services that depend on multiple other services
  serviceContainer.register('availabilityService', availabilityService, ['doctorService']);
  serviceContainer.register('appointmentService', appointmentService, 
    ['patientService', 'doctorService', 'emailService']);
  
  // Initialize all services
  await serviceContainer.initializeAll();
  console.log('All services initialized successfully');
  
  return serviceContainer;
}

/**
 * Get an initialized service
 * @param {string} name - Service name
 * @returns {Object} Service instance
 */
export function getService(name) {
  return serviceContainer.get(name);
}

export default {
  initializeServices,
  getService
};