import { AppError } from '../../../src/utils/errorHandler.mjs';
import BaseController from '../../../src/controllers/base/baseController.mjs';

// Mock errorMiddleware
jest.mock('../../../src/middleware/index.mjs', () => ({
  errorMiddleware: {
    catchAsync: jest.fn(fn => fn)
  }
}));

describe('BaseController', () => {
  let mockService;
  let controller;
  let req;
  let res;
  let next;

  beforeEach(() => {
    // Mock service
    mockService = {
      getAll: jest.fn(),
      getById: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      getByUserId: jest.fn(),
      updateByUserId: jest.fn(),
      supportsClinic: true
    };
    
    // Initialize controller
    controller = new BaseController(mockService, 'TestResource');
    
    // Mock Express objects
    req = {
      params: { id: 'test-id' },
      query: {},
      body: { name: 'Test Resource' },
      user: { _id: 'user-id' },
      clinicId: 'clinic-id'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Setup default mock responses
    mockService.getAll.mockResolvedValue({
      data: [{ id: '1', name: 'Test 1' }, { id: '2', name: 'Test 2' }],
      total: 2,
      totalPages: 1,
      currentPage: 1
    });
    
    mockService.getById.mockResolvedValue({ id: 'test-id', name: 'Test Resource' });
    mockService.create.mockResolvedValue({ id: 'new-id', name: 'Test Resource' });
    mockService.update.mockResolvedValue({ id: 'test-id', name: 'Updated Resource' });
    mockService.delete.mockResolvedValue(true);
    mockService.getByUserId.mockResolvedValue({ id: 'user-resource', userId: 'user-id' });
    mockService.updateByUserId.mockResolvedValue({ id: 'user-resource', userId: 'user-id', name: 'Updated' });
  });

  describe('constructor', () => {
    test('should set service and resourceName properties', () => {
      expect(controller.service).toBe(mockService);
      expect(controller.resourceName).toBe('TestResource');
    });
    
    test('should bind CRUD methods', () => {
      // All these methods should be functions
      expect(typeof controller.getAll).toBe('function');
      expect(typeof controller.getOne).toBe('function');
      expect(typeof controller.create).toBe('function');
      expect(typeof controller.update).toBe('function');
      expect(typeof controller.delete).toBe('function');
    });
  });

  describe('getAll', () => {
    test('should get all resources with default pagination and filtering', async () => {
      // Act
      await controller.getAll(req, res, next);
      
      // Assert
      expect(mockService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 10,
        sort: 'createdAt',
        order: 'desc'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        total: 2,
        totalPages: 1,
        currentPage: 1,
        data: expect.any(Array)
      });
    });
    
    test('should get all resources with custom pagination and filtering', async () => {
      // Arrange
      req.query = {
        page: '2',
        limit: '5',
        search: 'test',
        sort: 'name',
        order: 'asc',
        status: 'active'
      };
      
      // Act
      await controller.getAll(req, res, next);
      
      // Assert
      expect(mockService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        limit: 5,
        search: 'test',
        sort: 'name',
        order: 'asc',
        status: 'active'
      }));
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.getAll.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      await expect(controller.getAll(req, res, next)).rejects.toThrow('Service error');
    });
  });

  describe('getOne', () => {
    test('should get a single resource by ID', async () => {
      // Act
      await controller.getOne(req, res, next);
      
      // Assert
      expect(mockService.getById).toHaveBeenCalledWith('test-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-id',
          name: 'Test Resource'
        })
      });
    });
    
    test('should return 404 when resource not found', async () => {
      // Arrange
      mockService.getById.mockResolvedValue(null);
      
      // Act
      await controller.getOne(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('TestResource not found');
      expect(error.statusCode).toBe(404);
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.getById.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      await expect(controller.getOne(req, res, next)).rejects.toThrow('Service error');
    });
  });

  describe('create', () => {
    test('should create a new resource', async () => {
      // Act
      await controller.create(req, res, next);
      
      // Assert
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Resource',
          clinicId: 'clinic-id'
        }),
        'user-id'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'new-id',
          name: 'Test Resource'
        })
      });
    });
    
    test('should not add clinicId if service does not support clinic', async () => {
      // Arrange
      mockService.supportsClinic = false;
      
      // Act
      await controller.create(req, res, next);
      
      // Assert
      expect(mockService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Test Resource'
        }),
        'user-id'
      );
      expect(mockService.create).not.toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: 'clinic-id'
        }),
        'user-id'
      );
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.create.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      await expect(controller.create(req, res, next)).rejects.toThrow('Service error');
    });
  });

  describe('update', () => {
    test('should update a resource', async () => {
      // Act
      await controller.update(req, res, next);
      
      // Assert
      expect(mockService.update).toHaveBeenCalledWith(
        'test-id',
        expect.objectContaining({
          name: 'Test Resource'
        }),
        'user-id'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'test-id',
          name: 'Updated Resource'
        })
      });
    });
    
    test('should return 404 when resource not found', async () => {
      // Arrange
      mockService.update.mockResolvedValue(null);
      
      // Act
      await controller.update(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('TestResource not found');
      expect(error.statusCode).toBe(404);
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.update.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      await expect(controller.update(req, res, next)).rejects.toThrow('Service error');
    });
  });

  describe('delete', () => {
    test('should delete a resource', async () => {
      // Act
      await controller.delete(req, res, next);
      
      // Assert
      expect(mockService.delete).toHaveBeenCalledWith(
        'test-id',
        'user-id'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'TestResource deleted successfully'
      });
    });
    
    test('should return 404 when resource not found', async () => {
      // Arrange
      mockService.delete.mockResolvedValue(false);
      
      // Act
      await controller.delete(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('TestResource not found');
      expect(error.statusCode).toBe(404);
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.delete.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      await expect(controller.delete(req, res, next)).rejects.toThrow('Service error');
    });
  });

  describe('withPermissionCheck', () => {
    test('should call handler when permission check passes', async () => {
      // Arrange
      const handlerFn = jest.fn().mockImplementation((req, res) => {
        res.status(200).json({ success: true });
      });
      const permissionCheckFn = jest.fn().mockResolvedValue(true);
      const handlerWithCheck = controller.withPermissionCheck(handlerFn, permissionCheckFn);
      
      // Act
      await handlerWithCheck(req, res, next);
      
      // Assert
      expect(permissionCheckFn).toHaveBeenCalledWith(req);
      expect(handlerFn).toHaveBeenCalledWith(req, res, next);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ success: true });
    });
    
    test('should return 403 when permission check fails', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const permissionCheckFn = jest.fn().mockResolvedValue(false);
      const handlerWithCheck = controller.withPermissionCheck(handlerFn, permissionCheckFn);
      
      // Act
      await handlerWithCheck(req, res, next);
      
      // Assert
      expect(permissionCheckFn).toHaveBeenCalledWith(req);
      expect(handlerFn).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('You do not have permission to perform this action');
      expect(error.statusCode).toBe(403);
    });
    
    test('should handle permission check error', async () => {
      // Arrange
      const handlerFn = jest.fn();
      const permissionCheckFn = jest.fn().mockImplementation(() => {
        throw new Error('Permission check error');
      });
      const handlerWithCheck = controller.withPermissionCheck(handlerFn, permissionCheckFn);
      
      // Act & Assert
      await expect(handlerWithCheck(req, res, next)).rejects.toThrow('Permission check error');
    });
  });

  describe('getOwnResource', () => {
    test('should get own resource when service supports it', async () => {
      // Act
      await controller.getOwnResource(req, res, next);
      
      // Assert
      expect(mockService.getByUserId).toHaveBeenCalledWith('user-id');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'user-resource',
          userId: 'user-id'
        })
      });
    });
    
    test('should return 501 when service does not support getByUserId', async () => {
      // Arrange
      delete mockService.getByUserId;
      
      // Act
      await controller.getOwnResource(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('This resource does not support user-specific retrieval');
      expect(error.statusCode).toBe(501);
    });
    
    test('should return 404 when resource not found for user', async () => {
      // Arrange
      mockService.getByUserId.mockResolvedValue(null);
      
      // Act
      await controller.getOwnResource(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('TestResource not found for current user');
      expect(error.statusCode).toBe(404);
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.getByUserId.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      try {
        await controller.getOwnResource(req, res, next);
      } catch (err) {
        expect(err.message).toBe('Service error');
      }
    });
  });

  describe('updateOwnResource', () => {
    test('should update own resource when service supports it', async () => {
      // Act
      await controller.updateOwnResource(req, res, next);
      
      // Assert
      expect(mockService.updateByUserId).toHaveBeenCalledWith(
        'user-id',
        expect.objectContaining({
          name: 'Test Resource'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          id: 'user-resource',
          userId: 'user-id',
          name: 'Updated'
        })
      });
    });
    
    test('should return 501 when service does not support updateByUserId', async () => {
      // Arrange
      delete mockService.updateByUserId;
      
      // Act
      await controller.updateOwnResource(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('This resource does not support user-specific updates');
      expect(error.statusCode).toBe(501);
    });
    
    test('should return 404 when resource not found for user', async () => {
      // Arrange
      mockService.updateByUserId.mockResolvedValue(null);
      
      // Act
      await controller.updateOwnResource(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      const error = next.mock.calls[0][0];
      expect(error.message).toBe('TestResource not found for current user');
      expect(error.statusCode).toBe(404);
    });
    
    test('should handle service error', async () => {
      // Arrange
      mockService.updateByUserId.mockImplementation(() => {
        throw new Error('Service error');
      });
      
      // Act & Assert
      try {
        await controller.updateOwnResource(req, res, next);
      } catch (err) {
        expect(err.message).toBe('Service error');
      }
    });
  });
}); 