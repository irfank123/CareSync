import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import doctorRoutes from '@src/routes/doctorRoutes.mjs';

// Mock dependencies
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  const mockObjectId = jest.fn(val => ({ toString: () => String(val) })); // A mock constructor
  mockObjectId.isValid = jest.fn().mockReturnValue(true); // Static method on the mock constructor

  return {
    ...originalMongoose, // Spread original mongoose to keep other parts intact
    __esModule: true,    // Hint for ES Module interop
    default: {
      ...originalMongoose, // Spread original mongoose for default export properties
      Types: {
        ...originalMongoose.Types,
        ObjectId: mockObjectId // Replace ObjectId with our mock that has a static isValid
      }
    },
    // Also provide Types directly if it might be accessed like mongoose.Types directly
    Types: {
      ...originalMongoose.Types,
      ObjectId: mockObjectId
    }
  };
});

jest.mock('@src/controllers/doctorController.mjs', () => ({
  getDoctorsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getDoctorWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1' } })),
  createDoctorWithDI: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: '1' } })),
  updateDoctorWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1', updated: true } })),
  deleteDoctorWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Doctor deleted' })),
  getMyProfileWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1' } })),
  updateMyProfileWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1', updated: true } })),
  getDoctorAvailabilityWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { availability: [] } })),
  createDoctorValidation: {},
  updateDoctorValidation: {}
}));

jest.mock('@src/middleware/index.mjs', () => ({
  authMiddleware: {
    authenticate: jest.fn((req, res, next) => {
      req.user = { _id: 'user123' };
      req.userRole = 'doctor';
      next();
    }),
    restrictTo: jest.fn((...roles) => (req, res, next) => {
      if (roles.includes(req.userRole)) {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Forbidden' });
      }
    })
  },
  validationMiddleware: {
    validate: jest.fn(() => (req, res, next) => next()),
    rules: {
      user: { userId: {} },
      doctor: { 
        specialties: { optional: () => ({}) },
        licenseNumber: { optional: () => ({}) },
        appointmentFee: { optional: () => ({}) }
      }
    }
  },
  permissionMiddleware: {
    isOwnerOrAdmin: jest.fn(() => (req, res, next) => next())
  },
  auditMiddleware: {
    logCreation: jest.fn(() => (req, res, next) => next()),
    logAccess: jest.fn(() => (req, res, next) => next()),
    logUpdate: jest.fn(() => (req, res, next) => next()),
    logDeletion: jest.fn(() => (req, res, next) => next())
  },
  dataMiddleware: {
    formatResponse: jest.fn((req, res, next) => next())
  },
  cacheMiddleware: {
    cacheResponse: jest.fn(() => (req, res, next) => next()),
    setCacheHeaders: jest.fn(() => (req, res, next) => next()),
    clearCacheOnWrite: jest.fn(() => (req, res, next) => next())
  }
}));

jest.mock('@src/services/doctorService.mjs', () => ({
  __esModule: true,
  default: {
    getDoctorUserId: jest.fn().mockResolvedValue('user123')
  }
}));

// Mock for models with more control for different test scenarios
const mockDoctor = {
  findOne: jest.fn().mockResolvedValue({ _id: 'doctor123', userId: 'user123' }),
  findById: jest.fn().mockResolvedValue({ _id: 'doctor123', userId: 'user123' }),
  create: jest.fn().mockResolvedValue({ _id: 'doctor123', userId: 'user123' })
};

const mockUser = {
  findById: jest.fn().mockResolvedValue({ _id: 'user123' })
};

jest.mock('@src/models/index.mjs', () => ({
  __esModule: true,
  Doctor: mockDoctor,
  User: mockUser
}));

describe('Doctor Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', doctorRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset mockDoctor's implementation for each test
    mockDoctor.findOne.mockResolvedValue({ _id: 'doctor123', userId: 'user123' });
    mockDoctor.findById.mockResolvedValue({ _id: 'doctor123', userId: 'user123' });
    mockDoctor.create.mockResolvedValue({ _id: 'doctor123', userId: 'user123' });
    
    // Reset mockUser's implementation
    mockUser.findById.mockResolvedValue({ _id: 'user123' });
    
    // Reset mongoose.Types.ObjectId.isValid for each test
    mongoose.Types.ObjectId.isValid.mockReturnValue(true);
  });

  describe('GET /', () => {
    test('should return 200 and list of doctors', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /user/:userId', () => {
    test('should return 200 and doctor data when found', async () => {
      const response = await request(app)
        .get('/user/user123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(mockDoctor.findOne).toHaveBeenCalled();
    });

    test('should return 404 when doctor not found for user', async () => {
      mockDoctor.findOne.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/user/nonexistent')
        .expect('Content-Type', /json/)
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Doctor not found for this user');
    });

    test('should return 400 when userId is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      const response = await request(app)
        .get('/user/invalid-id')
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid user ID format');
    });

    test('should return 500 when database error occurs', async () => {
      mockDoctor.findOne.mockRejectedValueOnce(new Error('Database connection error'));
      
      const response = await request(app)
        .get('/user/user123')
        .expect('Content-Type', /json/)
        .expect(500);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Error fetching doctor profile');
    });

    test('should include error message when NODE_ENV is development', async () => {
      // Save original NODE_ENV
      const originalNodeEnv = process.env.NODE_ENV;
      // Set NODE_ENV to development
      process.env.NODE_ENV = 'development';
      
      mockDoctor.findOne.mockRejectedValueOnce(new Error('Database connection error'));
      
      const response = await request(app)
        .get('/user/user123')
        .expect('Content-Type', /json/)
        .expect(500);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Error fetching doctor profile');
      expect(response.body).toHaveProperty('error', 'Database connection error');
      
      // Restore original NODE_ENV
      process.env.NODE_ENV = originalNodeEnv;
    });
  });

  describe('GET /:id', () => {
    test('should return 200 and doctor data', async () => {
      const response = await request(app)
        .get('/doctor123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /:id/availability', () => {
    test('should return 200 and doctor availability', async () => {
      const response = await request(app)
        .get('/doctor123/availability')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('availability');
    });
  });

  describe('GET /me', () => {
    test('should return 200 and doctor profile for authenticated doctor', async () => {
      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('PUT /me', () => {
    test('should return 200 and updated doctor profile', async () => {
      const response = await request(app)
        .put('/me')
        .send({ specialties: ['Cardiology'] })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('updated', true);
    });
  });

  describe('POST /', () => {
    test('should return 201 and created doctor for admin user', async () => {
      // Override role for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'admin';
        next();
      });

      const response = await request(app)
        .post('/')
        .send({ userId: 'user123', specialties: ['Neurology'], licenseNumber: 'LICENSE123', appointmentFee: 75 })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('PUT /:id', () => {
    test('should return 200 and updated doctor data', async () => {
      const response = await request(app)
        .put('/doctor123')
        .send({ specialties: ['Cardiology'], appointmentFee: 85 })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('updated', true);
    });
  });

  describe('DELETE /:id', () => {
    test('should return 200 when doctor is deleted by admin', async () => {
      // Override role for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'admin';
        next();
      });

      const response = await request(app)
        .delete('/doctor123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message');
    });
  });

  describe('POST /create-for-user/:userId', () => {
    test('should return 201 and create doctor for user', async () => {
      // Ensure doctor doesn't already exist for this test
      mockDoctor.findOne.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/create-for-user/user123')
        .send({ specialties: ['Cardiology'], licenseNumber: 'TEST123', appointmentFee: 100 })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });

    test('should return 201 and create doctor with default values when not specified', async () => {
      // Ensure doctor doesn't already exist for this test
      mockDoctor.findOne.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/create-for-user/user123')
        .send({}) // No specialties, licenseNumber, or appointmentFee
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      // Check that create was called with default values
      expect(mockDoctor.create).toHaveBeenCalledWith(expect.objectContaining({
        userId: 'user123',
        specialties: ['General Medicine'],
        appointmentFee: 50,
        acceptingNewPatients: true
      }));
    });

    test('should return 200 when doctor already exists for user', async () => {
      // Doctor already exists for this user
      mockDoctor.findOne.mockResolvedValueOnce({ _id: 'doctor123', userId: 'user123' });
      
      const response = await request(app)
        .post('/create-for-user/user123')
        .send({ specialties: ['Cardiology'] })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body).toHaveProperty('message', 'Doctor already exists for this user');
    });

    test('should return 404 when user not found', async () => {
      // User not found
      mockUser.findById.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .post('/create-for-user/nonexistent')
        .send({ specialties: ['Cardiology'] })
        .expect('Content-Type', /json/)
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'User not found');
    });

    test('should return 500 when database error occurs', async () => {
      mockUser.findById.mockRejectedValueOnce(new Error('Database error'));
      
      const response = await request(app)
        .post('/create-for-user/user123')
        .send({ specialties: ['Cardiology'] })
        .expect('Content-Type', /json/)
        .expect(500);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Error creating doctor record');
    });
  });
}); 