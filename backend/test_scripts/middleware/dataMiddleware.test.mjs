import dataMiddleware from '../../src/middleware/data/dataMiddleware.mjs';

describe('dataMiddleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Reset mocks
    req = {
      query: {},
      body: {}
    };
    
    res = {
      json: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnThis(),
      get: jest.fn(),
      set: jest.fn()
    };
    
    next = jest.fn();
  });
  
  describe('formatResponse', () => {
    it('should wrap response data with success flag', () => {
      const middleware = dataMiddleware.formatResponse;
      const originalJson = res.json;
      const testData = { message: 'test' };
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith({
        success: true,
        data: testData
      });
      expect(next).toHaveBeenCalled();
    });
    
    it('should not modify response if already contains success flag', () => {
      const middleware = dataMiddleware.formatResponse;
      const originalJson = res.json;
      const testData = { success: false, message: 'error' };
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith(testData);
    });
    
    it('should override send method for object data', () => {
      const middleware = dataMiddleware.formatResponse;
      const originalSend = res.send;
      const originalJson = res.json;
      const testData = { message: 'test' };
      
      middleware(req, res, next);
      
      res.send(testData);
      
      expect(originalSend).not.toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith({
        success: true,
        data: testData
      });
    });
    
    it('should not modify send for non-object data', () => {
      const middleware = dataMiddleware.formatResponse;
      const originalSend = res.send;
      const testData = 'string data';
      
      middleware(req, res, next);
      
      res.send(testData);
      
      expect(originalSend).toHaveBeenCalledWith(testData);
    });
  });
  
  describe('sanitizeResponse', () => {
    it('should remove sensitive fields from response data', () => {
      const middleware = dataMiddleware.sanitizeResponse(['password', 'secret']);
      const originalJson = res.json;
      const testData = {
        username: 'test',
        password: 'secret123',
        secret: 'sensitive',
        nested: {
          password: 'nested-secret',
          normal: 'value'
        }
      };
      
      // Mock _sanitizeObject
      const originalSanitizeObject = dataMiddleware._sanitizeObject;
      dataMiddleware._sanitizeObject = jest.fn().mockImplementation((data, fields) => {
        const result = { ...data };
        fields.forEach(field => {
          delete result[field];
          if (result.nested) delete result.nested[field];
        });
        return result;
      });
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(dataMiddleware._sanitizeObject).toHaveBeenCalledWith(testData, ['password', 'secret']);
      expect(originalJson).toHaveBeenCalledWith({
        username: 'test',
        nested: {
          normal: 'value'
        }
      });
      
      // Restore original method
      dataMiddleware._sanitizeObject = originalSanitizeObject;
    });
    
    it('should handle errors during sanitization', () => {
      const middleware = dataMiddleware.sanitizeResponse();
      const originalJson = res.json;
      const testData = { username: 'test' };
      
      // Mock _sanitizeObject to throw error
      const originalSanitizeObject = dataMiddleware._sanitizeObject;
      dataMiddleware._sanitizeObject = jest.fn().mockImplementation(() => {
        throw new Error('Test error');
      });
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(console.error).toHaveBeenCalled();
      expect(originalJson).toHaveBeenCalledWith(testData);
      
      // Restore original methods
      dataMiddleware._sanitizeObject = originalSanitizeObject;
      console.error = originalConsoleError;
    });
  });
  
  describe('transformRequest', () => {
    it('should transform request body using provided function', () => {
      const transformFn = jest.fn().mockImplementation(data => {
        return { ...data, transformed: true };
      });
      
      const middleware = dataMiddleware.transformRequest(transformFn);
      req.body = { original: true };
      
      middleware(req, res, next);
      
      expect(transformFn).toHaveBeenCalledWith({ original: true });
      expect(req.body).toEqual({ original: true, transformed: true });
      expect(next).toHaveBeenCalled();
    });
    
    it('should skip transformation if no body', () => {
      const transformFn = jest.fn();
      const middleware = dataMiddleware.transformRequest(transformFn);
      req.body = null;
      
      middleware(req, res, next);
      
      expect(transformFn).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('addPagination', () => {
    it('should add pagination metadata if total count header exists', () => {
      const middleware = dataMiddleware.addPagination('X-Total-Count');
      const originalJson = res.json;
      const testData = {
        data: [1, 2, 3]
      };
      
      res.get.mockReturnValue('50');
      req.query.page = '2';
      req.query.limit = '10';
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith({
        data: [1, 2, 3],
        pagination: {
          total: 50,
          totalPages: 5,
          currentPage: 2,
          perPage: 10
        }
      });
    });
    
    it('should not add pagination if no total count header', () => {
      const middleware = dataMiddleware.addPagination('X-Total-Count');
      const originalJson = res.json;
      const testData = {
        data: [1, 2, 3]
      };
      
      res.get.mockReturnValue(null);
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith(testData);
    });
    
    it('should use default values for page and limit', () => {
      const middleware = dataMiddleware.addPagination('X-Total-Count');
      const originalJson = res.json;
      const testData = {
        data: [1, 2, 3]
      };
      
      res.get.mockReturnValue('50');
      // No query parameters set
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith({
        data: [1, 2, 3],
        pagination: {
          total: 50,
          totalPages: 5,
          currentPage: 1,
          perPage: 10
        }
      });
    });
  });
  
  describe('filterFields', () => {
    it('should filter fields based on query parameter', () => {
      const middleware = dataMiddleware.filterFields('fields');
      const originalJson = res.json;
      const item1 = { id: 1, name: 'Test 1', secret: 'hidden' };
      const item2 = { id: 2, name: 'Test 2', secret: 'hidden' };
      const testData = {
        data: [item1, item2]
      };
      
      req.query.fields = 'id,name';
      
      // Mock _filterFields
      const originalFilterFields = dataMiddleware._filterFields;
      dataMiddleware._filterFields = jest.fn()
        .mockReturnValueOnce({ id: 1, name: 'Test 1' })
        .mockReturnValueOnce({ id: 2, name: 'Test 2' });
      
      middleware(req, res, next);
      
      res.json(testData);
      
      // Instead of expecting direct object equality, check for specific calls
      expect(dataMiddleware._filterFields).toHaveBeenCalledTimes(2);
      
      const firstCall = dataMiddleware._filterFields.mock.calls[0];
      expect(firstCall[0]).toBe(item1);
      expect(firstCall[1]).toEqual(['id', 'name']);
      
      const secondCall = dataMiddleware._filterFields.mock.calls[1];
      expect(secondCall[0]).toBe(item2);
      expect(secondCall[1]).toEqual(['id', 'name']);
      
      expect(originalJson).toHaveBeenCalledWith({
        data: [
          { id: 1, name: 'Test 1' },
          { id: 2, name: 'Test 2' }
        ]
      });
      
      // Restore original method
      dataMiddleware._filterFields = originalFilterFields;
    });
    
    it('should handle single object data', () => {
      const middleware = dataMiddleware.filterFields('fields');
      const originalJson = res.json;
      const originalData = { id: 1, name: 'Test', secret: 'hidden' };
      const testData = {
        data: originalData
      };
      
      req.query.fields = 'id,name';
      
      // Mock _filterFields
      const originalFilterFields = dataMiddleware._filterFields;
      dataMiddleware._filterFields = jest.fn()
        .mockReturnValueOnce({ id: 1, name: 'Test' });
      
      middleware(req, res, next);
      
      res.json(testData);
      
      // Using direct mock checks instead of equality check
      expect(dataMiddleware._filterFields).toHaveBeenCalledTimes(1);
      expect(dataMiddleware._filterFields.mock.calls[0][0]).toBe(originalData);
      expect(dataMiddleware._filterFields.mock.calls[0][1]).toEqual(['id', 'name']);
      
      expect(originalJson).toHaveBeenCalledWith({
        data: { id: 1, name: 'Test' }
      });
      
      // Restore original method
      dataMiddleware._filterFields = originalFilterFields;
    });
    
    it('should not filter if no fields parameter', () => {
      const middleware = dataMiddleware.filterFields('fields');
      const originalJson = res.json;
      const testData = {
        data: [
          { id: 1, name: 'Test 1', secret: 'hidden' }
        ]
      };
      
      // No fields parameter
      
      middleware(req, res, next);
      
      res.json(testData);
      
      expect(originalJson).toHaveBeenCalledWith(testData);
    });
  });
  
  describe('_sanitizeObject', () => {
    it('should handle null and primitive values', () => {
      const nullResult = dataMiddleware._sanitizeObject(null, []);
      expect(nullResult).toBeNull();

      const primitiveResult = dataMiddleware._sanitizeObject(123, []);
      expect(primitiveResult).toBe(123);

      const stringResult = dataMiddleware._sanitizeObject('test', []);
      expect(stringResult).toBe('test');
    });

    it('should handle Date objects', () => {
      const date = new Date('2023-01-01');
      const result = dataMiddleware._sanitizeObject(date, []);
      expect(result instanceof Date).toBeTruthy();
      expect(result.getTime()).toBe(date.getTime());
    });

    it('should handle arrays by sanitizing each item', () => {
      const array = [
        { id: 1, password: 'secret1', email: 'test1@example.com' },
        { id: 2, password: 'secret2', email: 'test2@example.com' }
      ];
      
      const result = dataMiddleware._sanitizeObject(array, ['password']);
      
      expect(Array.isArray(result)).toBeTruthy();
      expect(result).toEqual([
        { id: 1, email: 'test1@example.com' },
        { id: 2, email: 'test2@example.com' }
      ]);
    });

    it('should handle circular references', () => {
      const obj = { name: 'test' };
      obj.self = obj;
      
      const result = dataMiddleware._sanitizeObject(obj, []);
      
      expect(result.name).toBe('test');
      expect(result.self).toBe("[Circular Reference]");
    });

    it('should handle Mongoose documents with toJSON method', () => {
      const mockDocument = {
        constructor: { name: 'model' },
        toJSON: jest.fn().mockReturnValue({
          _id: '123',
          name: 'Test',
          password: 'secret'
        })
      };
      
      const result = dataMiddleware._sanitizeObject(mockDocument, ['password']);
      
      expect(mockDocument.toJSON).toHaveBeenCalled();
      expect(result).toEqual({ _id: '123', name: 'Test' });
    });

    it('should handle objects with custom toJSON methods', () => {
      const customObject = {
        constructor: { name: 'CustomClass' },
        toJSON: jest.fn().mockReturnValue({
          id: '123',
          data: 'sensitive',
          type: 'test'
        })
      };
      
      const result = dataMiddleware._sanitizeObject(customObject, ['data']);
      
      expect(customObject.toJSON).toHaveBeenCalled();
      expect(result).toEqual({ id: '123', type: 'test' });
    });

    it('should handle toJSON methods that return primitives', () => {
      const customObject = {
        constructor: { name: 'CustomClass' },
        toJSON: jest.fn().mockReturnValue('primitive result')
      };
      
      const result = dataMiddleware._sanitizeObject(customObject, []);
      
      expect(customObject.toJSON).toHaveBeenCalled();
      expect(result).toBe('primitive result');
    });

    it('should handle circular references after toJSON', () => {
      const circularObj = {};
      const customObject = {
        constructor: { name: 'CustomClass' },
        toJSON: jest.fn().mockImplementation(() => {
          circularObj.self = circularObj;
          return circularObj;
        })
      };
      
      const result = dataMiddleware._sanitizeObject(customObject, []);
      
      expect(customObject.toJSON).toHaveBeenCalled();
      expect(result.self).toBe("[Circular Reference after toJSON]");
    });
  });

  describe('_filterFields', () => {
    it('should return the original value if not an object', () => {
      expect(dataMiddleware._filterFields(null, ['id'])).toBeNull();
      expect(dataMiddleware._filterFields(123, ['id'])).toBe(123);
      expect(dataMiddleware._filterFields('test', ['id'])).toBe('test');
    });

    it('should return the original object if no fields specified', () => {
      const obj = { id: 1, name: 'Test' };
      expect(dataMiddleware._filterFields(obj, [])).toBe(obj);
    });

    it('should filter object to include only specified fields', () => {
      const obj = {
        id: 1,
        name: 'Test',
        email: 'test@example.com',
        address: '123 Main St'
      };
      
      const result = dataMiddleware._filterFields(obj, ['id', 'name']);
      
      expect(result).toEqual({
        id: 1,
        name: 'Test'
      });
    });

    it('should ignore fields that don\'t exist in the object', () => {
      const obj = { id: 1, name: 'Test' };
      
      const result = dataMiddleware._filterFields(obj, ['id', 'nonexistent']);
      
      expect(result).toEqual({ id: 1 });
    });
  });
}); 