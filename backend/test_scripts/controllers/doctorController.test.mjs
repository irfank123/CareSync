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
const mockDoctorService = {
  getAll: jest.fn(),
  getById: jest.fn(),
  create: jest.fn(),
  update: jest.fn(),
  delete: jest.fn(),
  getByUserId: jest.fn(),
  updateByUserId: jest.fn(),
  getDoctorUserId: jest.fn()
};

const mockUserService = {
  getById: jest.fn(),
  updateById: jest.fn()
};

const mockAvailabilityService = {
  getDoctorAvailability: jest.fn()
};

// Mock utils
jest.mock('../../src/utils/controllerHelper.mjs', () => ({
  __esModule: true,
  withServices: jest.fn((fn, dependencies) => {
    return (req, res, next) => {
      const services = {
        doctorService: mockDoctorService,
        userService: mockUserService,
        availabilityService: mockAvailabilityService
      };
      return fn(req, res, next, services);
    };
  }),
  withServicesForController: jest.fn((controller, dependencies) => {
    const enhancedController = {};
    Object.keys(controller).forEach(methodName => {
      enhancedController[methodName] = (req, res, next) => {
        const services = {
          doctorService: mockDoctorService,
          userService: mockUserService,
          availabilityService: mockAvailabilityService
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
  Doctor: {
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
import * as doctorController from '../../src/controllers/doctorController.mjs';
import { Doctor, User } from '../../src/models/index.mjs';
import { AppError } from '../../src/utils/errorHandler.mjs';

describe('Doctor Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {
        id: 'doctor123'
      },
      query: {},
      body: {
        userId: 'user123',
        specialties: ['Cardiology', 'Internal Medicine'],
        licenseNumber: 'MD12345',
        appointmentFee: 100,
        education: [
          { degree: 'MD', institution: 'Medical University', year: 2010 }
        ],
        acceptingNewPatients: true,
        availabilitySchedule: {}
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
    mockDoctorService.getAll.mockResolvedValue({
      data: [
        { _id: 'doctor123', name: 'Dr. Smith', specialties: ['Cardiology'] },
        { _id: 'doctor456', name: 'Dr. Johnson', specialties: ['Pediatrics'] }
      ],
      total: 2,
      totalPages: 1,
      currentPage: 1
    });
    
    mockDoctorService.getById.mockResolvedValue({
      _id: 'doctor123',
      name: 'Dr. Smith',
      specialties: ['Cardiology'],
      userId: 'user123'
    });
    
    mockDoctorService.create.mockResolvedValue({
      _id: 'doctor123',
      name: 'Dr. Smith',
      specialties: ['Cardiology'],
      userId: 'user123'
    });
    
    mockDoctorService.update.mockResolvedValue({
      _id: 'doctor123',
      name: 'Dr. Smith',
      specialties: ['Cardiology', 'Internal Medicine'],
      userId: 'user123'
    });
    
    mockDoctorService.delete.mockResolvedValue(true);
    
    mockDoctorService.getByUserId.mockResolvedValue({
      _id: 'doctor123',
      name: 'Dr. Smith',
      specialties: ['Cardiology'],
      userId: 'user123'
    });
    
    mockDoctorService.updateByUserId.mockResolvedValue({
      _id: 'doctor123',
      name: 'Dr. Smith',
      specialties: ['Cardiology', 'Internal Medicine'],
      userId: 'user123'
    });
    
    mockDoctorService.getDoctorUserId.mockResolvedValue('user123');
    
    mockAvailabilityService.getDoctorAvailability.mockResolvedValue([
      { date: '2023-07-01', slots: [{ start: '09:00', end: '10:00' }] }
    ]);
  });

  describe('getDoctors', () => {
    it('should get all doctors successfully (as admin)', async () => {
      req.userRole = 'admin';
      req.clinicId = 'clinic123';
      
      await doctorController.getDoctorsWithDI(req, res, next);
      
      expect(mockDoctorService.getAll).toHaveBeenCalledWith({});
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
    
    it('should filter doctors by clinic for non-admin roles', async () => {
      req.userRole = 'staff';
      req.clinicId = 'clinic123';
      
      await doctorController.getDoctorsWithDI(req, res, next);
      
      expect(mockDoctorService.getAll).toHaveBeenCalledWith({ clinicId: 'clinic123' });
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
  
  describe('getDoctor', () => {
    it('should get a doctor by ID successfully', async () => {
      await doctorController.getDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.getDoctorUserId).toHaveBeenCalledWith('doctor123');
      expect(mockDoctorService.getById).toHaveBeenCalledWith('doctor123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'doctor123'
        })
      });
    });
    
    it('should handle doctor not found', async () => {
      mockDoctorService.getById.mockResolvedValueOnce(null);
      
      await doctorController.getDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should identify self-access', async () => {
      req.user._id = 'user123'; // Same as the doctor's userId
      req.user.toString = () => 'user123';
      
      await doctorController.getDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.getDoctorUserId).toHaveBeenCalledWith('doctor123');
      expect(mockDoctorService.getById).toHaveBeenCalledWith('doctor123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
  
  describe('createDoctor', () => {
    it('should create a doctor successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await doctorController.createDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.create).toHaveBeenCalledWith(req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'doctor123'
        })
      });
    });
    
    it('should create a doctor successfully (as staff)', async () => {
      req.userRole = 'staff';
      
      await doctorController.createDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.create).toHaveBeenCalledWith(req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should reject creation for unauthorized roles', async () => {
      req.userRole = 'patient';
      
      await doctorController.createDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockDoctorService.create).not.toHaveBeenCalled();
    });
  });
  
  describe('updateDoctor', () => {
    it('should update a doctor successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await doctorController.updateDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.update).toHaveBeenCalledWith('doctor123', req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'doctor123'
        })
      });
    });
    
    it('should update a doctor successfully (as staff)', async () => {
      req.userRole = 'staff';
      
      await doctorController.updateDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.update).toHaveBeenCalledWith('doctor123', req.body, 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should update a doctor successfully (as self)', async () => {
      req.userRole = 'doctor';
      req.user._id = 'user123'; // Same as the doctor's userId
      req.user.toString = () => 'user123';
      
      await doctorController.updateDoctorWithDI(req, res, next);
      
      // Should filter the body since it's self-update
      const filteredBody = {
        specialties: ['Cardiology', 'Internal Medicine'],
        education: [{ degree: 'MD', institution: 'Medical University', year: 2010 }],
        acceptingNewPatients: true,
        availabilitySchedule: {}
      };
      
      expect(mockDoctorService.update).toHaveBeenCalledWith('doctor123', filteredBody, 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should reject update for unauthorized roles', async () => {
      req.userRole = 'patient';
      req.user._id = 'user456';  // Different from doctor's userId
      req.user.toString = () => 'user456';
      
      await doctorController.updateDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockDoctorService.update).not.toHaveBeenCalled();
    });
    
    it('should handle doctor not found', async () => {
      mockDoctorService.update.mockResolvedValueOnce(null);
      
      await doctorController.updateDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('deleteDoctor', () => {
    it('should delete a doctor successfully (as admin)', async () => {
      req.userRole = 'admin';
      
      await doctorController.deleteDoctorWithDI(req, res, next);
      
      expect(mockDoctorService.delete).toHaveBeenCalledWith('doctor123', 'admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Doctor deleted successfully'
      });
    });
    
    it('should reject deletion for non-admin roles', async () => {
      req.userRole = 'staff';
      
      await doctorController.deleteDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockDoctorService.delete).not.toHaveBeenCalled();
    });
    
    it('should handle doctor not found', async () => {
      mockDoctorService.delete.mockResolvedValueOnce(false);
      
      await doctorController.deleteDoctorWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('getMyProfile', () => {
    it('should get own profile successfully (as doctor)', async () => {
      req.userRole = 'doctor';
      
      await doctorController.getMyProfileWithDI(req, res, next);
      
      expect(mockDoctorService.getByUserId).toHaveBeenCalledWith('admin123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'doctor123'
        })
      });
    });
    
    it('should reject access for non-doctor roles', async () => {
      req.userRole = 'staff';
      
      await doctorController.getMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockDoctorService.getByUserId).not.toHaveBeenCalled();
    });
    
    it('should handle profile not found', async () => {
      req.userRole = 'doctor';
      mockDoctorService.getByUserId.mockResolvedValueOnce(null);
      
      await doctorController.getMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('updateMyProfile', () => {
    it('should update own profile successfully (as doctor)', async () => {
      req.userRole = 'doctor';
      req.body = {
        specialties: ['Cardiology', 'Neurology'],
        education: [{ degree: 'PhD', institution: 'Medical University', year: 2015 }],
        acceptingNewPatients: false,
        licenseNumber: 'MD54321', // Should be filtered out
        appointmentFee: 150 // Should be filtered out
      };
      
      await doctorController.updateMyProfileWithDI(req, res, next);
      
      // Should only include allowed fields
      const filteredBody = {
        specialties: ['Cardiology', 'Neurology'],
        education: [{ degree: 'PhD', institution: 'Medical University', year: 2015 }],
        acceptingNewPatients: false
      };
      
      expect(mockDoctorService.updateByUserId).toHaveBeenCalledWith('admin123', expect.objectContaining({
        specialties: ['Cardiology', 'Neurology'],
        education: expect.any(Array),
        acceptingNewPatients: false
      }));
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.objectContaining({
          _id: 'doctor123'
        })
      });
    });
    
    it('should reject access for non-doctor roles', async () => {
      req.userRole = 'staff';
      
      await doctorController.updateMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(mockDoctorService.updateByUserId).not.toHaveBeenCalled();
    });
    
    it('should handle profile not found', async () => {
      req.userRole = 'doctor';
      mockDoctorService.updateByUserId.mockResolvedValueOnce(null);
      
      await doctorController.updateMyProfileWithDI(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('getDoctorAvailability', () => {
    it('should get doctor availability successfully', async () => {
      req.query = {
        startDate: '2023-07-01',
        endDate: '2023-07-07'
      };
      
      await doctorController.getDoctorAvailabilityWithDI(req, res, next);
      
      expect(mockAvailabilityService.getDoctorAvailability).toHaveBeenCalledWith(
        'doctor123',
        expect.any(Date),
        expect.any(Date)
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Array)
      });
    });
    
    it('should handle missing date params', async () => {
      req.query = {}; // No date params
      
      await doctorController.getDoctorAvailabilityWithDI(req, res, next);
      
      expect(mockAvailabilityService.getDoctorAvailability).toHaveBeenCalledWith(
        'doctor123',
        undefined,
        undefined
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
  
  describe('Validation', () => {
    it('should expose validation rules', () => {
      expect(doctorController.createDoctorValidation).toBeDefined();
      expect(Array.isArray(doctorController.createDoctorValidation)).toBeTruthy();
      
      expect(doctorController.updateDoctorValidation).toBeDefined();
      expect(Array.isArray(doctorController.updateDoctorValidation)).toBeTruthy();
    });
  });
}); 