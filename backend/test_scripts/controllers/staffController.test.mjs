import { AppError } from '../../src/utils/errorHandler.mjs';

// --- Mock Dependencies ---

// Need to mock mongoose before importing any modules that require it
jest.mock('mongoose', () => {
  const mockSchema = {
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true)
      }
    },
    Schema: {
      Types: {
        ObjectId: 'ObjectId'
      }
    }
  };
  mockSchema.Types.ObjectId.isValid = jest.fn().mockReturnValue(true);
  return mockSchema;
});

// Mock staffService
jest.mock('../../src/services/staffService.mjs', () => ({
  __esModule: true,
  default: {
    getAll: jest.fn(),
    getById: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
    getByUserId: jest.fn(),
    updateByUserId: jest.fn(),
    getStaffUserId: jest.fn()
  }
}));

// Mock express-validator
jest.mock('express-validator', () => {
  return {
    check: jest.fn().mockReturnValue({
      not: jest.fn().mockReturnValue({
        isEmpty: jest.fn().mockReturnThis()
      }),
      isIn: jest.fn().mockReturnThis(),
      optional: jest.fn().mockReturnThis(),
      isArray: jest.fn().mockReturnThis()
    }),
    validationResult: jest.fn().mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    })
  };
});

// Mock utils
jest.mock('../../src/utils/errorHandler.mjs', () => {
  const originalModule = jest.requireActual('../../src/utils/errorHandler.mjs');
  return {
    ...originalModule,
    asyncHandler: jest.fn((fn) => {
      return (req, res, next) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
      };
    }),
    formatValidationErrors: jest.fn(errors => ({ 
      success: false,
      errors
    }))
  };
});

// Mock models
jest.mock('../../src/models/index.mjs', () => ({
  __esModule: true,
  Staff: {
    findOne: jest.fn()
  },
  User: {
    findOne: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

// --- Import modules after mocking ---
import { validationResult } from 'express-validator';
import staffService from '../../src/services/staffService.mjs';
import * as staffController from '../../src/controllers/staffController.mjs';

describe('Staff Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { 
        _id: 'user123'
      },
      userRole: 'admin',
      isClinicAdmin: false,
      clinicId: null
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Setup default mocks
    staffService.getAll.mockResolvedValue({
      data: [
        {
          _id: 'staff1',
          position: 'nurse',
          department: 'cardiology',
          user: {
            _id: 'user1',
            firstName: 'Jane',
            lastName: 'Doe',
            email: 'jane@example.com'
          }
        }
      ],
      total: 1,
      totalPages: 1,
      currentPage: 1
    });
    
    staffService.getById.mockResolvedValue({
      _id: 'staff1',
      position: 'nurse',
      department: 'cardiology',
      user: {
        _id: 'user1',
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane@example.com',
        clinicId: 'clinic1'
      }
    });
    
    staffService.create.mockResolvedValue({
      _id: 'staff1',
      position: 'nurse',
      department: 'cardiology',
      userId: 'user1'
    });
    
    staffService.update.mockResolvedValue({
      _id: 'staff1',
      position: 'nurse',
      department: 'updated-department',
      userId: 'user1'
    });
    
    staffService.delete.mockResolvedValue(true);
    
    staffService.getByUserId.mockResolvedValue({
      _id: 'staff1',
      position: 'nurse',
      department: 'cardiology',
      userId: 'user123'
    });
    
    staffService.updateByUserId.mockResolvedValue({
      _id: 'staff1',
      position: 'nurse',
      department: 'updated-department',
      userId: 'user123'
    });
    
    staffService.getStaffUserId.mockResolvedValue('user1');
  });
  
  describe('getStaffMembers', () => {
    test('should get all staff members when user is admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.query = { page: '1', limit: '10' };
      
      // Act
      await staffController.getStaffMembers(req, res, next);
      
      // Assert
      expect(staffService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 10
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        total: 1,
        totalPages: 1,
        currentPage: 1,
        data: expect.any(Array)
      });
    });
    
    test('should filter by clinic ID when user is clinic admin', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic1';
      req.query = { page: '1', limit: '10' };
      
      // Act
      await staffController.getStaffMembers(req, res, next);
      
      // Assert
      expect(staffService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 1,
        limit: 10,
        clinicId: 'clinic1'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle unauthorized access', async () => {
      // Arrange
      req.userRole = 'staff';
      req.isClinicAdmin = false;
      
      // Act
      await staffController.getStaffMembers(req, res, next);
      
      // Assert
      expect(staffService.getAll).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You are not authorized to view staff members');
    });
    
    test('should handle various query parameters', async () => {
      // Arrange
      req.userRole = 'admin';
      req.query = {
        page: '2',
        limit: '20',
        search: 'nurse',
        sort: 'department',
        order: 'asc',
        position: 'nurse',
        department: 'cardiology'
      };
      
      // Act
      await staffController.getStaffMembers(req, res, next);
      
      // Assert
      expect(staffService.getAll).toHaveBeenCalledWith(expect.objectContaining({
        page: 2,
        limit: 20,
        search: 'nurse',
        sort: 'department',
        order: 'asc',
        position: 'nurse',
        department: 'cardiology'
      }));
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
  
  describe('getStaffMember', () => {
    test('should get a staff member by ID when user is admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'staff1';
      
      // Act
      await staffController.getStaffMember(req, res, next);
      
      // Assert
      expect(staffService.getById).toHaveBeenCalledWith('staff1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should get staff member when user is clinic admin', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic1';
      req.params.id = 'staff1';
      
      // Act
      await staffController.getStaffMember(req, res, next);
      
      // Assert
      expect(staffService.getById).toHaveBeenCalledWith('staff1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should get staff profile when user is self', async () => {
      // Arrange
      req.userRole = 'staff';
      req.params.id = 'staff1';
      staffService.getStaffUserId.mockResolvedValueOnce('user123'); // Same as req.user._id
      
      // Act
      await staffController.getStaffMember(req, res, next);
      
      // Assert
      expect(staffService.getById).toHaveBeenCalledWith('staff1');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle unauthorized access', async () => {
      // Arrange
      req.userRole = 'doctor';
      req.params.id = 'staff1';
      staffService.getStaffUserId.mockResolvedValueOnce('user456'); // Different from req.user._id
      
      // Act
      await staffController.getStaffMember(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You are not authorized to view this staff profile');
    });
    
    test('should handle staff not found', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'nonexistent';
      staffService.getById.mockResolvedValueOnce(null);
      
      // Act
      await staffController.getStaffMember(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff member not found');
    });
  });
  
  describe('createStaffMember', () => {
    test('should create a staff member when user is admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.body = {
        userId: 'user1',
        position: 'nurse',
        department: 'cardiology'
      };
      
      // Act
      await staffController.createStaffMember(req, res, next);
      
      // Assert
      expect(staffService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          position: 'nurse',
          department: 'cardiology'
        }),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should associate with clinic when user is clinic admin', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic1';
      req.body = {
        userId: 'user1',
        position: 'nurse',
        department: 'cardiology'
      };
      
      // Act
      await staffController.createStaffMember(req, res, next);
      
      // Assert
      expect(staffService.create).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user1',
          position: 'nurse',
          department: 'cardiology',
          clinicId: 'clinic1'
        }),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    test('should handle unauthorized creation attempt', async () => {
      // Arrange
      req.userRole = 'staff';
      req.body = {
        userId: 'user1',
        position: 'nurse',
        department: 'cardiology'
      };
      
      // Act
      await staffController.createStaffMember(req, res, next);
      
      // Assert
      expect(staffService.create).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You are not authorized to create staff members');
    });
    
    test('should handle validation errors', async () => {
      // Arrange
      req.userRole = 'admin';
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Position is required' }])
      });
      
      // Act
      await staffController.createStaffMember(req, res, next);
      
      // Assert
      expect(staffService.create).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
  
  describe('updateStaffMember', () => {
    test('should update a staff member when user is admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'staff1';
      req.body = {
        position: 'administrator',
        department: 'updated-department'
      };
      
      // Act
      await staffController.updateStaffMember(req, res, next);
      
      // Assert
      expect(staffService.update).toHaveBeenCalledWith('staff1', req.body, 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should allow self-update with limited fields', async () => {
      // Arrange
      req.userRole = 'staff';
      req.params.id = 'staff1';
      staffService.getStaffUserId.mockResolvedValueOnce('user123'); // Same as req.user._id
      req.body = {
        position: 'administrator', // Not allowed for self-update
        department: 'updated-department' // Allowed for self-update
      };
      
      // Act
      await staffController.updateStaffMember(req, res, next);
      
      // Assert
      expect(staffService.update).toHaveBeenCalledWith('staff1', { department: 'updated-department' }, 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle unauthorized update attempt', async () => {
      // Arrange
      req.userRole = 'patient';
      req.params.id = 'staff1';
      staffService.getStaffUserId.mockResolvedValueOnce('user456'); // Different from req.user._id
      
      // Act
      await staffController.updateStaffMember(req, res, next);
      
      // Assert
      expect(staffService.update).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You are not authorized to update this staff profile');
    });
    
    test('should handle staff not found', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'nonexistent';
      staffService.update.mockResolvedValueOnce(null);
      
      // Act
      await staffController.updateStaffMember(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff member not found');
    });
    
    test('should handle validation errors', async () => {
      // Arrange
      req.userRole = 'admin';
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid position' }])
      });
      
      // Act
      await staffController.updateStaffMember(req, res, next);
      
      // Assert
      expect(staffService.update).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
  
  describe('deleteStaffMember', () => {
    test('should delete a staff member when user is admin', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'staff1';
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(staffService.delete).toHaveBeenCalledWith('staff1', 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Staff member deleted successfully'
      });
    });
    
    test('should allow clinic admin to delete staff from their clinic', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic1';
      req.params.id = 'staff1';
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(staffService.delete).toHaveBeenCalledWith('staff1', 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should prevent clinic admin from deleting staff from another clinic', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic2'; // Different from staff's clinic (clinic1)
      req.params.id = 'staff1';
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(staffService.delete).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You can only delete staff members from your clinic');
    });
    
    test('should handle unauthorized deletion attempt', async () => {
      // Arrange
      req.userRole = 'staff';
      req.params.id = 'staff1';
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(staffService.delete).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('You are not authorized to delete staff members');
    });
    
    test('should handle staff not found', async () => {
      // Arrange
      req.userRole = 'admin';
      req.params.id = 'nonexistent';
      staffService.delete.mockResolvedValueOnce(false);
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff member not found');
    });
    
    test('should handle staff not found for clinic admin', async () => {
      // Arrange
      req.userRole = 'clinicAdmin';
      req.isClinicAdmin = true;
      req.clinicId = 'clinic1';
      req.params.id = 'nonexistent';
      staffService.getById.mockResolvedValueOnce(null);
      
      // Act
      await staffController.deleteStaffMember(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff member not found');
    });
  });
  
  describe('getMyProfile', () => {
    test('should get staff profile for current staff user', async () => {
      // Arrange
      req.userRole = 'staff';
      
      // Act
      await staffController.getMyProfile(req, res, next);
      
      // Assert
      expect(staffService.getByUserId).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should handle non-staff users trying to access profile', async () => {
      // Arrange
      req.userRole = 'doctor';
      
      // Act
      await staffController.getMyProfile(req, res, next);
      
      // Assert
      expect(staffService.getByUserId).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Only staff users can access this endpoint');
    });
    
    test('should handle staff profile not found', async () => {
      // Arrange
      req.userRole = 'staff';
      staffService.getByUserId.mockResolvedValueOnce(null);
      
      // Act
      await staffController.getMyProfile(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff profile not found');
    });
  });
  
  describe('updateMyProfile', () => {
    test('should update staff profile for current staff user', async () => {
      // Arrange
      req.userRole = 'staff';
      req.body = {
        department: 'updated-department'
      };
      
      // Act
      await staffController.updateMyProfile(req, res, next);
      
      // Assert
      expect(staffService.updateByUserId).toHaveBeenCalledWith('user123', { department: 'updated-department' });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should filter out restricted fields', async () => {
      // Arrange
      req.userRole = 'staff';
      req.body = {
        position: 'administrator', // Not allowed
        department: 'updated-department', // Allowed
        permissions: ['create', 'update'] // Not allowed
      };
      
      // Act
      await staffController.updateMyProfile(req, res, next);
      
      // Assert
      expect(staffService.updateByUserId).toHaveBeenCalledWith('user123', { department: 'updated-department' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle non-staff users trying to update profile', async () => {
      // Arrange
      req.userRole = 'doctor';
      req.body = {
        department: 'updated-department'
      };
      
      // Act
      await staffController.updateMyProfile(req, res, next);
      
      // Assert
      expect(staffService.updateByUserId).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Only staff users can access this endpoint');
    });
    
    test('should handle staff profile not found', async () => {
      // Arrange
      req.userRole = 'staff';
      req.body = {
        department: 'updated-department'
      };
      staffService.updateByUserId.mockResolvedValueOnce(null);
      
      // Act
      await staffController.updateMyProfile(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Staff profile not found');
    });
    
    test('should handle validation errors', async () => {
      // Arrange
      req.userRole = 'staff';
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Invalid department' }])
      });
      
      // Act
      await staffController.updateMyProfile(req, res, next);
      
      // Assert
      expect(staffService.updateByUserId).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
}); 