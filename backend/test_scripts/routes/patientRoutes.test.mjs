import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import patientRoutes from '@src/routes/patientRoutes.mjs';

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

jest.mock('@src/controllers/patientController.mjs', () => ({
  getPatientsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getPatientWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1' } })),
  createPatientWithDI: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: '1' } })),
  updatePatientWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1', updated: true } })),
  deletePatientWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Patient deleted' })),
  getMyProfileWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1' } })),
  updateMyProfileWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: '1', updated: true } })),
  getMedicalHistoryWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { medicalHistory: [] } })),
  createPatientValidation: {},
  updatePatientValidation: {}
}));

jest.mock('@src/controllers/assessmentController.mjs', () => ({
  __esModule: true,
  default: {
    startAssessment: jest.fn().mockImplementation((req, res, next) => {
      // Check if res is defined and has methods before calling them
      if (res && typeof res.status === 'function' && typeof res.json === 'function') {
        return res.status(201).json({ success: true, data: { id: 'mockAssessmentId', status: 'in_progress' } });
      } else {
        // Fallback or error if res is not a valid response object
        console.error('Mock assessmentController.startAssessment: res object is invalid');
        // If next is available, call it with an error
        if (typeof next === 'function') {
          return next(new Error('Mock response object error in startAssessment'));
        }
        return; // Or throw an error
      }
    }),
    // Add any other methods from assessmentController that patientRoutes might call
  }
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
    validate: jest.fn(() => (req, res, next) => next())
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
    clearCacheOnWrite: jest.fn(() => (req, res, next) => next())
  }
}));

jest.mock('@src/models/index.mjs', () => ({
  Patient: {
    findOne: jest.fn().mockResolvedValue({
      _id: 'patient123',
      userId: 'user123',
      toObject: () => ({
        _id: 'patient123',
        userId: 'user123',
        firstName: 'John',
        lastName: 'Doe'
      })
    })
  }
}));

describe('Patient Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', patientRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /me', () => {
    test('should return 403 when user is not a patient', async () => {
      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(403);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    test('should return 200 and patient profile when user is a patient', async () => {
      // Override userRole for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'patient';
        next();
      });

      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /user/:userId', () => {
    test('should return 200 and patient data when found', async () => {
      const response = await request(app)
        .get('/user/user123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      
      const { Patient } = require('@src/models/index.mjs');
      expect(Patient.findOne).toHaveBeenCalled();
    }, 15000);

    test('should return 404 when patient not found for user', async () => {
      const { Patient } = require('@src/models/index.mjs');
      Patient.findOne.mockResolvedValueOnce(null);
      
      const response = await request(app)
        .get('/user/nonexistent')
        .expect('Content-Type', /json/)
        .expect(404);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Patient not found for this user');
    }, 15000);

    test('should return 400 when userId is invalid', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      const response = await request(app)
        .get('/user/invalid-id')
        .expect('Content-Type', /json/)
        .expect(400);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Invalid user ID format');
    }, 15000);

    test('should return 500 when database error occurs', async () => {
      const { Patient } = require('@src/models/index.mjs');
      Patient.findOne.mockRejectedValueOnce(new Error('Database connection error'));
      
      const response = await request(app)
        .get('/user/user123')
        .expect('Content-Type', /json/)
        .expect(500);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Error fetching patient profile');
    }, 15000);
  });

  describe('PUT /me', () => {
    test('should return 403 when user is not a patient', async () => {
      const response = await request(app)
        .put('/me')
        .send({ firstName: 'Updated' })
        .expect('Content-Type', /json/)
        .expect(403);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    test('should return 200 and updated profile when user is a patient', async () => {
      // Override userRole for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'patient';
        next();
      });

      const response = await request(app)
        .put('/me')
        .send({ firstName: 'Updated' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('updated', true);
    });
  });

  describe('POST /:patientId/assessments/start', () => {
    test('should return 403 when user is not a patient', async () => {
      const response = await request(app)
        .post('/patient123/assessments/start')
        .send({ type: 'general' })
        .expect('Content-Type', /json/)
        .expect(403);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    test('should return 201 and started assessment when user is a patient', async () => {
      // Override userRole for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'patient';
        next();
      });

      const response = await request(app)
        .post('/patient123/assessments/start')
        .send({ type: 'general' })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('status', 'in_progress');
    });
  });

  describe('GET /', () => {
    test('should return 200 and list of patients', async () => {
      const response = await request(app)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('POST /', () => {
    test('should return 403 when user is not admin or staff', async () => {
      const response = await request(app)
        .post('/')
        .send({ firstName: 'New', lastName: 'Patient' })
        .expect('Content-Type', /json/)
        .expect(403);
      
      expect(response.body).toHaveProperty('success', false);
      expect(response.body).toHaveProperty('message', 'Forbidden');
    });

    test('should return 201 and created patient when user is admin', async () => {
      // Override userRole for this test
      require('@src/middleware/index.mjs').authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'admin';
        next();
      });

      const response = await request(app)
        .post('/')
        .send({ firstName: 'New', lastName: 'Patient' })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /:id', () => {
    test('should return 200 and patient data', async () => {
      const response = await request(app)
        .get('/patient123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
    });
  });

  describe('GET /:id/medical-history', () => {
    test('should return 200 and medical history data', async () => {
      const response = await request(app)
        .get('/patient123/medical-history')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('data');
      expect(response.body.data).toHaveProperty('medicalHistory');
    });
  });
}); 