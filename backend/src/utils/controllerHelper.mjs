// src/utils/controllerHelper.mjs

import { AppServiceProvider } from './di/serviceProviders.mjs';

/**
 * Helper to create controller methods with DI
 * @param {Function} controllerFn - Controller method function
 * @param {Array<string>} serviceNames - Names of services to inject
 * @returns {Function} Express middleware function
 */
export const withServices = (controllerFn, serviceNames = []) => {
  return async (req, res, next) => {
    try {
      // Get services
      const services = {};
      
      for (const name of serviceNames) {
        try {
          services[name] = req.container 
            ? req.container.getService(name) 
            : AppServiceProvider.getService(name);
        } catch (serviceError) {
          console.error(`Error getting service ${name}:`, serviceError);
          // Continue with other services, this service will be undefined
        }
      }
      
      // Call controller with services and standard args
      await controllerFn(req, res, next, services);
    } catch (error) {
      console.error('Controller error:', error);
      next(error);
    }
  };
};

/**
 * Decorate a controller object with DI for all methods
 * @param {Object} controller - Controller object with methods
 * @param {Object} serviceMappings - Map of method names to service dependencies
 * @returns {Object} Decorated controller
 */
export const withServicesForController = (controller, serviceMappings = {}) => {
  const decoratedController = {};
  
  // Process each method in the controller
  for (const [methodName, method] of Object.entries(controller)) {
    // Skip if not a function
    if (typeof method !== 'function') {
      decoratedController[methodName] = method;
      continue;
    }
    
    // Get service dependencies for this method
    const serviceNames = serviceMappings[methodName] || [];
    
    // Decorate the method
    decoratedController[methodName] = withServices(method, serviceNames);
  }
  
  return decoratedController;
};