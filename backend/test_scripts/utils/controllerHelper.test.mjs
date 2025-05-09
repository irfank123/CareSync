import { withServices, withServicesForController } from '@src/utils/controllerHelper.mjs';
import { AppServiceProvider } from '@src/utils/di/serviceProviders.mjs';

// Mock AppServiceProvider
jest.mock('@src/utils/di/serviceProviders.mjs', () => ({
  AppServiceProvider: {
    getService: jest.fn(),
  },
}));

describe('Controller Helper Utilities', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockControllerFn;
  let mockService1;
  let mockService2;

  beforeEach(() => {
    // Reset mocks for req, res, next
    mockReq = {
      container: {
        getService: jest.fn(),
      },
      // other req properties as needed
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      // other res properties as needed
    };
    mockNext = jest.fn();
    mockControllerFn = jest.fn().mockResolvedValue(undefined); // Default to resolving

    // Mock services that might be injected
    mockService1 = { doSomething: jest.fn() };
    mockService2 = { doSomethingElse: jest.fn() };

    // Reset AppServiceProvider mock
    AppServiceProvider.getService.mockReset();
  });

  describe('withServices', () => {
    test('should call controllerFn with req, res, next, and resolved services from req.container', async () => {
      mockReq.container.getService.mockImplementation(serviceName => {
        if (serviceName === 'service1') return mockService1;
        if (serviceName === 'service2') return mockService2;
        return undefined;
      });

      const servicesToInject = ['service1', 'service2'];
      const wrappedFn = withServices(mockControllerFn, servicesToInject);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockControllerFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {
        service1: mockService1,
        service2: mockService2,
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call controllerFn with services resolved from AppServiceProvider if req.container is not present', async () => {
      delete mockReq.container; // Remove req.container to test fallback
      AppServiceProvider.getService.mockImplementation(serviceName => {
        if (serviceName === 'service1') return mockService1;
        return undefined;
      });

      const wrappedFn = withServices(mockControllerFn, ['service1']);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockControllerFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {
        service1: mockService1,
      });
      expect(AppServiceProvider.getService).toHaveBeenCalledWith('service1');
      expect(mockNext).not.toHaveBeenCalled();
    });

    test('should call next with error if controllerFn throws an error', async () => {
      const testError = new Error('Controller function error');
      mockControllerFn.mockRejectedValue(testError);

      const wrappedFn = withServices(mockControllerFn, []);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalledWith(testError);
    });

    test('should pass undefined for a service if it cannot be resolved and log an error', async () => {
      global.console.error = jest.fn(); // Mock console.error
      mockReq.container.getService.mockImplementation(serviceName => {
        if (serviceName === 'service1') return mockService1;
        if (serviceName === 'nonExistentService') throw new Error('Service not found');
        return undefined;
      });

      const wrappedFn = withServices(mockControllerFn, ['service1', 'nonExistentService']);
      await wrappedFn(mockReq, mockRes, mockNext);

      expect(mockControllerFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {
        service1: mockService1,
        nonExistentService: undefined, // Expect undefined for the service that failed to resolve
      });
      expect(console.error).toHaveBeenCalledWith('Error getting service nonExistentService:', expect.any(Error));
      expect(mockNext).not.toHaveBeenCalled();
      global.console.error.mockRestore(); // Restore console.error
    });

    test('should handle empty serviceNames array', async () => {
      const wrappedFn = withServices(mockControllerFn, []);
      await wrappedFn(mockReq, mockRes, mockNext);
      expect(mockControllerFn).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {});
      expect(mockNext).not.toHaveBeenCalled();
    });
  });

  describe('withServicesForController', () => {
    let mockOriginalController;

    beforeEach(() => {
      mockOriginalController = {
        methodA: jest.fn().mockResolvedValue(undefined),
        methodB: jest.fn().mockResolvedValue(undefined),
        nonFunctionProp: 'someValue',
      };
    });

    test('should decorate all function methods of a controller', async () => {
      const serviceMappings = {
        methodA: ['service1'],
        methodB: ['service2'],
      };

      mockReq.container.getService.mockImplementation(serviceName => {
        if (serviceName === 'service1') return mockService1;
        if (serviceName === 'service2') return mockService2;
        return undefined;
      });

      const decoratedController = withServicesForController(mockOriginalController, serviceMappings);

      expect(typeof decoratedController.methodA).toBe('function');
      expect(typeof decoratedController.methodB).toBe('function');
      expect(decoratedController.nonFunctionProp).toBe('someValue');

      // Test decorated methodA
      await decoratedController.methodA(mockReq, mockRes, mockNext);
      expect(mockOriginalController.methodA).toHaveBeenCalledWith(mockReq, mockRes, mockNext, { service1: mockService1 });

      // Test decorated methodB
      await decoratedController.methodB(mockReq, mockRes, mockNext);
      expect(mockOriginalController.methodB).toHaveBeenCalledWith(mockReq, mockRes, mockNext, { service2: mockService2 });
    });

    test('should handle methods with no service mappings (empty array)', async () => {
      const serviceMappings = {
        methodA: [], // No services for methodA
      };
      const decoratedController = withServicesForController(mockOriginalController, serviceMappings);
      await decoratedController.methodA(mockReq, mockRes, mockNext);
      expect(mockOriginalController.methodA).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {});
    });

    test('should handle controller with no service mappings provided at all', async () => {
      const decoratedController = withServicesForController(mockOriginalController, {}); // Empty serviceMappings
      await decoratedController.methodA(mockReq, mockRes, mockNext);
      // methodA from originalController should be called via withServices, which will pass {} for services
      expect(mockOriginalController.methodA).toHaveBeenCalledWith(mockReq, mockRes, mockNext, {}); 
    });

    test('should preserve non-function properties', () => {
      const decoratedController = withServicesForController(mockOriginalController, {});
      expect(decoratedController.nonFunctionProp).toBe('someValue');
    });
  });
}); 