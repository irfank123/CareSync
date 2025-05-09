// Import the actual ServiceContainer module, not a mock
// We will get a fresh instance for each test using jest.resetModules()

describe('ServiceContainer', () => {
  let serviceContainerInstance;

  beforeEach(async () => {
    jest.resetModules(); // Ensures a fresh instance of the singleton for each test
    const ServiceContainerModule = await import('@src/utils/serviceContainer.mjs');
    serviceContainerInstance = ServiceContainerModule.default;
  });

  describe('register and get', () => {
    test('should register a service without dependencies or initFn, and allow getting it', () => {
      const mockService = { id: 'serviceA' };
      serviceContainerInstance.register('serviceA', mockService);
      expect(serviceContainerInstance.get('serviceA')).toBe(mockService);
      expect(serviceContainerInstance.isInitialized('serviceA')).toBe(true);
    });

    test('get should throw if service is not registered', () => {
      expect(() => serviceContainerInstance.get('nonExistent')).toThrow(
        'Service nonExistent is not registered'
      );
    });

    test('get should throw if service is registered with initFn but not yet initialized', () => {
      const mockService = { id: 'serviceB' };
      const mockInitFn = jest.fn().mockResolvedValue(undefined);
      serviceContainerInstance.register('serviceB', mockService, [], mockInitFn);
      // At this point, it's registered but initialize() or initializeAll() hasn't been called for it.
      // The current register logic immediately sets up an initializationPromise.
      // The current get logic checks initializedServices, which is set to true only after initFn completes or if no initFn.
      // If an initFn exists, initializedServices.set(name, true) only happens *inside* the promise.
      // So, isInitialized will be false, and get() should throw.

      expect(serviceContainerInstance.isInitialized('serviceB')).toBe(false); // Because initFn is present and not yet run
      expect(() => serviceContainerInstance.get('serviceB')).toThrow(
        'Service serviceB is not initialized. Call initialize() first'
      );
    });

    test('should register a service with an initFn', async () => {
      const mockService = { id: 'serviceC', data: null };
      const mockInitFn = jest.fn(async function() { this.data = 'initialized'; });
      serviceContainerInstance.register('serviceC', mockService, [], mockInitFn);
      
      expect(serviceContainerInstance.isInitialized('serviceC')).toBe(false);
      await serviceContainerInstance.initialize('serviceC'); // Manually initialize for this test
      
      expect(mockInitFn).toHaveBeenCalledTimes(1);
      expect(mockService.data).toBe('initialized');
      expect(serviceContainerInstance.isInitialized('serviceC')).toBe(true);
      expect(serviceContainerInstance.get('serviceC')).toBe(mockService);
    });
  });

  describe('initialize', () => {
    test('should initialize a service with dependencies, ensuring deps are initialized first', async () => {
      const serviceA = { id: 'A', initialized: false };
      const initFnA = jest.fn(async function() { this.initialized = true; });
      serviceContainerInstance.register('serviceA', serviceA, [], initFnA);

      const serviceB = { id: 'B', initialized: false, serviceA: null };
      const initFnB = jest.fn(async function() { 
        this.serviceA = serviceContainerInstance.get('serviceA'); // Get dep during init
        this.initialized = true; 
      });
      serviceContainerInstance.register('serviceB', serviceB, ['serviceA'], initFnB);

      expect(serviceContainerInstance.isInitialized('serviceA')).toBe(false);
      expect(serviceContainerInstance.isInitialized('serviceB')).toBe(false);

      await serviceContainerInstance.initialize('serviceB');

      expect(initFnA).toHaveBeenCalledTimes(1); // Dep A should be initialized
      expect(serviceA.initialized).toBe(true);
      expect(serviceContainerInstance.isInitialized('serviceA')).toBe(true);

      expect(initFnB).toHaveBeenCalledTimes(1);
      expect(serviceB.initialized).toBe(true);
      expect(serviceB.serviceA).toBe(serviceA);
      expect(serviceContainerInstance.isInitialized('serviceB')).toBe(true);
    });

    test('initialize should throw if a dependency is not registered', async () => {
      const serviceC = { id: 'C' };
      const initFnC = jest.fn();
      serviceContainerInstance.register('serviceC', serviceC, ['nonExistentDep'], initFnC);
      
      await expect(serviceContainerInstance.initialize('serviceC')).rejects.toThrow(
        'Service serviceC depends on nonExistentDep, but nonExistentDep is not registered'
      );
    });

    test('initialize should throw if service has no initFn and was not auto-initialized (edge case, hard to hit with current register)', async () => {
        const serviceD = { id: 'D' };
        serviceContainerInstance.services.set('serviceD', serviceD); // Manually register without initFn
        serviceContainerInstance.dependencyGraph.set('serviceD', []);
        // Do NOT set it in initializationPromises or initializedServices
        
        await expect(serviceContainerInstance.initialize('serviceD')).rejects.toThrow(
            'Service serviceD is registered but has no initialization function'
        );
    });

    test('initialize should return the service if already initialized', async () => {
        const serviceE = { id: 'E' };
        serviceContainerInstance.register('serviceE', serviceE); // No initFn, so auto-initialized
        const result = await serviceContainerInstance.initialize('serviceE');
        expect(result).toBe(serviceE);
    });
  });

  describe('initializeAll', () => {
    test('should initialize all registered services in correct dependency order', async () => {
      const order = [];
      const serviceA = { id: 'A' };
      const initFnA = jest.fn(async () => { order.push('A'); });
      serviceContainerInstance.register('serviceA', serviceA, [], initFnA);

      const serviceB = { id: 'B' };
      const initFnB = jest.fn(async () => { order.push('B'); });
      serviceContainerInstance.register('serviceB', serviceB, ['serviceA'], initFnB);

      const serviceC = { id: 'C' };
      // No initFn for C, should be considered initialized upon registration
      serviceContainerInstance.register('serviceC', serviceC, []); 

      const serviceD = { id: 'D' };
      const initFnD = jest.fn(async () => { order.push('D'); });
      serviceContainerInstance.register('serviceD', serviceD, ['serviceB', 'serviceC'], initFnD);

      await serviceContainerInstance.initializeAll();

      expect(initFnA).toHaveBeenCalledTimes(1);
      expect(initFnB).toHaveBeenCalledTimes(1);
      expect(initFnD).toHaveBeenCalledTimes(1);
      expect(serviceContainerInstance.isInitialized('serviceA')).toBe(true);
      expect(serviceContainerInstance.isInitialized('serviceB')).toBe(true);
      expect(serviceContainerInstance.isInitialized('serviceC')).toBe(true);
      expect(serviceContainerInstance.isInitialized('serviceD')).toBe(true);
      
      // Check order: A before B, (A,C) before B, B before D
      expect(order).toEqual(['A', 'B', 'D']); // C has no initFn, so not in `order`
      expect(order.indexOf('A') < order.indexOf('B')).toBe(true);
      expect(order.indexOf('B') < order.indexOf('D')).toBe(true);
    });

    test('initializeAll should throw on circular dependencies', async () => {
      serviceContainerInstance.register('circA', {}, ['circB'], jest.fn());
      serviceContainerInstance.register('circB', {}, ['circA'], jest.fn());
      
      await expect(serviceContainerInstance.initializeAll()).rejects.toThrow(
        'Circular dependency detected or missing dependencies for: circA, circB' // Order might vary
      );
    });

    test('initializeAll should throw on missing dependency that is not registered', async () => {
      serviceContainerInstance.register('validWithMissingDep', {}, ['trulyNonExistent'], jest.fn());
      
      // Correction: initializeAll detects the stall first due to the missing dependency
      await expect(serviceContainerInstance.initializeAll()).rejects.toThrow(
        'Circular dependency detected or missing dependencies for: validWithMissingDep'
      );
    });
  });

  describe('isInitialized', () => {
    test('should return true for auto-initialized service (no initFn)', () => {
        serviceContainerInstance.register('autoInitSvc', {});
        expect(serviceContainerInstance.isInitialized('autoInitSvc')).toBe(true);
    });

    test('should return false for service with initFn before initialization', () => {
        serviceContainerInstance.register('needsInitSvc', {}, [], jest.fn());
        expect(serviceContainerInstance.isInitialized('needsInitSvc')).toBe(false);
    });

    test('should return true for service with initFn after successful initialization', async () => {
        const initFn = jest.fn().mockResolvedValue(undefined);
        serviceContainerInstance.register('initLaterSvc', {}, [], initFn);
        await serviceContainerInstance.initialize('initLaterSvc');
        expect(serviceContainerInstance.isInitialized('initLaterSvc')).toBe(true);
    });

    test('should return false for a non-registered service', () => {
        expect(serviceContainerInstance.isInitialized('notThere')).toBe(false);
    });
  });
}); 