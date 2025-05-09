import express from 'express';
import request from 'supertest';
import testRoutes from '@src/routes/testRoutes.mjs';

// Mock config first to prevent process.exit(1)
jest.mock('@src/config/config.mjs', () => {
  const config = {
    ENV: 'test',
    PORT: 5000,
    MONGO_URI: 'mongodb://localhost:27017/test',
    JWT_SECRET: 'test-secret',
    JWT_EXPIRE: '30d',
    NODE_ENV: 'test',
    RATE_LIMIT_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_MAX: 100,
    FRONTEND_URL: 'http://localhost:3000',
    GOOGLE_CLIENT_ID: 'mock-google-client-id',
    GOOGLE_CLIENT_SECRET: 'mock-google-client-secret',
    GOOGLE_REDIRECT_URI: 'http://localhost:3000/auth/google/callback',
    GEMINI_API_KEY: 'mock-gemini-api-key'
  };
  
  return {
    __esModule: true,
    default: jest.fn(() => config)
  };
});

// Mock expressValidator first
jest.mock('express-validator', () => {
  const validationChain = {
    not: jest.fn().mockReturnThis(),
    isEmpty: jest.fn().mockReturnThis(),
    trim: jest.fn().mockReturnThis(),
    isEmail: jest.fn().mockReturnThis(),
    normalizeEmail: jest.fn().mockReturnThis(),
    isLength: jest.fn().mockReturnThis(),
    isStrongPassword: jest.fn().mockReturnThis(),
    isAlpha: jest.fn().mockReturnThis(),
    isDate: jest.fn().mockReturnThis(),
    isIn: jest.fn().mockReturnThis(),
    isBoolean: jest.fn().mockReturnThis(),
    isNumeric: jest.fn().mockReturnThis(),
    isArray: jest.fn().mockReturnThis(),
    isString: jest.fn().mockReturnThis(),
    matches: jest.fn().mockReturnThis(),
    optional: jest.fn().mockReturnThis(),
    withMessage: jest.fn().mockReturnThis(),
    custom: jest.fn().mockReturnThis(),
    toDate: jest.fn().mockReturnThis()
  };

  return {
    body: jest.fn().mockReturnValue(validationChain),
    param: jest.fn().mockReturnValue(validationChain),
    query: jest.fn().mockReturnValue(validationChain),
    check: jest.fn().mockReturnValue(validationChain),
    validationResult: jest.fn(() => ({
      isEmpty: jest.fn(() => true),
      array: jest.fn(() => [])
    }))
  };
});

// Mock validationMiddleware directly
jest.mock('@src/middleware/validation/validationMiddleware.mjs', () => ({
  __esModule: true,
  default: {
    validate: jest.fn(() => (req, res, next) => next()),
    rules: {
      user: {
        firstName: {},
        lastName: {},
        email: {},
        password: {},
        role: {}
      },
      doctor: {
        specialties: {},
        licenseNumber: {}
      },
      patient: {
        gender: {},
        dateOfBirth: {}
      }
    }
  }
}));

// Mock User.mjs before it gets imported by other modules
jest.mock('@src/models/User.mjs', () => {
  const mockUserSchema = {
    virtual: jest.fn().mockReturnValue({
      get: jest.fn(),
      set: jest.fn()
    })
  };
  
  return {
    __esModule: true,
    default: mockUserSchema
  };
});

// Mock AIService to prevent console warning
jest.mock('@src/services/aiService.mjs', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn().mockResolvedValue(true),
    generateAnalysis: jest.fn().mockResolvedValue({ summary: 'Mock AI Analysis' }),
    generateSummary: jest.fn().mockResolvedValue('Mock AI Summary'),
    testMode: true
  }
}));

// Mock tokenBlacklistService
jest.mock('@src/services/tokenBlacklistService.mjs', () => ({
  __esModule: true,
  default: {
    blacklistToken: jest.fn().mockResolvedValue(true),
    isBlacklisted: jest.fn().mockResolvedValue(false)
  }
}));

// Mock authMiddleware directly
jest.mock('@src/middleware/auth/authMiddleware.mjs', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn((req, res, next) => {
      req.user = { _id: 'user123', role: 'admin' };
      next();
    }),
    restrictTo: jest.fn((...roles) => (req, res, next) => {
      next();
    }),
    protect: jest.fn((req, res, next) => {
      req.user = { _id: 'user123', role: 'admin' };
      next();
    })
  }
}));

// Mock mongoose and models
jest.mock('mongoose', () => {
  const mockPatient = {
    findOne: jest.fn(),
    create: jest.fn()
  };
  
  const mockDoctor = {
    findOne: jest.fn(),
    create: jest.fn()
  };
  
  const mockTimeSlot = {
    findOne: jest.fn(),
    create: jest.fn()
  };
  
  const mockAppointment = {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  };
  
  // Create a proper mockObjectId constructor that handles 'new'
  function MockObjectId(val) {
    if (!(this instanceof MockObjectId)) {
      return new MockObjectId(val);
    }
    this.value = val || 'mock-object-id';
    this.toString = () => String(this.value);
    this.valueOf = () => String(this.value);
  }
  // Add isValid as a static method
  MockObjectId.isValid = jest.fn(() => true);
  
  // Mock Schema constructor
  function MockSchema(definition, options) {
    this.definition = definition;
    this.options = options;
    this.virtuals = {};
    
    this.virtual = jest.fn((path) => {
      if (!this.virtuals[path]) {
        this.virtuals[path] = {
          get: jest.fn(fn => {
            this.virtuals[path].getter = fn;
            return this.virtuals[path];
          }),
          set: jest.fn(fn => {
            this.virtuals[path].setter = fn;
            return this.virtuals[path]; 
          })
        };
      }
      return this.virtuals[path];
    });
    
    this.pre = jest.fn().mockReturnThis();
    this.post = jest.fn().mockReturnThis();
    this.method = jest.fn().mockReturnThis();
    this.static = jest.fn().mockReturnThis();
    this.index = jest.fn().mockReturnThis();
  }
  
  // Add Schema.Types
  MockSchema.Types = {
    ObjectId: String,
    String: String,
    Number: Number,
    Boolean: Boolean,
    Date: Date,
    Buffer: Buffer,
    Mixed: Object,
    Array: Array
  };
  
  return {
    model: jest.fn((modelName) => {
      switch (modelName) {
        case 'Patient':
          return mockPatient;
        case 'Doctor':
          return mockDoctor;
        case 'TimeSlot':
          return mockTimeSlot;
        case 'Appointment':
          return mockAppointment;
        default:
          return {};
      }
    }),
    Schema: MockSchema,
    Types: {
      ObjectId: MockObjectId
    }
  };
});

// Mock Models
const mockAppointment = require('mongoose').model('Appointment');
const mockPatient = require('mongoose').model('Patient');
const mockDoctor = require('mongoose').model('Doctor');
const mockTimeSlot = require('mongoose').model('TimeSlot');

describe('Test Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/test', testRoutes);
    
    // Reset all mocks before each test
    jest.clearAllMocks();
    
    // Configure mock behavior for test data creation
    mockPatient.findOne.mockResolvedValue(null);
    mockPatient.create.mockResolvedValue({ _id: 'patient123', gender: 'male', dateOfBirth: new Date('1990-01-01') });
    
    mockDoctor.findOne.mockResolvedValue(null);
    mockDoctor.create.mockResolvedValue({ _id: 'doctor123', specialties: ['General'], licenseNumber: 'TEST12345' });
    
    mockTimeSlot.findOne.mockResolvedValue(null);
    mockTimeSlot.create.mockResolvedValue({ 
      _id: 'timeslot123', 
      doctorId: 'doctor123', 
      date: new Date(), 
      startTime: '10:00', 
      endTime: '10:30', 
      status: 'available' 
    });
    
    mockAppointment.findOne.mockResolvedValue(null);
    mockAppointment.create.mockResolvedValue({ 
      _id: 'appointment123', 
      patientId: 'patient123', 
      doctorId: 'doctor123', 
      timeSlotId: 'timeslot123', 
      date: new Date(), 
      startTime: '10:00',
      endTime: '10:30', 
      type: 'virtual', 
      status: 'scheduled', 
      reasonForVisit: 'Testing assessment functionality' 
    });
    
    mockAppointment.findById.mockResolvedValue({ 
      _id: 'appointment123', 
      patientId: 'patient123', 
      doctorId: 'doctor123', 
      timeSlotId: 'timeslot123', 
      date: new Date(), 
      startTime: '10:00',
      endTime: '10:30', 
      type: 'virtual', 
      status: 'scheduled', 
      reasonForVisit: 'Testing assessment functionality',
      toObject: jest.fn(() => ({
        _id: 'appointment123', 
        patientId: 'patient123', 
        doctorId: 'doctor123', 
        timeSlotId: 'timeslot123', 
        date: new Date(), 
        startTime: '10:00',
        endTime: '10:30', 
        type: 'virtual', 
        status: 'scheduled', 
        reasonForVisit: 'Testing assessment functionality'
      }))
    });
  });

  // Test for POST /create-test-data
  describe('POST /create-test-data', () => {
    test('should create test data and return 201', async () => {
      const response = await request(app)
        .post('/test/create-test-data')
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test data created successfully');
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data).toHaveProperty('doctor');
      expect(response.body.data).toHaveProperty('timeSlot');
      expect(response.body.data).toHaveProperty('appointment');
      
      expect(mockPatient.create).toHaveBeenCalled();
      expect(mockDoctor.create).toHaveBeenCalled();
      expect(mockTimeSlot.create).toHaveBeenCalled();
      expect(mockAppointment.create).toHaveBeenCalled();
    }, 10000);

    test('should use existing data if available and return 201', async () => {
      // Set up mocks to return existing data
      mockPatient.findOne.mockResolvedValueOnce({ _id: 'patient123' });
      mockDoctor.findOne.mockResolvedValueOnce({ _id: 'doctor123' });
      mockTimeSlot.findOne.mockResolvedValueOnce({ _id: 'timeslot123', status: 'available' });
      
      const response = await request(app)
        .post('/test/create-test-data')
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test data created successfully');
      
      // Should not create new patient, doctor, or timeslot
      expect(mockPatient.create).not.toHaveBeenCalled();
      expect(mockDoctor.create).not.toHaveBeenCalled();
      expect(mockTimeSlot.create).not.toHaveBeenCalled();
      
      // Should still create a new appointment
      expect(mockAppointment.create).toHaveBeenCalled();
    }, 10000);

    test('should return 500 when database error occurs', async () => {
      // Mock error during creation
      mockPatient.findOne.mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .post('/test/create-test-data')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create test data');
    }, 10000);
  });

  // Test for GET /get-test-data
  describe('GET /get-test-data', () => {
    test('should return test data and 200', async () => {
      // Set up mocks to return test data
      mockPatient.findOne.mockResolvedValueOnce({ 
        _id: { toString: () => 'patient123' }, 
        gender: 'male', 
        dateOfBirth: new Date('1990-01-01') 
      });
      
      mockDoctor.findOne.mockResolvedValueOnce({ 
        _id: { toString: () => 'doctor123' }, 
        specialties: ['General'], 
        licenseNumber: 'TEST12345' 
      });
      
      mockTimeSlot.findOne.mockResolvedValueOnce({ 
        _id: { toString: () => 'timeslot123' }, 
        date: new Date(), 
        startTime: '10:00', 
        endTime: '10:30' 
      });
      
      mockAppointment.findOne.mockResolvedValueOnce({ 
        _id: { toString: () => 'appointment123' }, 
        date: new Date(), 
        status: 'scheduled', 
        type: 'virtual', 
        reasonForVisit: 'Testing' 
      });
      
      const response = await request(app)
        .get('/test/get-test-data')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Test data retrieved successfully');
      expect(response.body.data).toHaveProperty('patient');
      expect(response.body.data).toHaveProperty('doctor');
      expect(response.body.data).toHaveProperty('timeSlot');
      expect(response.body.data).toHaveProperty('appointment');
    }, 10000);

    test('should return 404 when test data not found', async () => {
      // Mock no data found
      mockPatient.findOne.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/test/get-test-data')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Test data not found');
    }, 10000);

    test('should return 500 when database error occurs', async () => {
      // Mock error during retrieval
      mockPatient.findOne.mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .get('/test/get-test-data')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve test data');
    }, 10000);
  });

  describe('GET /appointments/:id', () => {
    test('should return appointment by ID and 200', async () => {
      const appointmentId = 'appointment123';
      
      const response = await request(app)
        .get(`/test/appointments/${appointmentId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Appointment retrieved successfully');
      expect(response.body.data).toHaveProperty('_id', 'appointment123');
      
      const mongoose = require('mongoose');
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(appointmentId);
      expect(mockAppointment.findById).toHaveBeenCalledWith(appointmentId);
    }, 10000);

    test('should return 400 for invalid appointment ID', async () => {
      const mongoose = require('mongoose');
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      const invalidId = 'invalid-id';
      const response = await request(app)
        .get(`/test/appointments/${invalidId}`)
        .expect('Content-Type', /json/)
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Invalid appointment ID');
      expect(response.body.data).toBeNull();
      
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(invalidId);
      expect(mockAppointment.findById).not.toHaveBeenCalled();
    }, 10000);

    test('should return 404 when appointment not found', async () => {
      const appointmentId = 'nonexistent';
      mockAppointment.findById.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get(`/test/appointments/${appointmentId}`)
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Appointment not found');
      expect(response.body.data).toBeNull();
    }, 10000);

    test('should return 500 when database error occurs', async () => {
      const appointmentId = 'error-id';
      mockAppointment.findById.mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .get(`/test/appointments/${appointmentId}`)
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to retrieve appointment');
    }, 10000);
  });

  describe('POST /create-fresh-appointment', () => {
    test('should create a fresh appointment and return 201', async () => {
      // Set up mocks to find patient and doctor
      mockPatient.findOne.mockResolvedValueOnce({ _id: 'patient123' });
      mockDoctor.findOne.mockResolvedValueOnce({ _id: 'doctor123' });
      
      const response = await request(app)
        .post('/test/create-fresh-appointment')
        .expect('Content-Type', /json/)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Fresh appointment created successfully');
      expect(response.body.data).toHaveProperty('appointmentId', 'appointment123');
      expect(response.body.data).toHaveProperty('patientId', 'patient123');
      expect(response.body.data).toHaveProperty('doctorId', 'doctor123');
      expect(response.body.data).toHaveProperty('timeSlotId', 'timeslot123');
      
      expect(mockTimeSlot.create).toHaveBeenCalled();
      expect(mockAppointment.create).toHaveBeenCalled();
    }, 10000);

    test('should return 404 when patient or doctor not found', async () => {
      // Mock patient not found
      mockPatient.findOne.mockResolvedValueOnce(null);
      mockDoctor.findOne.mockResolvedValueOnce({ _id: 'doctor123' });
      
      const response = await request(app)
        .post('/test/create-fresh-appointment')
        .expect('Content-Type', /json/)
        .expect(404);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Patient or doctor not found');
      expect(response.body.data).toBeNull();
    }, 10000);

    test('should return 500 when database error occurs', async () => {
      // Mock error during creation
      mockPatient.findOne.mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .post('/test/create-fresh-appointment')
        .expect('Content-Type', /json/)
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toBe('Failed to create fresh appointment');
    }, 10000);
  });
});