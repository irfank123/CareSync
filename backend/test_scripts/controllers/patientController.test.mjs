import mongooseActual from 'mongoose';

// --- Mock Dependencies ---

// Mock express-validator
jest.mock('express-validator', () => {
  // Create chainable validator functions
  const createChainableValidator = () => {
    const chain = {};
    const methods = [
      'isIn', 'custom', 'if', 'equals', 'not', 'isEmpty', 
      'isString', 'isBoolean', 'isMongoId', 'optional',
      'withMessage', 'isISO8601', 'toDate', 'matches',
      'isEmail', 'normalizeEmail', 'isLength', 'exists',
      'isMobilePhone', 'trim', 'notEmpty', 'isArray', 'isNumeric'
    ];
    
    methods.forEach(method => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    
    return chain;
  };
  
  return {
    check: jest.fn().mockImplementation(() => createChainableValidator()),
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
    },
    model: jest.fn().mockReturnValue({})
  };
});

// Create mock services before mocking the modules
const mockPatientService = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getByUserId: jest.fn(),
  updateByUserId: jest.fn(),
  getPatientUserId: jest.fn(),
  getMedicalHistory: jest.fn()
};

// Mock utils
jest.mock('../../src/utils/controllerHelper.mjs', () => ({
  __esModule: true,
  withServices: jest.fn((fn, dependencies) => {
    return (req, res, next) => {
      const services = {
        patientService: mockPatientService
      };
      return fn(req, res, next, services);
    };
  }),
  withServicesForController: jest.fn((controller, dependencies) => {
    const enhancedController = {};
    Object.keys(controller).forEach(methodName => {
      enhancedController[methodName] = (req, res, next) => {
        const services = {
          patientService: mockPatientService
        };
        return controller[methodName](req, res, next, services);
      };
    });
    return enhancedController;
  })
}));

// Mock error handler module
jest.mock('../../src/utils/errorHandler.mjs', () => {
  // Create a mock AppError class
  const mockAppError = jest.fn().mockImplementation((message, statusCode) => {
    return {
      message,
      statusCode,
      status: `${statusCode}`.startsWith('4') ? 'fail' : 'error',
      isOperational: true
    };
  });
  
  return {
    __esModule: true,
    AppError: mockAppError,
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
    findById: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn()
  },
  User: {
    findById: jest.fn(),
    findOne: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

// Import after mocking
import { validationResult, check } from 'express-validator';
import * as patientController from '../../src/controllers/patientController.mjs';
import { Patient, User } from '../../src/models/index.mjs';
import { AppError } from '../../src/utils/errorHandler.mjs';

describe('Patient Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {
        id: 'patient123'
      },
      query: {},
      body: {
        userId: 'user123',
        dateOfBirth: '1990-01-01',
        gender: 'male',
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '555-555-5555'
        },
        allergies: ['Penicillin'],
        currentMedications: ['Aspirin'],
        preferredCommunication: 'email'
      },
      user: { 
        _id: 'admin123',
        toString: () => 'admin123'
      },
      userRole: 'admin',
      clinicId: 'clinic123'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Setup default mocks
    mockPatientService.getAll.mockResolvedValue({
      data: [
        { _id: 'patient123', firstName: 'John', lastName: 'Doe', dateOfBirth: '1990-01-01' },
        { _id: 'patient456', firstName: 'Jane', lastName: 'Smith', dateOfBirth: '1985-05-15' }
      ],
      total: 2,
      totalPages: 1,
      currentPage: 1
    });
    
    mockPatientService.getById.mockResolvedValue({
      _id: 'patient123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      userId: 'user123'
    });
    
    mockPatientService.create.mockResolvedValue({
      _id: 'patient123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      userId: 'user123'
    });
    
    mockPatientService.update.mockResolvedValue({
      _id: 'patient123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      userId: 'user123',
      address: {
        street: '123 Main St',
        city: 'Anytown',
        state: 'CA',
        zipCode: '12345'
      }
    });
    
    mockPatientService.delete.mockResolvedValue(true);
    
    mockPatientService.getByUserId.mockResolvedValue({
      _id: 'patient123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      userId: 'user123'
    });
    
    mockPatientService.updateByUserId.mockResolvedValue({
      _id: 'patient123',
      firstName: 'John',
      lastName: 'Doe',
      dateOfBirth: '1990-01-01',
      userId: 'user123',
      allergies: ['Penicillin', 'Peanuts']
    });
    
    mockPatientService.getPatientUserId.mockResolvedValue('user123');
    
    mockPatientService.getMedicalHistory.mockResolvedValue([
      { date: '2023-01-01', type: 'Appointment', description: 'Annual checkup' }
    ]);
  });

  describe('getPatients', () => {
    it('should get all patients successfully (as admin)', async () => {
      req.userRole = 'admin';
      req.clinicId = 'clinic123';
      
      await patientController.getPatientsWithDI(req, res, next);
      
      expect(mockPatientService.getAll).toHaveBeenCalledWith({});
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
    
    it('should filter patients by clinic for staff role', async () => {
      req.userRole = 'staff';
      req.clinicId = 'clinic123';
      
      await patientController.getPatientsWithDI(req, res, next);
      
      expect(mockPatientService.getAll).toHaveBeenCalledWith({ clinicId: 'clinic123' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should filter patients by doctor for doctor role', async () => {
      req.userRole = 'doctor';
      req.user._id = 'doctor123';
      
      await patientController.getPatientsWithDI(req, res, next);
      
      expect(mockPatientService.getAll).toHaveBeenCalledWith({ filterByDoctorUserId: 'doctor123' });
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject unauthorized access', async () => {
      req.userRole = 'patient';
      
      await patientController.getPatientsWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.getAll).not.toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      mockPatientService.getAll.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.getPatientsWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('getPatient', () => {
    it('should get a patient by ID successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(mockPatientService.getPatientUserId).toHaveBeenCalledWith('patient123');
      expect(mockPatientService.getById).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'patient123'
        })
      });
    });

    it('should get a patient by ID successfully (as doctor)', async () => {
      req.userRole = 'doctor';
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(mockPatientService.getById).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should get a patient by ID successfully (as staff)', async () => {
      req.userRole = 'staff';
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(mockPatientService.getById).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle patient not found', async () => {
      mockPatientService.getById.mockResolvedValueOnce(null);
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should allow self-access', async () => {
      req.userRole = 'patient';
      req.user._id = 'user123'; // Same as the patient's userId
      req.user.toString = () => 'user123';
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(mockPatientService.getPatientUserId).toHaveBeenCalledWith('patient123');
      expect(mockPatientService.getById).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reject unauthorized access', async () => {
      req.userRole = 'patient';
      req.user._id = 'user456'; // Different from patient's userId
      req.user.toString = () => 'user456';
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    it('should handle errors', async () => {
      mockPatientService.getPatientUserId.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.getPatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('createPatient', () => {
    it('should create a patient successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await patientController.createPatientWithDI(req, res, next);
      
      expect(mockPatientService.create).toHaveBeenCalledWith(req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'patient123'
        })
      });
    });
    
    it('should create a patient successfully (as staff)', async () => {
      req.userRole = 'staff';
      
      await patientController.createPatientWithDI(req, res, next);
      
      expect(mockPatientService.create).toHaveBeenCalledWith(req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should reject creation for unauthorized roles', async () => {
      req.userRole = 'patient';
      
      await patientController.createPatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.create).not.toHaveBeenCalled();
    });

    it('should handle validation errors', async () => {
      // Mock validation errors
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ param: 'gender', msg: 'Invalid gender' }])
      });
      
      await patientController.createPatientWithDI(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPatientService.create).not.toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      mockPatientService.create.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.createPatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('updatePatient', () => {
    it('should update a patient successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(mockPatientService.update).toHaveBeenCalledWith('patient123', req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'patient123'
        })
      });
    });
    
    it('should update a patient successfully (as staff)', async () => {
      req.userRole = 'staff';
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(mockPatientService.update).toHaveBeenCalledWith('patient123', req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should update a patient successfully (as self)', async () => {
      req.userRole = 'patient';
      req.user._id = 'user123'; // Same as the patient's userId
      req.user.toString = () => 'user123';
      
      await patientController.updatePatientWithDI(req, res, next);
      
      // Should filter the body since it's self-update
      const expectedFilteredBody = {
        address: {
          street: '123 Main St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        },
        emergencyContact: {
          name: 'Emergency Contact',
          relationship: 'Spouse',
          phone: '555-555-5555'
        },
        allergies: ['Penicillin'],
        currentMedications: ['Aspirin'],
        preferredCommunication: 'email'
      };
      
      expect(mockPatientService.update).toHaveBeenCalledWith('patient123', expectedFilteredBody, 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle validation errors', async () => {
      // Mock validation errors
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ param: 'dateOfBirth', msg: 'Invalid date format' }])
      });
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPatientService.update).not.toHaveBeenCalled();
    });
    
    it('should handle patient not found', async () => {
      mockPatientService.update.mockResolvedValueOnce(null);
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should reject update for unauthorized roles', async () => {
      req.userRole = 'doctor';
      req.user._id = 'user456';  // Different from patient's userId
      req.user.toString = () => 'user456';
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.update).not.toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      mockPatientService.getPatientUserId.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.updatePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });
  
  describe('deletePatient', () => {
    it('should delete a patient successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await patientController.deletePatientWithDI(req, res, next);
      
      expect(mockPatientService.delete).toHaveBeenCalledWith('patient123', 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Patient deleted successfully'
      });
    });
    
    it('should reject deletion for non-admin roles', async () => {
      req.userRole = 'staff';
      
      await patientController.deletePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.delete).not.toHaveBeenCalled();
    });
    
    it('should handle patient not found', async () => {
      mockPatientService.delete.mockResolvedValueOnce(false);
      
      await patientController.deletePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should handle errors', async () => {
      mockPatientService.delete.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.deletePatientWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('getMyProfile', () => {
    it('should get patient profile (as self)', async () => {
      req.userRole = 'patient';
      
      await patientController.getMyProfileWithDI(req, res, next);
      
      expect(mockPatientService.getByUserId).toHaveBeenCalledWith('admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'patient123'
        })
      });
    });
    
    it('should reject access for non-patient roles', async () => {
      req.userRole = 'admin';
      
      await patientController.getMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.getByUserId).not.toHaveBeenCalled();
    });
    
    it('should handle profile not found', async () => {
      req.userRole = 'patient';
      mockPatientService.getByUserId.mockResolvedValueOnce(null);
      
      await patientController.getMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should handle errors', async () => {
      req.userRole = 'patient';
      mockPatientService.getByUserId.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.getMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  describe('updateMyProfile', () => {
    it('should update patient profile (as self)', async () => {
      req.userRole = 'patient';
      req.body = {
        allergies: ['Penicillin', 'Peanuts'],
        currentMedications: ['Aspirin'],
        address: {
          street: '123 Updated St',
          city: 'Anytown',
          state: 'CA',
          zipCode: '12345'
        }
      };
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      expect(mockPatientService.updateByUserId).toHaveBeenCalledWith('admin123', req.body);
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'patient123'
        })
      });
    });
    
    it('should reject access for non-patient roles', async () => {
      req.userRole = 'admin';
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.updateByUserId).not.toHaveBeenCalled();
    });
    
    it('should handle validation errors', async () => {
      req.userRole = 'patient';
      
      // Mock validation errors
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ param: 'allergies', msg: 'Invalid format' }])
      });
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(mockPatientService.updateByUserId).not.toHaveBeenCalled();
    });
    
    it('should handle profile not found', async () => {
      req.userRole = 'patient';
      mockPatientService.updateByUserId.mockResolvedValueOnce(null);
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should handle errors', async () => {
      req.userRole = 'patient';
      mockPatientService.updateByUserId.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
    
    it('should filter fields correctly', async () => {
      req.userRole = 'patient';
      req.body = {
        allergies: ['Penicillin'],
        dateOfBirth: '1985-01-01', // Should be filtered out
        gender: 'female',         // Should be filtered out
        address: {
          street: '123 Main St'
        },
        emergencyContact: {
          name: 'John Smith'
        }
      };
      
      await patientController.updateMyProfileWithDI(req, res, next);
      
      // Check that only allowed fields are passed to the service
      const expectedFilteredBody = {
        allergies: ['Penicillin'],
        address: {
          street: '123 Main St'
        },
        emergencyContact: {
          name: 'John Smith'
        }
      };
      
      expect(mockPatientService.updateByUserId).toHaveBeenCalledWith('admin123', expectedFilteredBody);
    });
  });

  describe('getMedicalHistory', () => {
    it('should get medical history for a patient (as admin)', async () => {
      req.userRole = 'admin';
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(mockPatientService.getMedicalHistory).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
    
    it('should get medical history for a patient (as doctor)', async () => {
      req.userRole = 'doctor';
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(mockPatientService.getMedicalHistory).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should get medical history for a patient (as staff)', async () => {
      req.userRole = 'staff';
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(mockPatientService.getMedicalHistory).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should allow self-access to medical history', async () => {
      req.userRole = 'patient';
      req.user._id = 'user123'; // Same as the patient's userId
      req.user.toString = () => 'user123';
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(mockPatientService.getPatientUserId).toHaveBeenCalledWith('patient123');
      expect(mockPatientService.getMedicalHistory).toHaveBeenCalledWith('patient123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should reject unauthorized access to medical history', async () => {
      req.userRole = 'patient';
      req.user._id = 'user456'; // Different from patient's userId
      req.user.toString = () => 'user456';
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockPatientService.getMedicalHistory).not.toHaveBeenCalled();
    });
    
    it('should handle errors', async () => {
      mockPatientService.getPatientUserId.mockRejectedValueOnce(new Error('Database error'));
      
      await patientController.getMedicalHistoryWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
    });
  });

  // Test validation rules export
  describe('Validation Rules', () => {
    it('should export createPatientValidation', () => {
      expect(patientController.createPatientValidation).toBeDefined();
      expect(patientController.createPatientValidation.length).toBeGreaterThan(0);
    });
    
    it('should export updatePatientValidation', () => {
      expect(patientController.updatePatientValidation).toBeDefined();
      expect(patientController.updatePatientValidation.length).toBeGreaterThan(0);
    });
  });
}); 