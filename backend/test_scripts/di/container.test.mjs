import container from '@src/utils/di/container.mjs';

describe('Container', () => {
  beforeEach(() => {
    // Reset container before each test
    container.clear();
  });

  describe('register', () => {
    test('should register a service with no dependencies', () => {
      const service = class TestService {};
      container.register('testService', service);
      
      expect(container.has('testService')).toBe(true);
    });

    test('should register a service with dependencies', () => {
      const dependency = class Dependency {};
      const service = class TestService {
        constructor(dep) {
          this.dep = dep;
        }
      };
      
      container.register('dependency', dependency);
      container.register('testService', service, ['dependency']);
      
      expect(container.has('testService')).toBe(true);
      expect(container.has('dependency')).toBe(true);
    });

    test('should return container instance for method chaining', () => {
      const result = container.register('test', {});
      expect(result).toBe(container);
    });
  });

  describe('factory', () => {
    test('should register a factory function', () => {
      const factory = () => ({ name: 'factoryService' });
      container.factory('factoryService', factory);
      
      expect(container.has('factoryService')).toBe(true);
    });

    test('should register a factory with dependencies', () => {
      const dependency = { value: 'dep' };
      container.register('dependency', dependency);
      
      const factory = (dep) => ({ dep, name: 'factoryService' });
      container.factory('factoryService', factory, ['dependency']);
      
      expect(container.has('factoryService')).toBe(true);
    });

    test('should return container instance for method chaining', () => {
      const result = container.factory('test', () => ({}));
      expect(result).toBe(container);
    });
  });

  describe('get', () => {
    test('should get a registered service', () => {
      const service = class TestService {};
      container.register('testService', service);
      
      const instance = container.get('testService');
      expect(instance).toBeInstanceOf(service);
    });

    test('should get a registered service instance', () => {
      const serviceInstance = { name: 'test' };
      container.register('testService', serviceInstance);
      
      const instance = container.get('testService');
      expect(instance).toBe(serviceInstance);
    });

    test('should create new instances for non-singleton services', () => {
      const service = class TestService {};
      container.register('testService', service, [], false);
      
      const instance1 = container.get('testService');
      const instance2 = container.get('testService');
      
      expect(instance1).toBeInstanceOf(service);
      expect(instance2).toBeInstanceOf(service);
      expect(instance1).not.toBe(instance2);
    });

    test('should reuse instances for singleton services', () => {
      const service = class TestService {};
      container.register('testService', service, [], true);
      
      const instance1 = container.get('testService');
      const instance2 = container.get('testService');
      
      expect(instance1).toBe(instance2);
    });

    test('should inject dependencies when creating a service instance', () => {
      const dependency = { value: 'dep' };
      const service = class TestService {
        constructor(dep) {
          this.dep = dep;
        }
      };
      
      container.register('dependency', dependency);
      container.register('testService', service, ['dependency']);
      
      const instance = container.get('testService');
      expect(instance.dep).toBe(dependency);
    });

    test('should create service from factory', () => {
      const factory = () => ({ name: 'factoryService' });
      container.factory('factoryService', factory);
      
      const instance = container.get('factoryService');
      expect(instance.name).toBe('factoryService');
    });

    test('should inject dependencies into factory', () => {
      const dependency = { value: 'dep' };
      container.register('dependency', dependency);
      
      const factory = (dep) => ({ dep, name: 'factoryService' });
      container.factory('factoryService', factory, ['dependency']);
      
      const instance = container.get('factoryService');
      expect(instance.dep).toBe(dependency);
      expect(instance.name).toBe('factoryService');
    });

    test('should reuse factory created instances', () => {
      const factory = () => ({ name: 'factoryService' });
      container.factory('factoryService', factory);
      
      const instance1 = container.get('factoryService');
      const instance2 = container.get('factoryService');
      
      expect(instance1).toBe(instance2);
    });

    test('should throw error when service is not registered', () => {
      expect(() => {
        container.get('nonExistentService');
      }).toThrow('Service nonExistentService is not registered');
    });
  });

  describe('remove', () => {
    test('should remove registered service', () => {
      container.register('testService', {});
      expect(container.has('testService')).toBe(true);
      
      container.remove('testService');
      expect(container.has('testService')).toBe(false);
    });

    test('should remove registered factory', () => {
      container.factory('factoryService', () => ({}));
      expect(container.has('factoryService')).toBe(true);
      
      container.remove('factoryService');
      expect(container.has('factoryService')).toBe(false);
    });

    test('should remove cached instance', () => {
      const service = class TestService {};
      container.register('testService', service);
      
      // Get service to create instance
      container.get('testService');
      
      // Remove service
      container.remove('testService');
      
      // Register again
      container.register('testService', service);
      
      // Service should be recreated
      const newInstance = container.get('testService');
      expect(newInstance).toBeInstanceOf(service);
    });

    test('should return container instance for method chaining', () => {
      container.register('testService', {});
      const result = container.remove('testService');
      expect(result).toBe(container);
    });
  });

  describe('has', () => {
    test('should return true when service is registered', () => {
      container.register('testService', {});
      expect(container.has('testService')).toBe(true);
    });

    test('should return true when factory is registered', () => {
      container.factory('factoryService', () => ({}));
      expect(container.has('factoryService')).toBe(true);
    });

    test('should return false when service is not registered', () => {
      expect(container.has('nonExistentService')).toBe(false);
    });
  });

  describe('clear', () => {
    test('should clear all registered services', () => {
      container.register('service1', {});
      container.register('service2', {});
      container.factory('factory1', () => ({}));
      
      // Get one service to create an instance
      container.get('service1');
      
      container.clear();
      
      expect(container.has('service1')).toBe(false);
      expect(container.has('service2')).toBe(false);
      expect(container.has('factory1')).toBe(false);
    });

    test('should return container instance for method chaining', () => {
      const result = container.clear();
      expect(result).toBe(container);
    });
  });
}); 