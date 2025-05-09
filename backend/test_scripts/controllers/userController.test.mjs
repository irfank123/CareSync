import mongoose from 'mongoose';
import { AppError } from '../../src/utils/errorHandler.mjs';

// --- Mock Dependencies ---

// Mock express-validator
jest.mock('express-validator', () => {
  return {
    validationResult: jest.fn().mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    })
  };
});

// Mock mongoose
jest.mock('mongoose', () => {
  const mockObjectId = jest.fn().mockImplementation((id) => id);
  mockObjectId.isValid = jest.fn().mockReturnValue(true);
  
  return {
    Types: {
      ObjectId: mockObjectId
    }
  };
});

// Mock userService
const mockUserService = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getUserProfile: jest.fn(),
  searchUsers: jest.fn()
};

// Mock controllerHelper
jest.mock('../../src/utils/controllerHelper.mjs', () => ({
  withServices: jest.fn((fn, dependencies) => {
    return (req, res, next) => {
      const services = {
        userService: mockUserService
      };
      return fn(req, res, next, services);
    };
  }),
  withServicesForController: jest.fn((controller, serviceMappings) => {
    const decoratedController = {};
    for (const [methodName, method] of Object.entries(controller)) {
      if (typeof method === 'function') {
        decoratedController[methodName] = (req, res, next) => {
          const services = {
            userService: mockUserService
          };
          return method(req, res, next, services);
        };
      } else {
        decoratedController[methodName] = method;
      }
    }
    return decoratedController;
  })
}));

// Import modules after mocking
import * as userController from '../../src/controllers/userController.mjs';

describe('User Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { 
        _id: 'user123',
        id: 'user123'
      },
      userRole: 'doctor',
      clinicId: 'clinic123',
      isClinicAdmin: false
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Setup default mocks
    mockUserService.getAll.mockResolvedValue({
      data: [
        { _id: 'user1', firstName: 'John', lastName: 'Doe' },
        { _id: 'user2', firstName: 'Jane', lastName: 'Smith' }
      ],
      total: 2,
      totalPages: 1,
      currentPage: 1
    });
    
    mockUserService.getById.mockResolvedValue({
      _id: 'user1',
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      roleData: {}
    });
    
    mockUserService.create.mockResolvedValue({
      _id: 'user3',
      firstName: 'New',
      lastName: 'User',
      email: 'new@example.com'
    });
    
    mockUserService.update.mockResolvedValue({
      _id: 'user1',
      firstName: 'Updated',
      lastName: 'User',
      email: 'john@example.com'
    });
    
    mockUserService.delete.mockResolvedValue(true);
    
    mockUserService.getUserProfile.mockResolvedValue({
      _id: 'user123',
      firstName: 'John',
      lastName: 'Doe',
      profileInfo: {
        appointmentsCount: 5
      }
    });
    
    mockUserService.searchUsers.mockResolvedValue([
      { _id: 'user1', firstName: 'John', lastName: 'Doe' },
      { _id: 'user2', firstName: 'Jane', lastName: 'Smith' }
    ]);
  });
  
  describe('getUsers', () => {
    test('should get all users with pagination and filtering', async () => {
      // Arrange
      req.query = {
        page: '2',
        limit: '10',
        search: 'john',
        sort: 'lastName',
        order: 'asc',
        role: 'doctor',
        clinicId: 'clinic123'
      };
      req.userRole = 'admin';
      
      // Act
      await userController.getUsers(req, res, next);
      
      // Assert
      expect(mockUserService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: '2',
        limit: '10',
        search: 'john',
        sort: 'lastName',
        order: 'asc',
        role: 'doctor',
        clinicId: 'clinic123'
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
    
    test('should restrict clinic users to only see users from their clinic', async () => {
      // Arrange
      req.userRole = 'doctor'; // Not admin or staff
      req.clinicId = 'clinic123';
      
      // Act
      await userController.getUsers(req, res, next);
      
      // Assert
      expect(mockUserService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        clinicId: 'clinic123'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should return 403 if non-admin user without clinic tries to view users', async () => {
      // Arrange
      req.userRole = 'doctor';
      req.clinicId = null;
      
      // Act
      await userController.getUsers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      const testError = new Error('Service error');
      mockUserService.getAll.mockRejectedValueOnce(testError);
      
      // Act
      await userController.getUsers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('getUser', () => {
    test('should get a user by ID if authorized as self', async () => {
      // Arrange
      req.params.id = 'user123'; // Same as req.user._id
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(mockUserService.getById).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should get a user by ID if authorized as admin', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'admin';
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(mockUserService.getById).toHaveBeenCalledWith('user456');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should get a user by ID if authorized as clinic admin', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(mockUserService.getById).toHaveBeenCalledWith('user456');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should return 403 if not authorized to view the profile', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'doctor';
      req.isClinicAdmin = false;
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should return 404 if user not found', async () => {
      // Arrange
      req.params.id = 'user123';
      mockUserService.getById.mockResolvedValueOnce(null);
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params.id = 'user123';
      const testError = new Error('Service error');
      mockUserService.getById.mockRejectedValueOnce(testError);
      
      // Act
      await userController.getUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('createUser', () => {
    test('should create a new user as admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        role: 'admin'
      };
      
      // Act
      await userController.createUser(req, res, next);
      
      // Assert
      expect(mockUserService.create).toHaveBeenCalledWith(req.body, req.user._id);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should create a user with allowed role as clinic admin', async () => {
      // Arrange
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      req.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        role: 'doctor'
      };
      
      // Act
      await userController.createUser(req, res, next);
      
      // Assert
      expect(mockUserService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: 'clinic123', // Should add clinicId automatically
          role: 'doctor'
        }),
        req.user._id
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    test('should return 403 if clinic admin tries to create disallowed role', async () => {
      // Arrange
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        role: 'admin' // Not allowed
      };
      
      // Act
      await userController.createUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.userRole = 'admin';
      req.body = {
        firstName: 'New',
        lastName: 'User',
        email: 'new@example.com',
        role: 'doctor'
      };
      const testError = new Error('Service error');
      mockUserService.create.mockRejectedValueOnce(testError);
      
      // Act
      await userController.createUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('updateUser', () => {
    test('should update user as self', async () => {
      // Arrange
      req.params.id = 'user123'; // Same as req.user._id
      req.body = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '123-456-7890',
        role: 'admin' // Should be filtered out for self update by non-admin
      };
      req.userRole = 'doctor';
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(mockUserService.update).toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name',
          phoneNumber: '123-456-7890'
        })
      );
      expect(mockUserService.update).not.toHaveBeenCalledWith(
        'user123',
        expect.objectContaining({
          role: 'admin'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should update another user as admin with all fields', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'admin';
      req.body = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '123-456-7890',
        role: 'patient'
      };
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(mockUserService.update).toHaveBeenCalledWith(
        'user456',
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name',
          phoneNumber: '123-456-7890',
          role: 'patient'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should update user as clinic admin', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      req.body = {
        firstName: 'Updated',
        lastName: 'Name'
      };
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(mockUserService.update).toHaveBeenCalledWith(
        'user456',
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should return 403 if not authorized to update', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'doctor';
      req.isClinicAdmin = false;
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should return 404 if user not found', async () => {
      // Arrange
      req.params.id = 'user123';
      mockUserService.update.mockResolvedValueOnce(null);
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params.id = 'user123';
      const testError = new Error('Service error');
      mockUserService.update.mockRejectedValueOnce(testError);
      
      // Act
      await userController.updateUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('deleteUser', () => {
    test('should delete user as admin', async () => {
      // Arrange
      req.params.id = 'user456'; // Different from req.user._id
      req.userRole = 'admin';
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(mockUserService.delete).toHaveBeenCalledWith('user456', req.user._id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'User deleted successfully'
      });
    });
    
    test('should delete user as clinic admin for their clinic', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      mockUserService.getById.mockResolvedValueOnce({
        _id: 'user456',
        clinicId: 'clinic123'
      });
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(mockUserService.delete).toHaveBeenCalledWith('user456', req.user._id);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should return 403 if not authorized to delete users', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'doctor';
      req.isClinicAdmin = false;
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should return 400 if trying to delete self', async () => {
      // Arrange
      req.params.id = 'user123'; // Same as req.user._id
      req.userRole = 'admin';
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    test('should return 403 if clinic admin tries to delete user from another clinic', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      mockUserService.getById.mockResolvedValueOnce({
        _id: 'user456',
        clinicId: 'differentClinic'
      });
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    test('should return 404 if user not found for clinic admin check', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'staff';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic123';
      mockUserService.getById.mockResolvedValueOnce(null);
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    test('should return 404 if delete operation did not succeed', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'admin';
      mockUserService.delete.mockResolvedValueOnce(false);
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params.id = 'user456';
      req.userRole = 'admin';
      const testError = new Error('Service error');
      mockUserService.delete.mockRejectedValueOnce(testError);
      
      // Act
      await userController.deleteUser(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('getProfile', () => {
    test('should get user profile', async () => {
      // Act
      await userController.getProfile(req, res, next);
      
      // Assert
      expect(mockUserService.getUserProfile).toHaveBeenCalledWith(req.user._id);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should handle service errors', async () => {
      // Arrange
      const testError = new Error('Service error');
      mockUserService.getUserProfile.mockRejectedValueOnce(testError);
      
      // Act
      await userController.getProfile(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('updateProfile', () => {
    test('should update user profile with allowed fields', async () => {
      // Arrange
      req.body = {
        firstName: 'Updated',
        lastName: 'Name',
        phoneNumber: '123-456-7890',
        profileImageUrl: 'https://example.com/image.jpg',
        preferences: { theme: 'dark' },
        role: 'admin' // Should be filtered out
      };
      
      // Act
      await userController.updateProfile(req, res, next);
      
      // Assert
      expect(mockUserService.update).toHaveBeenCalledWith(
        req.user._id,
        expect.objectContaining({
          firstName: 'Updated',
          lastName: 'Name',
          phoneNumber: '123-456-7890',
          profileImageUrl: 'https://example.com/image.jpg',
          preferences: { theme: 'dark' }
        })
      );
      expect(mockUserService.update).not.toHaveBeenCalledWith(
        req.user._id,
        expect.objectContaining({
          role: 'admin'
        })
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.body = { firstName: 'Updated' };
      const testError = new Error('Service error');
      mockUserService.update.mockRejectedValueOnce(testError);
      
      // Act
      await userController.updateProfile(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
  
  describe('searchUsers', () => {
    test('should search users with query parameters', async () => {
      // Arrange
      req.query = {
        query: 'john',
        fields: 'firstName,lastName',
        limit: '5'
      };
      
      // Act
      await userController.searchUsers(req, res, next);
      
      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith({
        query: 'john',
        fields: ['firstName', 'lastName'],
        limit: 5
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: expect.any(Array)
      });
    });
    
    test('should handle empty query parameters', async () => {
      // Arrange
      req.query = {};
      
      // Act
      await userController.searchUsers(req, res, next);
      
      // Assert
      expect(mockUserService.searchUsers).toHaveBeenCalledWith({
        query: undefined,
        fields: [],
        limit: 10
      });
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.query = { query: 'john' };
      const testError = new Error('Service error');
      mockUserService.searchUsers.mockRejectedValueOnce(testError);
      
      // Act
      await userController.searchUsers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
  });
}); 