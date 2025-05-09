import express from 'express';
import request from 'supertest';
import prescriptionRoutes from '@src/routes/prescriptionRoutes.mjs';

// Mock dependencies
jest.mock('@src/controllers/prescriptionController.mjs', () => ({
  getMyPrescriptionsWithDI: jest.fn((req, res) => res.status(200).json({ prescriptions: [] })),
  createPrescriptionWithDI: jest.fn((req, res) => res.status(201).json({ prescription: { id: '1' } })),
  getPatientPrescriptionsWithDI: jest.fn((req, res) => res.status(200).json({ prescriptions: [] })),
  getPrescriptionByIdWithDI: jest.fn((req, res) => res.status(200).json({ prescription: { id: '1' } })),
  updatePrescriptionWithDI: jest.fn((req, res) => res.status(200).json({ prescription: { id: '1', updated: true } }))
}));

jest.mock('@src/middleware/auth/authMiddleware.mjs', () => ({
  authenticate: jest.fn((req, res, next) => {
    req.user = { _id: 'user123' };
    req.userRole = 'doctor';
    next();
  }),
  restrictTo: jest.fn((role) => (req, res, next) => {
    if (req.userRole === role) {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden' });
    }
  })
}));

jest.mock('@src/middleware/index.mjs', () => ({
  auditMiddleware: {
    logCreation: jest.fn(() => (req, res, next) => next()),
    logAccess: jest.fn(() => (req, res, next) => next()),
    logUpdate: jest.fn(() => (req, res, next) => next())
  }
}));

jest.mock('@src/services/patientService.mjs', () => ({
  __esModule: true,
  default: {
    getByUserId: jest.fn().mockResolvedValue({ _id: { toString: () => 'patient123' } })
  }
}));

describe('Prescription Routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', prescriptionRoutes);
    
    // Reset mocks
    jest.clearAllMocks();
  });

  describe('GET /me', () => {
    test('should return 200 and patient prescriptions when user is a patient', async () => {
      // Override the userRole for this test
      require('@src/middleware/auth/authMiddleware.mjs').authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'patient';
        next();
      });

      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('prescriptions');
    });

    test('should return 403 when user is not a patient', async () => {
      const response = await request(app)
        .get('/me')
        .expect('Content-Type', /json/)
        .expect(403);
      
      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toBe('Forbidden');
    });
  });

  describe('POST /', () => {
    test('should return 201 and created prescription when user is a doctor', async () => {
      const response = await request(app)
        .post('/')
        .send({ patientId: 'patient123', medication: 'Test Med', dosage: '10mg' })
        .expect('Content-Type', /json/)
        .expect(201);
      
      expect(response.body).toHaveProperty('prescription');
      expect(response.body.prescription).toHaveProperty('id');
    });
  });

  describe('GET /patient/:patientId', () => {
    test('should return 200 and prescriptions for the patient (doctor access)', async () => {
      const response = await request(app)
        .get('/patient/patient123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('prescriptions');
    });

    test('should return 200 when patient accesses their own prescriptions', async () => {
      // Override the userRole for this test
      require('@src/middleware/auth/authMiddleware.mjs').authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user123' };
        req.userRole = 'patient';
        next();
      });

      const response = await request(app)
        .get('/patient/patient123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('prescriptions');
    });
  });

  describe('GET /:id', () => {
    test('should return 200 and the requested prescription', async () => {
      const response = await request(app)
        .get('/prescription123')
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('prescription');
    });
  });

  describe('PUT /:id', () => {
    test('should return 200 and the updated prescription when user is a doctor', async () => {
      const response = await request(app)
        .put('/prescription123')
        .send({ status: 'cancelled' })
        .expect('Content-Type', /json/)
        .expect(200);
      
      expect(response.body).toHaveProperty('prescription');
      expect(response.body.prescription).toHaveProperty('updated', true);
    });
  });
}); 