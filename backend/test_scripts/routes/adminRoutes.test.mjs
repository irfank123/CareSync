import express from 'express';
import request from 'supertest';
import adminRoutes from '@src/routes/adminRoutes.mjs';

// Declare the variable that will hold the mock function.
// It will be initialized within the jest.mock factory.
let mockRestrictToActualMiddleware;

// Mock controllers
jest.mock('@src/controllers/adminController.mjs', () => ({
  getClinics: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id } })),
  updateClinicVerification: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id, verified: true } })),
  getClinicDocuments: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  getClinicStaff: jest.fn((req, res) => res.status(200).json({ success: true, data: [] })),
  suspendClinic: jest.fn((req, res) => res.status(200).json({ success: true, data: { id: req.params.id, suspended: true } })),
  updateVerificationValidation: jest.fn((req, res, next) => next()),
}));

// Mock middleware
jest.mock('@src/middleware/index.mjs', () => {
  // This is the actual middleware function that restrictTo('admin') will return.
  // Its logic is defined here, and it will be called with (req, res, next).
  const actualAdminRestrictMiddleware = jest.fn((req, res, next) => {
    // console.log('[TEST DEBUG] actualAdminRestrictMiddleware called. userRole:', req.userRole, 'path:', req.path);
    if (req.userRole && req.userRole === 'admin') {
      // console.log('[TEST DEBUG] actualAdminRestrictMiddleware: admin access, calling next()');
      next();
    } else {
      // console.log('[TEST DEBUG] actualAdminRestrictMiddleware: non-admin access, sending 403');
      res.status(403).json({
        success: false,
        message: `Forbidden by actualAdminRestrictMiddleware (expected: admin, got: ${req.userRole})`
      });
    }
  });

  return {
    __esModule: true,
    authMiddleware: {
      authenticate: jest.fn(), // Implementation will be set in beforeEach
      restrictTo: jest.fn((...roles) => {
        // This is the factory for restrictTo middleware.
        if (roles.length === 1 && roles[0] === 'admin') {
          return actualAdminRestrictMiddleware; // Return the fully functional admin middleware
        }
        // Fallback for any other roles, returns a passthrough middleware.
        if (roles.length > 0 && (roles.length !== 1 || roles[0] !== 'admin')) {
          // console.warn(`[TEST WARN] Unexpected call to restrictTo mock factory with roles: ${roles.join(', ')}`);
        }
        return jest.fn((req, res, next) => next());
      }),
      checkClinicStatus: jest.fn(), // Implementation will be set in beforeEach
    },
    auditMiddleware: {
      logAccess: jest.fn(() => {
        return jest.fn((req, res, next) => {
          next();
        });
      }),
      logUpdate: jest.fn(() => {
        return jest.fn((req, res, next) => {
          next();
        });
      }),
    },
    cacheMiddleware: {
      cacheResponse: jest.fn((duration) => { // This is the factory for cacheResponse
        // console.log(`[TEST DEBUG] cacheMiddleware.cacheResponse factory called with duration: ${duration}. Path:`, global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG || 'unknown');
        return jest.fn((req, res, next) => {
          next();
        });
      }),
    },
  };
});

describe('Admin Routes', () => {
  let app;
  let mockAuthMiddleware;
  let mockAuditMiddleware;
  let mockCacheMiddleware;

  beforeEach(() => {
    jest.clearAllMocks();

    const { authMiddleware } = require('@src/middleware/index.mjs');
    // const adminController = require('@src/controllers/adminController.mjs'); // For assertions if needed beyond what jest.clearAllMocks provides

    authMiddleware.authenticate.mockImplementation((req, res, next) => {
      req.user = { _id: 'adminUserId', role: 'admin' };
      req.userRole = 'admin'; // This is crucial for actualAdminRestrictMiddleware
      // global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG = req.path; // Removed
      // console.log('[TEST DEBUG] authenticate mock called. Setting userRole to admin. Path:', req.path);
      next();
    });

    authMiddleware.checkClinicStatus.mockImplementation((req, res, next) => {
      // global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG = req.path; // Removed
      // console.log('[TEST DEBUG] checkClinicStatus mock called. Path:', req.path);
      next();
    });

    // actualAdminRestrictMiddleware is already defined with logic in the jest.mock factory.
    // jest.clearAllMocks() will clear its call history.
    // No need to set its implementation here unless it needs to change per test (unlikely for this). 

    app = express();
    app.use(express.json());
    // Middleware to capture path for mocks if not set by auth/checkStatus, as a fallback for the debug log
    // app.use((req, res, next) => { 
    //   if (!global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG) {
    //     global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG = req.path;
    //   }
    //   next();
    // });
    app.use('/admin', adminRoutes);
  });

  // Remove afterEach for debug logging path
  // afterEach(() => {
  //   delete global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG;
  // });

  describe('GET /admin/clinics', () => {
    test('should get all clinics and return 200 for admin', async () => {
      const response = await request(app)
        .get('/admin/clinics')
        .expect('Content-Type', /json/)
        .expect(200);
      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');

      // Verify global middleware were called
      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);

      // Verify the controller was called (implies route-specific middleware like cache/audit worked as passthroughs)
      expect(adminController.getClinics).toHaveBeenCalledTimes(1);

      // Do NOT assert calls on route-specific middleware FACTORIES (e.g., cacheMiddleware.cacheResponse)
      // during the request, as they are called at setup time and their call counts are cleared by jest.clearAllMocks().
      // We trust their returned passthrough middleware works if the controller is hit.
      // If specific behavior of those returned middleware is needed, they'd need stable instances like actualAdminRestrictMiddleware.
    });

    test('should return 403 if user is not admin', async () => {
      const importedMiddleware = require('@src/middleware/index.mjs');
      importedMiddleware.authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'nonAdminUserId', role: 'user' };
        req.userRole = 'user'; // This will be seen by actualAdminRestrictMiddleware in the factory
        // global.__CURRENT_REQ_PATH_FOR_DEBUG_LOG = req.path; // Removed
        next();
      });

      const response = await request(app)
        .get('/admin/clinics')
        .expect('Content-Type', /json/)
        .expect(403);
      expect(response.body.message).toContain('Forbidden by actualAdminRestrictMiddleware');
      
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      // Controller should not be called in this case
      const adminController = require('@src/controllers/adminController.mjs');
      expect(adminController.getClinics).not.toHaveBeenCalled();
    });
  });

  describe('GET /admin/clinics/:id', () => {
    test('should get a specific clinic and return 200 for admin', async () => {
      const clinicId = 'testClinicId';
      await request(app)
        .get(`/admin/clinics/${clinicId}`)
        .expect('Content-Type', /json/)
        .expect(200);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');

      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(adminController.getClinic).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /admin/clinics/:id/verification', () => {
    test('should update clinic verification and return 200 for admin', async () => {
      const clinicId = 'testClinicId';
      const verificationData = { isVerified: true, remarks: 'Verified' };
      await request(app)
        .put(`/admin/clinics/${clinicId}/verification`)
        .send(verificationData)
        .expect('Content-Type', /json/)
        .expect(200);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');

      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(adminController.updateVerificationValidation).toHaveBeenCalledTimes(1);
      expect(adminController.updateClinicVerification).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /admin/clinics/:id/documents', () => {
    test('should get clinic documents and return 200 for admin', async () => {
      const clinicId = 'testClinicId';
      await request(app)
        .get(`/admin/clinics/${clinicId}/documents`)
        .expect('Content-Type', /json/)
        .expect(200);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');

      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(adminController.getClinicDocuments).toHaveBeenCalledTimes(1);
    });
  });

  describe('GET /admin/clinics/:id/staff', () => {
    test('should get clinic staff and return 200 for admin', async () => {
      const clinicId = 'testClinicId';
      await request(app)
        .get(`/admin/clinics/${clinicId}/staff`)
        .expect('Content-Type', /json/)
        .expect(200);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');

      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(adminController.getClinicStaff).toHaveBeenCalledTimes(1);
    });
  });

  describe('PUT /admin/clinics/:id/suspend', () => {
    test('should suspend a clinic and return 200 for admin', async () => {
      const clinicId = 'testClinicId';
      await request(app)
        .put(`/admin/clinics/${clinicId}/suspend`)
        .send({ isSuspended: true, reason: 'Policy violation' })
        .expect('Content-Type', /json/)
        .expect(200);

      const importedMiddleware = require('@src/middleware/index.mjs');
      const adminController = require('@src/controllers/adminController.mjs');
      const usedRestrictMiddleware = importedMiddleware.authMiddleware.restrictTo('admin');

      expect(importedMiddleware.authMiddleware.authenticate).toHaveBeenCalledTimes(1);
      expect(usedRestrictMiddleware).toHaveBeenCalledTimes(1);
      expect(importedMiddleware.authMiddleware.checkClinicStatus).toHaveBeenCalledTimes(1);
      expect(adminController.suspendClinic).toHaveBeenCalledTimes(1);
    });
  });
}); 