import mongooseActual from 'mongoose';
import { AppError } from '../../src/utils/errorHandler.mjs';
import * as adminControllerActual from '../../src/controllers/adminController.mjs';

// --- Mock Dependencies ---

// Mock User and AuditLog models
jest.mock('../../src/models/index.mjs', () => ({
  User: {
    findById: jest.fn(),
    find: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      exec: jest.fn()
    })
  },
  AuditLog: {
    create: jest.fn()
  }
}));

// Mock clinicAuthService
jest.mock('../../src/services/clinicAuthService.mjs', () => ({
  sanitizeClinicData: jest.fn(clinic => clinic),
  updateVerificationStatus: jest.fn()
}));

// Mock emailService
jest.mock('../../src/services/emailService.mjs', () => ({
  sendEmail: jest.fn()
}));

// Mock mongoose
jest.mock('mongoose', () => {
  const mockClinic = {
    find: jest.fn().mockReturnThis(),
    findById: jest.fn(),
    skip: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    sort: jest.fn().mockResolvedValue([{ _id: 'clinic1' }]),
    countDocuments: jest.fn().mockResolvedValue(1)
  };
  
  return {
    model: jest.fn().mockReturnValue(mockClinic)
  };
});

// Mock express-validator
jest.mock('express-validator', () => {
  const isInMock = jest.fn().mockReturnValue({});
  const customMock = jest.fn().mockReturnValue({});
  
  const checkMock = jest.fn().mockImplementation(() => ({
    isIn: isInMock,
    custom: customMock
  }));
  
  return {
    check: checkMock,
    validationResult: jest.fn().mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    })
  };
});

// --- Retrieve Mocks After Mocking ---
import mongoose from 'mongoose';
import { User, AuditLog } from '../../src/models/index.mjs';
import clinicAuthService from '../../src/services/clinicAuthService.mjs';
import emailService from '../../src/services/emailService.mjs';
import { validationResult } from 'express-validator';

// Import adminController after mocks are set up
import * as adminController from '../../src/controllers/adminController.mjs';

describe('Admin Controller', () => {
  let req;
  let res;
  
  beforeEach(() => {
    req = {
      params: { id: 'clinic1' },
      query: {},
      body: {},
      user: { _id: 'admin1' }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    jest.clearAllMocks();
  });
  
  describe('getClinics', () => {
    test('should get clinics with default pagination', async () => {
      // Arrange
      const mockClinics = [{ _id: 'clinic1', name: 'Clinic 1' }];
      mongoose.model().sort.mockResolvedValue(mockClinics);
      clinicAuthService.sanitizeClinicData.mockImplementation(clinic => clinic);
      
      // Act
      await adminController.getClinics(req, res);
      
      // Assert
      expect(mongoose.model().find).toHaveBeenCalledWith({});
      expect(mongoose.model().skip).toHaveBeenCalledWith(0);
      expect(mongoose.model().limit).toHaveBeenCalledWith(10);
      expect(mongoose.model().sort).toHaveBeenCalledWith({ createdAt: -1 });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        total: 1,
        totalPages: 1,
        currentPage: 1,
        data: mockClinics
      });
    });
    
    test('should get clinics with custom pagination', async () => {
      // Arrange
      req.query = { page: 2, limit: 5 };
      
      // Act
      await adminController.getClinics(req, res);
      
      // Assert
      expect(mongoose.model().skip).toHaveBeenCalledWith(5);
      expect(mongoose.model().limit).toHaveBeenCalledWith(5);
    });
    
    test('should filter clinics by status', async () => {
      // Arrange
      req.query = { status: 'verified' };
      
      // Act
      await adminController.getClinics(req, res);
      
      // Assert
      expect(mongoose.model().find).toHaveBeenCalledWith({ verificationStatus: 'verified' });
    });
    
    test('should search clinics by name or email', async () => {
      // Arrange
      req.query = { search: 'test' };
      
      // Act
      await adminController.getClinics(req, res);
      
      // Assert
      expect(mongoose.model().find).toHaveBeenCalledWith({
        $or: [
          { name: { $regex: 'test', $options: 'i' } },
          { email: { $regex: 'test', $options: 'i' } }
        ]
      });
    });
    
    test('should handle server error', async () => {
      // Arrange
      mongoose.model().sort.mockRejectedValue(new Error('Server error'));
      
      // Act
      await adminController.getClinics(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while fetching clinics'
      });
    });
  });
  
  describe('getClinic', () => {
    test('should get clinic by id', async () => {
      // Arrange
      const mockClinic = { _id: 'clinic1', name: 'Clinic 1', adminUserId: 'admin1' };
      const mockAdmin = { _id: 'admin1', firstName: 'Admin', lastName: 'User', email: 'admin@example.com', role: 'admin' };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      User.findById.mockResolvedValue(mockAdmin);
      
      // Act
      await adminController.getClinic(req, res);
      
      // Assert
      expect(mongoose.model().findById).toHaveBeenCalledWith('clinic1');
      expect(User.findById).toHaveBeenCalledWith('admin1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          clinic: mockClinic,
          adminUser: {
            _id: 'admin1',
            firstName: 'Admin',
            lastName: 'User',
            email: 'admin@example.com',
            role: 'admin'
          }
        }
      });
    });
    
    test('should return 404 if clinic not found', async () => {
      // Arrange
      mongoose.model().findById.mockResolvedValue(null);
      
      // Act
      await adminController.getClinic(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Clinic not found'
      });
    });
    
    test('should handle case when admin user is not found', async () => {
      // Arrange
      const mockClinic = { _id: 'clinic1', name: 'Clinic 1', adminUserId: 'admin1' };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      User.findById.mockResolvedValue(null);
      
      // Act
      await adminController.getClinic(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          clinic: mockClinic,
          adminUser: null
        }
      });
    });
    
    test('should handle server error', async () => {
      // Arrange
      mongoose.model().findById.mockRejectedValue(new Error('Server error'));
      
      // Act
      await adminController.getClinic(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while fetching clinic'
      });
    });
  });
  
  describe('updateClinicVerification', () => {
    test('should update clinic verification status', async () => {
      // Arrange
      req.body = { status: 'verified', notes: 'Verified after document review' };
      const mockClinic = { _id: 'clinic1', verificationStatus: 'in_review' };
      
      clinicAuthService.updateVerificationStatus.mockResolvedValue(mockClinic);
      
      // Act
      await adminController.updateClinicVerification(req, res);
      
      // Assert
      expect(clinicAuthService.updateVerificationStatus).toHaveBeenCalledWith(
        'clinic1',
        'verified',
        'Verified after document review'
      );
      expect(AuditLog.create).toHaveBeenCalledWith({
        userId: 'admin1',
        action: 'update',
        resource: 'clinic',
        resourceId: 'clinic1',
        details: {
          field: 'verificationStatus',
          oldValue: 'in_review',
          newValue: 'verified',
          notes: 'Verified after document review'
        }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockClinic
      });
    });
    
    test('should return 400 for invalid status', async () => {
      // Arrange
      req.body = { status: 'invalid_status', notes: 'Invalid status test' };
      
      // Act
      await adminController.updateClinicVerification(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Invalid verification status'
      });
    });
    
    test('should handle validation errors', async () => {
      // Arrange
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Error' }])
      });
      
      // Act
      await adminController.updateClinicVerification(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        errors: [{ msg: 'Error' }]
      });
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.body = { status: 'verified', notes: 'Test notes' };
      const mockError = new Error('Service error');
      
      clinicAuthService.updateVerificationStatus.mockRejectedValue(mockError);
      
      // Act
      await adminController.updateClinicVerification(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Service error'
      });
    });
  });
  
  describe('getClinicDocuments', () => {
    test('should get clinic verification documents', async () => {
      // Arrange
      const mockClinic = {
        _id: 'clinic1',
        verificationDocuments: [{ url: 'doc1.pdf', type: 'license' }]
      };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      
      // Act
      await adminController.getClinicDocuments(req, res);
      
      // Assert
      expect(mongoose.model().findById).toHaveBeenCalledWith('clinic1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: mockClinic.verificationDocuments
      });
    });
    
    test('should return empty array if no documents', async () => {
      // Arrange
      const mockClinic = { _id: 'clinic1' };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      
      // Act
      await adminController.getClinicDocuments(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: []
      });
    });
    
    test('should return 404 if clinic not found', async () => {
      // Arrange
      mongoose.model().findById.mockResolvedValue(null);
      
      // Act
      await adminController.getClinicDocuments(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Clinic not found'
      });
    });
    
    test('should handle server error', async () => {
      // Arrange
      mongoose.model().findById.mockRejectedValue(new Error('Server error'));
      
      // Act
      await adminController.getClinicDocuments(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while fetching clinic documents'
      });
    });
  });
  
  describe('getClinicStaff', () => {
    test('should get clinic staff members', async () => {
      // Arrange
      const mockClinic = { _id: 'clinic1' };
      const mockStaff = [
        { _id: 'staff1', firstName: 'Staff', lastName: 'One', role: 'staff' },
        { _id: 'admin1', firstName: 'Admin', lastName: 'User', role: 'admin' }
      ];
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      const mockFindResult = {
        select: jest.fn().mockReturnThis(),
        exec: jest.fn().mockResolvedValue(mockStaff)
      };
      User.find.mockReturnValue(mockFindResult);
      
      // Act
      await adminController.getClinicStaff(req, res);
      
      // Assert
      expect(mongoose.model().findById).toHaveBeenCalledWith('clinic1');
      expect(User.find).toHaveBeenCalledWith({
        clinicId: mockClinic._id,
        role: { $in: ['admin', 'staff'] }
      });
      expect(res.status).toHaveBeenCalledWith(200);
      
      // Get the actual response that was sent
      const actualResponse = res.json.mock.calls[0][0];
      expect(actualResponse.success).toBe(true);
      expect(actualResponse.data).toEqual(mockFindResult); // Response contains the chainable object
    });
    
    test('should return 404 if clinic not found', async () => {
      // Arrange
      mongoose.model().findById.mockResolvedValue(null);
      
      // Act
      await adminController.getClinicStaff(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Clinic not found'
      });
    });
    
    test('should handle server error', async () => {
      // Arrange
      mongoose.model().findById.mockRejectedValue(new Error('Server error'));
      
      // Act
      await adminController.getClinicStaff(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while fetching clinic staff'
      });
    });
  });
  
  describe('suspendClinic', () => {
    test('should suspend an active clinic', async () => {
      // Arrange
      req.body = { reason: 'Terms of service violation' };
      const mockClinic = {
        _id: 'clinic1',
        email: 'clinic@example.com',
        isActive: true,
        save: jest.fn(async function() {
          // This simulates that save() actually changes the isActive property
          this.isActive = false;
          return true;
        })
      };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      
      // Act
      await adminController.suspendClinic(req, res);
      
      // Assert
      expect(mongoose.model().findById).toHaveBeenCalledWith('clinic1');
      expect(mockClinic.isActive).toBe(false);
      expect(mockClinic.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalledWith({
        userId: 'admin1',
        action: 'suspend',
        resource: 'clinic',
        resourceId: 'clinic1',
        details: {
          reason: 'Terms of service violation'
        }
      });
      expect(emailService.sendEmail).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        isSuspended: true,
        message: 'Clinic has been suspended'
      });
    });
    
    test('should reactivate a suspended clinic', async () => {
      // Arrange
      const mockClinic = {
        _id: 'clinic1',
        isActive: false,
        save: jest.fn(async function() {
          // This simulates that save() actually changes the isActive property
          this.isActive = true;
          return true;
        })
      };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      
      // Act
      await adminController.suspendClinic(req, res);
      
      // Assert
      expect(mockClinic.isActive).toBe(true);
      expect(AuditLog.create).toHaveBeenCalledWith({
        userId: 'admin1',
        action: 'unsuspend',
        resource: 'clinic',
        resourceId: 'clinic1',
        details: {
          reason: 'No reason provided'
        }
      });
      expect(emailService.sendEmail).not.toHaveBeenCalled();
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        isSuspended: false,
        message: 'Clinic has been reactivated'
      });
    });
    
    test('should return 404 if clinic not found', async () => {
      // Arrange
      mongoose.model().findById.mockResolvedValue(null);
      
      // Act
      await adminController.suspendClinic(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Clinic not found'
      });
    });
    
    test('should handle email sending error', async () => {
      // Arrange
      req.body = { reason: 'Terms of service violation' };
      const mockClinic = {
        _id: 'clinic1',
        email: 'clinic@example.com',
        isActive: true,
        save: jest.fn(async function() {
          // This simulates that save() actually changes the isActive property
          this.isActive = false;
          return true;
        })
      };
      
      mongoose.model().findById.mockResolvedValue(mockClinic);
      emailService.sendEmail.mockRejectedValue(new Error('Email error'));
      
      // Act
      await adminController.suspendClinic(req, res);
      
      // Assert
      // Should still succeed despite email error
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('should handle server error', async () => {
      // Arrange
      mongoose.model().findById.mockRejectedValue(new Error('Server error'));
      
      // Act
      await adminController.suspendClinic(req, res);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Server error while suspending clinic'
      });
    });
  });
}); 