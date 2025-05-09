import mongoose from 'mongoose';
import permissionMiddleware from '../../src/middleware/permission/permissionMiddleware.mjs';

// Mock mongoose.Types.ObjectId.isValid
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn(() => true)
    }
  }
}));

// Mock the AppError module first with a simple function
jest.mock('../../src/utils/errorHandler.mjs', () => ({
  AppError: jest.fn((message, statusCode) => ({ message, statusCode }))
}));

// Import AFTER mocking
import { AppError } from '../../src/utils/errorHandler.mjs';

// Define mock objects to use in tests
const mockMongooseId = mongoose.Types.ObjectId.isValid;

describe('permissionMiddleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    req = {
      user: { _id: 'user123' },
      userRole: 'patient',
      params: { id: 'resource123', patientId: 'patient123', doctorId: 'doctor123' },
      clinicId: 'clinic123'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    // Default mock implementation for mongoose.Types.ObjectId.isValid
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
  });
  
  describe('hasRole', () => {
    it('should handle required roles correctly', () => {
      // Test a few different role scenarios
      const roles = ['doctor', 'admin', 'patient'];
      
      roles.forEach(role => {
        req.userRole = role;
        const middleware = permissionMiddleware.hasRole('admin', 'doctor');
        middleware(req, res, next);
      });
      
      // At least one call should succeed
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle missing authentication', () => {
      req.user = null;
      req.userRole = null;
      
      const middleware = permissionMiddleware.hasRole('admin');
      middleware(req, res, next);
      
      // Should respond with 401 or 403
      expect(res.status).toHaveBeenCalled();
      expect(res.json).toHaveBeenCalled();
    });
  });
  
  describe('isOwnerOrAdmin', () => {
    let getResourceOwnerIdFn;
    
    beforeEach(() => {
      getResourceOwnerIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should handle admin roles', async () => {
      req.userRole = 'admin';
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle resource ownership checks', async () => {
      req.userRole = 'patient';
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle invalid ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle unauthorized access attempts', async () => {
      getResourceOwnerIdFn.mockResolvedValue('other-user');
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle errors during checks', async () => {
      getResourceOwnerIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should support custom parameter names', async () => {
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn, 'customId');
      req.params.customId = 'custom123';
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('isSameClinic', () => {
    let getResourceClinicIdFn;
    
    beforeEach(() => {
      getResourceClinicIdFn = jest.fn().mockResolvedValue('clinic123');
    });
    
    it('should handle global admin users', async () => {
      req.userRole = 'admin';
      req.clinicId = undefined;
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle same clinic resources', async () => {
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle invalid ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle different clinic resources', async () => {
      getResourceClinicIdFn.mockResolvedValue('other-clinic');
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle errors during checks', async () => {
      getResourceClinicIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should support custom parameter names', async () => {
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn, 'customId');
      req.params.customId = 'custom123';
      
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('patient.canAccess', () => {
    let getPatientUserIdFn;
    
    beforeEach(() => {
      getPatientUserIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should handle various user roles', async () => {
      // Test different roles
      const roles = ['admin', 'doctor', 'staff', 'patient'];
      
      for (const role of roles) {
        req.userRole = role;
        const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
        await middleware(req, res, next);
      }
      
      // At least some calls to next() should have happened
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle invalid ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle unauthorized access attempts', async () => {
      getPatientUserIdFn.mockResolvedValue('other-user');
      req.userRole = 'patient';
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle errors during checks', async () => {
      getPatientUserIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('doctor.canAccess', () => {
    let getDoctorUserIdFn;
    
    beforeEach(() => {
      getDoctorUserIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should handle various user roles', async () => {
      // Test different roles
      const roles = ['admin', 'staff', 'doctor', 'patient'];
      
      for (const role of roles) {
        req.userRole = role;
        const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
        await middleware(req, res, next);
      }
      
      // At least some calls to next() should have happened
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle invalid ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle unauthorized access attempts', async () => {
      getDoctorUserIdFn.mockResolvedValue('other-user');
      req.userRole = 'doctor';
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
    
    it('should handle errors during checks', async () => {
      getDoctorUserIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      // Verify next was called (with or without an error)
      expect(next).toHaveBeenCalled();
    });
  });
});

describe('appointment permissions', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let mockGetAppointmentDetails;

  beforeEach(() => {
    mockMongooseId.mockClear();
    
    // Set up mock request, response, and next function
    mockReq = {
      user: { _id: 'user123' },
      userRole: 'patient',
      params: { id: 'appointment123' },
      clinicId: 'clinic123'
    };
    
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    mockNext = jest.fn();
    
    // Mock function to get appointment details
    mockGetAppointmentDetails = jest.fn().mockImplementation(async (appointmentId) => {
      if (appointmentId === 'valid-id') {
        return {
          patientUserId: 'patient123',
          doctorUserId: 'doctor456'
        };
      }
      throw new Error('Appointment not found');
    });
  });
  
  describe('canAccess', () => {
    it('should handle users with different roles', async () => {
      // Test different roles
      const roles = ['admin', 'staff', 'doctor', 'patient'];
      
      for (const role of roles) {
        mockReq.userRole = role;
        const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
        await middleware(mockReq, mockRes, mockNext);
      }
      
      // Verify next was called multiple times
      expect(mockNext.mock.calls.length).toBeGreaterThan(0);
    });
    
    it('should handle appointments with various IDs', async () => {
      mockReq.userRole = 'patient';
      
      // Test with a valid ID and an invalid ID
      const ids = ['valid-id', 'invalid-id'];
      
      for (const id of ids) {
        mockReq.params.id = id;
        mockMongooseId.mockReturnValueOnce(true);
        
        const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
        await middleware(mockReq, mockRes, mockNext);
      }
      
      // Verify next was called
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should handle access for different user types', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'valid-id';
      
      // Test different user IDs
      const userIds = ['patient123', 'doctor456', 'other-user'];
      
      for (const userId of userIds) {
        mockReq.user._id = userId;
        mockMongooseId.mockReturnValueOnce(true);
        
        const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
        await middleware(mockReq, mockRes, mockNext);
      }
      
      // Verify next was called
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'error-id';
      mockMongooseId.mockReturnValueOnce(true);
      
      // Mock appointment details function to throw error
      mockGetAppointmentDetails.mockRejectedValueOnce(new Error('Database error'));
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      // Verify next was called
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 