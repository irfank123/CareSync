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

// Mock prescriptionService
const mockPrescriptionService = {
  createPrescription: jest.fn(),
  getPrescriptionsByPatient: jest.fn(),
  getPrescriptionById: jest.fn(),
  updatePrescription: jest.fn(),
  getMyPrescriptions: jest.fn()
};

// Mock utils
jest.mock('../../src/utils/controllerHelper.mjs', () => ({
  withServices: jest.fn((fn, dependencies) => {
    return (req, res, next) => {
      const services = {
        prescriptionService: mockPrescriptionService
      };
      return fn(req, res, next, services);
    };
  })
}));

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
  Patient: {
    findOne: jest.fn()
  },
  Doctor: {
    findOne: jest.fn()
  }
}));

// --- Import modules after mocking ---
import { validationResult } from 'express-validator';
import * as prescriptionController from '../../src/controllers/prescriptionController.mjs';
import { Patient, Doctor } from '../../src/models/index.mjs';

describe('Prescription Controller', () => {
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
        id: 'user123' // Some functions use req.user.id, others use req.user._id
      }
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPrescriptionService.createPrescription.mockResolvedValue({
      _id: 'prescription1',
      patientId: 'patient1',
      doctorId: 'doctor1',
      medications: [{ name: 'Medicine A', dosage: '10mg', frequency: 'daily' }]
    });
    
    mockPrescriptionService.getPrescriptionsByPatient.mockResolvedValue([
      {
        _id: 'prescription1',
        patientId: 'patient1',
        doctorId: 'doctor1',
        medications: [{ name: 'Medicine A', dosage: '10mg', frequency: 'daily' }]
      }
    ]);
    
    mockPrescriptionService.getPrescriptionById.mockResolvedValue({
      _id: 'prescription1',
      patientId: 'patient1',
      doctorId: 'doctor1',
      medications: [{ name: 'Medicine A', dosage: '10mg', frequency: 'daily' }]
    });
    
    mockPrescriptionService.updatePrescription.mockResolvedValue({
      _id: 'prescription1',
      patientId: 'patient1',
      doctorId: 'doctor1',
      status: 'filled',
      medications: [{ name: 'Medicine A', dosage: '10mg', frequency: 'daily' }]
    });
    
    mockPrescriptionService.getMyPrescriptions.mockResolvedValue([
      {
        _id: 'prescription1',
        patientId: 'patient1',
        doctorId: 'doctor1',
        medications: [{ name: 'Medicine A', dosage: '10mg', frequency: 'daily' }]
      }
    ]);
    
    // Mock mongoose ObjectId isValid
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
    
    // Mock findOne for Patient and Doctor
    Doctor.findOne.mockResolvedValue({
      _id: 'doctor1',
      userId: 'user123'
    });
    
    Patient.findOne.mockResolvedValue({
      _id: 'patient1',
      userId: 'user123'
    });
  });
  
  describe('createPrescriptionWithDI', () => {
    test('should create a new prescription', async () => {
      // Arrange
      req.body = {
        patientId: 'patient1',
        medications: [
          { name: 'Medicine A', dosage: '10mg', frequency: 'daily' }
        ]
      };
      
      // Act
      await prescriptionController.createPrescriptionWithDI(req, res, next);
      
      // Assert
      expect(mockPrescriptionService.createPrescription).toHaveBeenCalledWith(
        expect.objectContaining({
          patientId: 'patient1',
          medications: expect.any(Array)
        }),
        req.user
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
  });
  
  describe('getPatientPrescriptionsWithDI', () => {
    test('should get prescriptions for a specific patient', async () => {
      // Arrange
      req.params.patientId = 'patient1';
      
      // Act
      await prescriptionController.getPatientPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(mockPrescriptionService.getPrescriptionsByPatient).toHaveBeenCalledWith('patient1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: expect.any(Array)
      });
    });
    
    test('should return empty array if no prescriptions found', async () => {
      // Arrange
      req.params.patientId = 'patient1';
      mockPrescriptionService.getPrescriptionsByPatient.mockResolvedValueOnce([]);
      
      // Act
      await prescriptionController.getPatientPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: []
      });
    });
  });
  
  describe('getPrescriptionByIdWithDI', () => {
    test('should get a prescription by ID', async () => {
      // Arrange
      req.params.id = 'prescription1';
      
      // Act
      await prescriptionController.getPrescriptionByIdWithDI(req, res, next);
      
      // Assert
      expect(mockPrescriptionService.getPrescriptionById).toHaveBeenCalledWith('prescription1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should handle prescription not found', async () => {
      // Arrange
      req.params.id = 'nonexistent';
      mockPrescriptionService.getPrescriptionById.mockResolvedValueOnce(null);
      
      // Act
      await prescriptionController.getPrescriptionByIdWithDI(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Prescription not found');
    });
  });
  
  describe('updatePrescriptionWithDI', () => {
    test('should update a prescription', async () => {
      // Arrange
      req.params.id = 'prescription1';
      req.body = {
        status: 'filled'
      };
      
      // Act
      await prescriptionController.updatePrescriptionWithDI(req, res, next);
      
      // Assert
      expect(mockPrescriptionService.updatePrescription).toHaveBeenCalledWith(
        'prescription1',
        expect.objectContaining({ status: 'filled' }),
        req.user
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    test('should handle prescription not found or update failed', async () => {
      // Arrange
      req.params.id = 'nonexistent';
      mockPrescriptionService.updatePrescription.mockResolvedValueOnce(null);
      
      // Act
      await prescriptionController.updatePrescriptionWithDI(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toBe('Prescription not found or could not be updated');
    });
  });
  
  describe('getMyPrescriptionsWithDI', () => {
    test('should get prescriptions for the logged-in patient', async () => {
      // Arrange
      req.user = { _id: 'user123' };
      
      // Act
      await prescriptionController.getMyPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(mockPrescriptionService.getMyPrescriptions).toHaveBeenCalledWith('user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: expect.any(Array)
      });
    });
    
    test('should handle authentication required error', async () => {
      // Arrange
      req.user = null;
      
      // Act
      await prescriptionController.getMyPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(401);
      expect(res.json).toHaveBeenCalledWith({
        success: false,
        message: 'Authentication required.'
      });
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.user = { _id: 'user123' };
      const testError = new Error('Service error');
      mockPrescriptionService.getMyPrescriptions.mockRejectedValueOnce(testError);
      
      // Act
      await prescriptionController.getMyPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(testError);
    });
    
    test('should return empty array when no prescriptions found', async () => {
      // Arrange
      req.user = { _id: 'user123' };
      mockPrescriptionService.getMyPrescriptions.mockResolvedValueOnce([]);
      
      // Act
      await prescriptionController.getMyPrescriptionsWithDI(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 0,
        data: []
      });
    });
  });
}); 