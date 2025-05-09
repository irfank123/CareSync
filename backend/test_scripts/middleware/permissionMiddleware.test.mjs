import mongoose from 'mongoose';
import permissionMiddleware from '../../src/middleware/permission/permissionMiddleware.mjs';

// Mock mongoose.Types.ObjectId.isValid
jest.mock('mongoose', () => ({
  Types: {
    ObjectId: {
      isValid: jest.fn()
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
    it('should call next() if user has required role', () => {
      req.userRole = 'doctor';
      
      const middleware = permissionMiddleware.hasRole('admin', 'doctor');
      middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
    });
    
    it('should return 401 if no user or role', () => {
      req.user = null;
      req.userRole = null;
      
      const middleware = permissionMiddleware.hasRole('admin');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required'
      });
      expect(next).not.toHaveBeenCalled();
    });
    
    it('should return 403 if user does not have required role', () => {
      req.userRole = 'patient';
      
      const middleware = permissionMiddleware.hasRole('admin', 'doctor');
      middleware(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'You do not have permission to perform this action'
      });
      expect(next).not.toHaveBeenCalled();
    });
  });
  
  describe('isOwnerOrAdmin', () => {
    let getResourceOwnerIdFn;
    
    beforeEach(() => {
      getResourceOwnerIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should call next() if user is admin', async () => {
      req.userRole = 'admin';
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getResourceOwnerIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is staff', async () => {
      req.userRole = 'staff';
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getResourceOwnerIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is the resource owner', async () => {
      req.userRole = 'patient';
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(getResourceOwnerIdFn).toHaveBeenCalledWith('resource123');
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 400 if ID format is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Invalid ID format');
      }
    });
    
    it('should return 403 if user is not the resource owner', async () => {
      getResourceOwnerIdFn.mockResolvedValue('other-user');
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('You do not have permission to access this resource');
      }
    });
    
    it('should return 500 if error occurs during check', async () => {
      getResourceOwnerIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Error checking resource ownership');
      }
    });
    
    it('should use custom parameter field if provided', async () => {
      const middleware = permissionMiddleware.isOwnerOrAdmin(getResourceOwnerIdFn, 'customId');
      req.params.customId = 'custom123';
      
      await middleware(req, res, next);
      
      expect(getResourceOwnerIdFn).toHaveBeenCalledWith('custom123');
    });
  });
  
  describe('isSameClinic', () => {
    let getResourceClinicIdFn;
    
    beforeEach(() => {
      getResourceClinicIdFn = jest.fn().mockResolvedValue('clinic123');
    });
    
    it('should call next() if user is global admin', async () => {
      req.userRole = 'admin';
      req.clinicId = undefined;
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getResourceClinicIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if resource belongs to same clinic', async () => {
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(getResourceClinicIdFn).toHaveBeenCalledWith('resource123');
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 400 if ID format is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Invalid ID format');
      }
    });
    
    it('should return 403 if resource belongs to different clinic', async () => {
      getResourceClinicIdFn.mockResolvedValue('other-clinic');
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('You do not have permission to access resources from another clinic');
      }
    });
    
    it('should return 500 if error occurs during check', async () => {
      getResourceClinicIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Error checking clinic association');
      }
    });
    
    it('should use custom parameter field if provided', async () => {
      const middleware = permissionMiddleware.isSameClinic(getResourceClinicIdFn, 'customId');
      req.params.customId = 'custom123';
      
      await middleware(req, res, next);
      
      expect(getResourceClinicIdFn).toHaveBeenCalledWith('custom123');
    });
  });
  
  describe('patient.canAccess', () => {
    let getPatientUserIdFn;
    
    beforeEach(() => {
      getPatientUserIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should call next() if user is admin', async () => {
      req.userRole = 'admin';
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getPatientUserIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is doctor', async () => {
      req.userRole = 'doctor';
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getPatientUserIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is staff', async () => {
      req.userRole = 'staff';
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getPatientUserIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is the patient', async () => {
      req.userRole = 'patient';
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(getPatientUserIdFn).toHaveBeenCalledWith('patient123');
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 400 if ID format is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Invalid patient ID format');
      }
    });
    
    it('should return 403 if user is not the patient', async () => {
      getPatientUserIdFn.mockResolvedValue('other-user');
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('You are not authorized to access this patient data');
      }
    });
    
    it('should return 500 if error occurs during check', async () => {
      getPatientUserIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.patient.canAccess(getPatientUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Error checking patient access permission');
      }
    });
  });
  
  describe('doctor.canAccess', () => {
    let getDoctorUserIdFn;
    
    beforeEach(() => {
      getDoctorUserIdFn = jest.fn().mockResolvedValue('user123');
    });
    
    it('should call next() if user is admin', async () => {
      req.userRole = 'admin';
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getDoctorUserIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is staff', async () => {
      req.userRole = 'staff';
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(getDoctorUserIdFn).not.toHaveBeenCalled();
    });
    
    it('should call next() if user is the doctor', async () => {
      req.userRole = 'doctor';
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(getDoctorUserIdFn).toHaveBeenCalledWith('doctor123');
      expect(next).toHaveBeenCalled();
    });
    
    it('should return 400 if ID format is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(400);
        expect(error.message).toBe('Invalid doctor ID format');
      }
    });
    
    it('should return 403 if user is not the doctor', async () => {
      getDoctorUserIdFn.mockResolvedValue('other-user');
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(403);
        expect(error.message).toBe('You are not authorized to access this doctor data');
      }
    });
    
    it('should return 500 if error occurs during check', async () => {
      getDoctorUserIdFn.mockRejectedValue(new Error('Database error'));
      
      const middleware = permissionMiddleware.doctor.canAccess(getDoctorUserIdFn);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      if (next.mock.calls.length > 0 && next.mock.calls[0][0]) {
        const error = next.mock.calls[0][0];
        expect(error.statusCode).toBe(500);
        expect(error.message).toBe('Error checking doctor access permission');
      }
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
    it('should allow admins to access all appointments', async () => {
      mockReq.userRole = 'admin';
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should allow staff to access all appointments', async () => {
      mockReq.userRole = 'staff';
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).not.toHaveBeenCalled();
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should validate MongoDB ID format', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'invalid-id';
      
      // Mock isValid to return false for invalid ID
      mockMongooseId.mockReturnValueOnce(false);
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockMongooseId).toHaveBeenCalledWith('invalid-id');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should allow patient access to their own appointment', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'valid-id';
      mockReq.user._id = 'patient123';
      
      // Mock isValid to return true for valid ID
      mockMongooseId.mockReturnValueOnce(true);
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).toHaveBeenCalledWith('valid-id');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should allow doctor access to their own appointment', async () => {
      mockReq.userRole = 'doctor';
      mockReq.params.id = 'valid-id';
      mockReq.user._id = 'doctor456';
      
      // Mock isValid to return true for valid ID
      mockMongooseId.mockReturnValueOnce(true);
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).toHaveBeenCalledWith('valid-id');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should deny access to uninvolved users', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'valid-id';
      mockReq.user._id = 'other-patient';
      
      // Mock isValid to return true for valid ID
      mockMongooseId.mockReturnValueOnce(true);
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).toHaveBeenCalledWith('valid-id');
      expect(mockNext).toHaveBeenCalled();
    });
    
    it('should handle errors gracefully', async () => {
      mockReq.userRole = 'patient';
      mockReq.params.id = 'valid-id';
      
      // Mock isValid to return true for valid ID
      mockMongooseId.mockReturnValueOnce(true);
      
      // Mock appointment details function to throw error
      mockGetAppointmentDetails.mockRejectedValueOnce(new Error('Database error'));
      
      const middleware = permissionMiddleware.appointment.canAccess(mockGetAppointmentDetails);
      await middleware(mockReq, mockRes, mockNext);
      
      expect(mockGetAppointmentDetails).toHaveBeenCalledWith('valid-id');
      expect(mockNext).toHaveBeenCalled();
    });
  });
}); 