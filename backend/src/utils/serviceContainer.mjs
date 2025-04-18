// src/utils/serviceContainer.mjs

/**
 * A simple service container that manages initialization and dependencies
 */
class ServiceContainer {
    constructor() {
      this.services = new Map();
      this.initializedServices = new Map();
      this.initializationPromises = new Map();
      this.dependencyGraph = new Map();
    }
  
    /**
     * Register a service with the container
     * @param {string} name - Service name
     * @param {Object} instance - Service instance
     * @param {Array<string>} dependencies - Names of services this one depends on
     * @param {Function} initFn - Async initialization function (optional)
     */
    register(name, instance, dependencies = [], initFn = null) {
      this.services.set(name, instance);
      this.dependencyGraph.set(name, dependencies);
      
      if (initFn && typeof initFn === 'function') {
        this.initializationPromises.set(name, async () => {
          // Wait for all dependencies to initialize first
          for (const dep of dependencies) {
            if (!this.initializedServices.has(dep)) {
              if (!this.services.has(dep)) {
                throw new Error(`Service ${name} depends on ${dep}, but ${dep} is not registered`);
              }
              await this.initialize(dep);
            }
          }
          
          // Now initialize this service
          await initFn.call(instance);
          this.initializedServices.set(name, true);
          return instance;
        });
      } else {
        // If no init function, mark as already initialized
        this.initializedServices.set(name, true);
      }
      
      return instance;
    }
  
    /**
     * Initialize a specific service
     * @param {string} name - Service name
     * @returns {Promise<Object>} - Initialized service instance
     */
    async initialize(name) {
      if (this.initializedServices.has(name)) {
        return this.services.get(name);
      }
      
      if (!this.initializationPromises.has(name)) {
        throw new Error(`Service ${name} is registered but has no initialization function`);
      }
      
      await this.initializationPromises.get(name)();
      return this.services.get(name);
    }
  
    /**
     * Initialize all registered services in dependency order
     * @returns {Promise<void>}
     */
    async initializeAll() {
      // Find services with no dependencies to start
      const initialized = new Set();
      const toInitialize = new Set([...this.services.keys()]);
      
      while (toInitialize.size > 0) {
        let initializedSomething = false;
        
        for (const serviceName of toInitialize) {
          const dependencies = this.dependencyGraph.get(serviceName) || [];
          
          // Check if all dependencies are initialized
          const allDepsInitialized = dependencies.every(dep => initialized.has(dep));
          
          if (allDepsInitialized) {
            // Initialize this service
            await this.initialize(serviceName);
            initialized.add(serviceName);
            toInitialize.delete(serviceName);
            initializedSomething = true;
          }
        }
        
        if (!initializedSomething && toInitialize.size > 0) {
          const remaining = [...toInitialize].join(', ');
          throw new Error(`Circular dependency detected or missing dependencies for: ${remaining}`);
        }
      }
    }
  
    /**
     * Get a service by name
     * @param {string} name - Service name
     * @returns {Object} Service instance
     */
    get(name) {
      if (!this.services.has(name)) {
        throw new Error(`Service ${name} is not registered`);
      }
      
      if (!this.initializedServices.has(name)) {
        throw new Error(`Service ${name} is not initialized. Call initialize() first`);
      }
      
      return this.services.get(name);
    }
  
    /**
     * Check if a service is initialized
     * @param {string} name - Service name
     * @returns {boolean} Is initialized
     */
    isInitialized(name) {
      return this.initializedServices.has(name);
    }
  }
  
  export default new ServiceContainer();