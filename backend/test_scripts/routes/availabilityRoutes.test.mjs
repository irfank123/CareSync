import express from 'express';
import request from 'supertest';
import availabilityRoutes from '@src/routes/availabilityRoutes.mjs';

// Mock controllers
jest.mock('@src/controllers/availabilityController.mjs', () => ({
  getTimeSlots: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getAvailableTimeSlots: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  createTimeSlot: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 'newSlotId' } })),
  updateTimeSlot: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.slotId } })),
  deleteTimeSlot: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Time slot deleted' })),
  getTimeSlotById: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  generateTimeSlots: jest.fn((req, res) => res.status(201).json({ success: true, data: [], count: 0 })),
  importFromGoogle: jest.fn((req, res) => res.status(200).json({ success: true, data: [], count: 0 })),
  exportToGoogle: jest.fn((req, res) => res.status(200).json({ success: true, data: [], count: 0 })),
  syncWithGoogle: jest.fn((req, res) => res.status(200).json({ success: true, data: { added: [], updated: [], deleted: [] } })),
  createTimeSlotValidation: jest.fn((req, res, next) => next()),
  updateTimeSlotValidation: jest.fn((req, res, next) => next())
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // Define the actual middleware functions
  const actualAuthenticateMiddleware = jest.fn();
  const actualRestrictToMiddleware = jest.fn();
  const actualLogCreationMiddleware = jest.fn();
  const actualLogUpdateMiddleware = jest.fn();
  const actualLogDeletionMiddleware = jest.fn();

  // The restrictTo and log* factories
  const restrictToFactory = jest.fn((...roles) => actualRestrictToMiddleware);
  const logCreationFactory = jest.fn((resource) => actualLogCreationMiddleware);
  const logUpdateFactory = jest.fn((resource) => actualLogUpdateMiddleware);
  const logDeletionFactory = jest.fn((resource) => actualLogDeletionMiddleware);

  return {
    __esModule: true,
    authMiddleware: {
      authenticate: actualAuthenticateMiddleware,
      restrictTo: restrictToFactory,
    },
    auditMiddleware: {
      logCreation: logCreationFactory,
      logUpdate: logUpdateFactory,
      logDeletion: logDeletionFactory
    }
  };
});

describe('Availability Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks
    const { authMiddleware, auditMiddleware } = require('@src/middleware/index.mjs');
    
    // Configure auth middleware
    authMiddleware.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'doctor' };
      req.userRole = 'doctor';
      next();
    });

    // Configure restrictTo middleware
    authMiddleware.restrictTo.mockImplementation((...expectedRoles) => {
      return jest.fn((req, res, next) => {
        if (req.userRole && expectedRoles.includes(req.userRole)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            message: `Forbidden: expected one of [${expectedRoles.join(', ')}], got ${req.userRole}`
          });
        }
      });
    });

    // Configure audit middleware
    auditMiddleware.logCreation.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        // Simulate logging
        console.log(`Audit: Creating ${resource}`);
        next();
      });
    });

    auditMiddleware.logUpdate.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        // Simulate logging
        console.log(`Audit: Updating ${resource}`);
        next();
      });
    });

    auditMiddleware.logDeletion.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        // Simulate logging
        console.log(`Audit: Deleting ${resource}`);
        next();
      });
    });

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/availability', availabilityRoutes);
  });

  // Public access endpoints
  describe('GET /doctor/:doctorId/slots', () => {
    test('should get time slots for a doctor and return 200', async () => {
      const doctorId = 'doctor123';
      const response = await request(app)
        .get(`/availability/doctor/${doctorId}/slots`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      const availabilityController = require('@src/controllers/availabilityController.mjs');
      expect(availabilityController.getTimeSlots).toHaveBeenCalledTimes(1);
      
      // Check for no-cache headers
      expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
      expect(response.headers['expires']).toBe('0');
      expect(response.headers['pragma']).toBe('no-cache');
      expect(response.headers['x-cache-disabled']).toBe('true');
    }, 10000);
  });

  describe('GET /doctor/:doctorId/slots/available', () => {
    test('should get available time slots for a doctor and return 200', async () => {
      const doctorId = 'doctor123';
      const response = await request(app)
        .get(`/availability/doctor/${doctorId}/slots/available`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      const availabilityController = require('@src/controllers/availabilityController.mjs');
      expect(availabilityController.getAvailableTimeSlots).toHaveBeenCalledTimes(1);
      
      // Check for no-cache headers
      expect(response.headers['cache-control']).toBe('no-store, no-cache, must-revalidate, private');
    }, 10000);
  });

  describe('GET /timeslot/:id', () => {
    test('should get a time slot by ID and return 200', async () => {
      const slotId = 'slot123';
      const response = await request(app)
        .get(`/availability/timeslot/${slotId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(slotId);

      const { authMiddleware } = require('@src/middleware/index.mjs');
      const availabilityController = require('@src/controllers/availabilityController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(availabilityController.getTimeSlotById).toHaveBeenCalledTimes(1);
    }, 10000);
  });

  describe('GET /test-route', () => {
    test('should return 200 and test message', async () => {
      const response = await request(app)
        .get('/availability/test-route')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('Availability router is working correctly');
      expect(response.body).toHaveProperty('timestamp');
      
      const { authMiddleware } = require('@src/middleware/index.mjs');
      expect(authMiddleware.authenticate).toHaveBeenCalledTimes(1);
    }, 10000);
  });
}); 