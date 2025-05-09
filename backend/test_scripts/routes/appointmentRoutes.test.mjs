import express from 'express';
import request from 'supertest';
import appointmentRoutes from '@src/routes/appointmentRoutes.mjs';

// Mock controllers
jest.mock('@src/controllers/appointmentController.mjs', () => ({
  getAppointmentsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getAppointmentWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createAppointmentWithDI: jest.fn((req, res) => res.status(201).json({ success: true, data: { id: 'newAppointmentId' } })),
  updateAppointmentWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  deleteAppointmentWithDI: jest.fn((req, res) => res.status(200).json({ success: true, message: 'Appointment deleted' })),
  getPatientAppointmentsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getDoctorAppointmentsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getUpcomingAppointmentsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getMyAppointmentsWithDI: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getAppointmentTimeslot: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  createAppointmentValidation: jest.fn((req, res, next) => next()),
  updateAppointmentValidation: jest.fn((req, res, next) => next())
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // Define middleware functions
  const actualAuthenticateMiddleware = jest.fn();
  const actualRestrictToMiddleware = jest.fn();
  const actualLogAccessMiddleware = jest.fn();
  const actualLogCreationMiddleware = jest.fn();
  const actualLogUpdateMiddleware = jest.fn();
  const actualLogDeletionMiddleware = jest.fn();
  const actualCacheResponseMiddleware = jest.fn();
  const actualClearCacheOnWriteMiddleware = jest.fn();

  // Factories
  const restrictToFactory = jest.fn((...roles) => actualRestrictToMiddleware);
  const logAccessFactory = jest.fn((resource) => actualLogAccessMiddleware);
  const logCreationFactory = jest.fn((resource) => actualLogCreationMiddleware);
  const logUpdateFactory = jest.fn((resource) => actualLogUpdateMiddleware);
  const logDeletionFactory = jest.fn((resource) => actualLogDeletionMiddleware);
  const cacheResponseFactory = jest.fn((seconds) => actualCacheResponseMiddleware);
  const clearCacheOnWriteFactory = jest.fn((resource) => actualClearCacheOnWriteMiddleware);

  return {
    __esModule: true,
    authMiddleware: {
      authenticate: actualAuthenticateMiddleware,
      restrictTo: restrictToFactory
    },
    auditMiddleware: {
      logAccess: logAccessFactory,
      logCreation: logCreationFactory,
      logUpdate: logUpdateFactory,
      logDeletion: logDeletionFactory
    },
    cacheMiddleware: {
      cacheResponse: cacheResponseFactory,
      clearCacheOnWrite: clearCacheOnWriteFactory
    }
  };
});

// Mock authMiddleware directly
jest.mock('@src/middleware/auth/authMiddleware.mjs', () => ({
  __esModule: true,
  default: {
    authenticate: jest.fn((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'patient' };
      next();
    }),
    restrictTo: jest.fn((...roles) => (req, res, next) => {
      if (roles.includes(req.user.role)) {
        next();
      } else {
        res.status(403).json({ success: false, message: 'Forbidden' });
      }
    })
  }
}));

// Mock models
jest.mock('@src/models/index.mjs', () => {
  const appointmentMock = {
    findById: jest.fn().mockImplementation(() => ({
      populate: jest.fn().mockImplementation(() => ({
        populate: jest.fn().mockResolvedValue({
          _id: 'appointment123',
          patientId: { _id: 'patient123', email: 'patient@example.com', firstName: 'John', lastName: 'Doe' },
          doctorId: { _id: 'doctor123', email: 'doctor@example.com', firstName: 'Jane', lastName: 'Smith' },
          date: new Date('2023-05-10'),
          startTime: '10:00',
          endTime: '10:30',
          reasonForVisit: 'Checkup',
          clinicId: 'clinic123',
          toObject: jest.fn().mockReturnValue({
            _id: 'appointment123',
            patientId: { _id: 'patient123', email: 'patient@example.com', firstName: 'John', lastName: 'Doe' },
            doctorId: { _id: 'doctor123', email: 'doctor@example.com', firstName: 'Jane', lastName: 'Smith' },
            date: new Date('2023-05-10'),
            startTime: '10:00',
            endTime: '10:30',
            reasonForVisit: 'Checkup',
            clinicId: 'clinic123'
          }),
          save: jest.fn().mockResolvedValue(true)
        })
      }))
    }))
  };

  return {
    __esModule: true,
    Appointment: appointmentMock,
    User: {},
    Doctor: {}
  };
});

// Mock error handler
jest.mock('@src/utils/errorHandler.mjs', () => ({
  __esModule: true,
  AppError: class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
    }
  }
}));

// Mock Google service
jest.mock('@src/services/googleService.mjs', () => ({
  __esModule: true,
  default: {
    createCalendarEventWithMeet: jest.fn().mockResolvedValue({
      id: 'google-event-123',
      hangoutLink: 'https://meet.google.com/abc-def-ghi'
    })
  }
}));

describe('Appointment Routes', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();

    // Configure mocks
    const { authMiddleware, auditMiddleware, cacheMiddleware } = require('@src/middleware/index.mjs');
    const authMiddlewareModule = require('@src/middleware/auth/authMiddleware.mjs').default;
    
    // Configure auth middleware
    authMiddlewareModule.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'patient', clinicId: 'clinic123' };
      next();
    });

    authMiddleware.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'testUserId', role: 'patient', clinicId: 'clinic123' };
      next();
    });

    authMiddleware.restrictTo.mockImplementation((...expectedRoles) => {
      return jest.fn((req, res, next) => {
        if (req.user && expectedRoles.includes(req.user.role)) {
          next();
        } else {
          res.status(403).json({
            success: false,
            message: `Forbidden: expected one of [${expectedRoles.join(', ')}], got ${req.user.role}`
          });
        }
      });
    });

    // Configure audit middleware
    auditMiddleware.logAccess.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Accessing ${resource}`);
        next();
      });
    });

    auditMiddleware.logCreation.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Creating ${resource}`);
        next();
      });
    });

    auditMiddleware.logUpdate.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Updating ${resource}`);
        next();
      });
    });

    auditMiddleware.logDeletion.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Audit: Deleting ${resource}`);
        next();
      });
    });

    // Configure cache middleware
    cacheMiddleware.cacheResponse.mockImplementation((seconds) => {
      return jest.fn((req, res, next) => {
        res.set('Cache-Control', `private, max-age=${seconds}`);
        next();
      });
    });

    cacheMiddleware.clearCacheOnWrite.mockImplementation((resource) => {
      return jest.fn((req, res, next) => {
        console.log(`Cache: Clearing cache for ${resource}`);
        next();
      });
    });

    // Setup app
    app = express();
    app.use(express.json());
    app.use('/appointments', appointmentRoutes);
  });

  describe('GET /timeslot/:id', () => {
    test('should return timeslot for an appointment and 200', async () => {
      const timeslotId = 'timeslot123';
      const response = await request(app)
        .get(`/appointments/timeslot/${timeslotId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(timeslotId);

      const appointmentController = require('@src/controllers/appointmentController.mjs');
      expect(appointmentController.getAppointmentTimeslot).toHaveBeenCalledTimes(1);
    });
  });
}); 