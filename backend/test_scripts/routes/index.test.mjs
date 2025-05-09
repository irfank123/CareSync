import request from 'supertest';
import setupRoutes from '@src/routes/index.mjs';

// No top-level express import here, it will be required inside mocks

// Mock individual routes: They should return an actual express.Router instance
jest.mock('@src/routes/authRoutes.mjs', () => {
  const express = require('express'); // Require express inside the mock factory
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'auth' }));
  return mockedRouter;
});

jest.mock('@src/routes/clinicAuthRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'clinic-auth' }));
  return mockedRouter;
});

jest.mock('@src/routes/adminRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'admin' }));
  return mockedRouter;
});

jest.mock('@src/routes/userRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'users' }));
  return mockedRouter;
});

jest.mock('@src/routes/patientRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'patients' }));
  return mockedRouter;
});

jest.mock('@src/routes/doctorRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'doctors' }));
  return mockedRouter;
});

jest.mock('@src/routes/staffRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'staff' }));
  return mockedRouter;
});

jest.mock('@src/routes/appointmentRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'appointments' }));
  return mockedRouter;
});

jest.mock('@src/routes/availabilityRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'availability' }));
  return mockedRouter;
});

jest.mock('@src/routes/testRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'test-route-module' }));
  return mockedRouter;
});

jest.mock('@src/routes/assessmentRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'assessments' }));
  return mockedRouter;
});

jest.mock('@src/routes/prescriptionRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'prescriptions' }));
  return mockedRouter;
});

jest.mock('@src/routes/googleRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'google' }));
  return mockedRouter;
});

jest.mock('@src/routes/clinicRoutes.mjs', () => {
  const express = require('express');
  const mockedRouter = express.Router();
  mockedRouter.get('/test', (req, res) => res.status(200).json({ route: 'clinics' }));
  return mockedRouter;
});

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => ({
  errorMiddleware: {
    notFound: jest.fn((req, res, next) => {
      res.status(404).json({ message: 'Not Found from Mock' });
    }),
    globalErrorHandler: jest.fn((err, req, res, next) => {
      res.status(err.statusCode || 500).json({ message: err.message || 'Error from Mock' });
    })
  },
  rateLimitMiddleware: {
    apiLimiter: jest.fn((req, res, next) => next())
  },
  dataMiddleware: {
    sanitizeResponse: jest.fn(() => (req, res, next) => next())
  }
}));

// Import express for the app instance after mocks are defined
const express = require('express');

describe('Route Index - setupRoutes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use(express.json());
    setupRoutes(app); 
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Health Check', () => {
    test('should return 200 and healthy status for /health', async () => {
      const response = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('message', 'Server is healthy');
      expect(response.body).toHaveProperty('timestamp');
    });
  });

  describe('Mounted API Routes', () => {
    const testCases = [
      { path: '/api/auth/test', expectedRoute: 'auth' },
      { path: '/api/auth/clinic/test', expectedRoute: 'clinic-auth' },
      { path: '/api/clinics/test', expectedRoute: 'clinics' },
      { path: '/api/admin/test', expectedRoute: 'admin' },
      { path: '/api/users/test', expectedRoute: 'users' },
      { path: '/api/patients/test', expectedRoute: 'patients' },
      { path: '/api/doctors/test', expectedRoute: 'doctors' },
      { path: '/api/staff/test', expectedRoute: 'staff' },
      { path: '/api/appointments/test', expectedRoute: 'appointments' },
      { path: '/api/prescriptions/test', expectedRoute: 'prescriptions' },
      { path: '/api/availability/test', expectedRoute: 'availability' },
      { path: '/api/assessments/test', expectedRoute: 'assessments' },
      { path: '/api/google/test', expectedRoute: 'google' },
    ];

    test.each(testCases)('$path should be routed to $expectedRoute mock', async ({ path, expectedRoute }) => {
      const response = await request(app)
        .get(path)
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body).toEqual({ route: expectedRoute });
    });

    test('should mount testRoutes under /api/test in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      const devApp = express(); 
      devApp.use(express.json());
      setupRoutes(devApp);
      const response = await request(devApp)
        .get('/api/test/test')
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body).toEqual({ route: 'test-route-module' });
      process.env.NODE_ENV = originalEnv; 
    });

    test('should not mount testRoutes under /api/test in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      const prodApp = express(); 
      prodApp.use(express.json());
      setupRoutes(prodApp);
      await request(prodApp).get('/api/test/test').expect(404);
      process.env.NODE_ENV = originalEnv; 
    });
  });

  describe('Error Handling Middleware', () => {
    test('should use notFound middleware for undefined routes', async () => {
      const response = await request(app)
        .get('/api/nonexistentroute')
        .expect('Content-Type', /json/)
        .expect(404);
      expect(response.body).toEqual({ message: 'Not Found from Mock' });
    });

    test('should use globalErrorHandler for errors in routes', async () => {
      const errorApp = express();
      errorApp.use(express.json());
      errorApp.get('/api/error', (req, res, next) => {
        const err = new Error('Test global error');
        err.statusCode = 503;
        next(err);
      });
      setupRoutes(errorApp); 
      const response = await request(errorApp)
        .get('/api/error')
        .expect('Content-Type', /json/)
        .expect(503);
      expect(response.body).toEqual({ message: 'Test global error' });
    });
  });
}); 