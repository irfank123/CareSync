// src/utils/di/container.mjs

/**
 * Simple dependency injection container
 */
class Container {
    constructor() {
      this.services = new Map();
      this.factories = new Map();
      this.instances = new Map();
    }
  
    /**
     * Register a service with the container
     * @param {string} name - Name to register the service under
     * @param {Function|Object} service - Service constructor or instance
     * @param {Array<string>} dependencies - Names of dependencies
     * @param {boolean} singleton - Whether to treat as singleton
     */
    register(name, service, dependencies = [], singleton = true) {
      this.services.set(name, {
        service,
        dependencies,
        singleton
      });
      return this;
    }
  
    /**
     * Register a factory function
     * @param {string} name - Name to register the factory under
     * @param {Function} factory - Factory function that creates the service
     * @param {Array<string>} dependencies - Names of dependencies for the factory
     */
    factory(name, factory, dependencies = []) {
      this.factories.set(name, {
        factory,
        dependencies
      });
      return this;
    }
  
    /**
     * Get a service from the container
     * @param {string} name - Name of the service to get
     * @returns {Object} The service instance
     */
    get(name) {
      // If we already have an instance for a singleton, return it
      if (this.instances.has(name)) {
        return this.instances.get(name);
      }
  
      // Check if service exists
      if (!this.services.has(name) && !this.factories.has(name)) {
        throw new Error(`Service ${name} is not registered`);
      }
  
      // If it's a factory, use that to create the instance
      if (this.factories.has(name)) {
        return this._createFromFactory(name);
      }
  
      // Get the service definition
      const { service, dependencies, singleton } = this.services.get(name);
  
      // Resolve dependencies
      const resolvedDependencies = dependencies.map(dep => this.get(dep));
  
      // Create the instance
      let instance;
      
      // If service is a class (constructor function)
      if (typeof service === 'function' && 
          (service.prototype && service.prototype.constructor === service)) {
        // Create a new instance with dependencies
        instance = new service(...resolvedDependencies);
      } else {
        // It's already an instance or just an object
        instance = service;
      }
  
      // If it's a singleton, store the instance
      if (singleton) {
        this.instances.set(name, instance);
      }
  
      return instance;
    }
  
    /**
     * Create a service from a factory
     * @param {string} name - Factory name
     * @returns {Object} The created service
     * @private
     */
    _createFromFactory(name) {
      const { factory, dependencies } = this.factories.get(name);
      
      // Resolve factory dependencies
      const resolvedDependencies = dependencies.map(dep => this.get(dep));
      
      // Call the factory with dependencies
      const instance = factory(...resolvedDependencies);
      
      // Store instance for future reference
      this.instances.set(name, instance);
      
      return instance;
    }
  
    /**
     * Remove a service from the container
     * @param {string} name - Name of the service to remove
     */
    remove(name) {
      this.services.delete(name);
      this.factories.delete(name);
      this.instances.delete(name);
      return this;
    }
  
    /**
     * Check if a service is registered
     * @param {string} name - Service name
     * @returns {boolean} True if registered
     */
    has(name) {
      return this.services.has(name) || this.factories.has(name);
    }
  
    /**
     * Clear all services from the container
     */
    clear() {
      this.services.clear();
      this.factories.clear();
      this.instances.clear();
      return this;
    }
  }
  
  export default new Container();