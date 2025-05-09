import express from 'express';
import request from 'supertest';
import { jest } from '@jest/globals';

// Mock controllers
jest.mock('../../src/controllers/userController.mjs', () => ({
  getUsers: jest.fn((req, res) => res.json({ data: 'users list' })),
  getUser: jest.fn((req, res) => res.json({ data: 'user details' })),
  createUser: jest.fn((req, res) => res.status(201).json({ data: 'user created' })),
  updateUser: jest.fn((req, res) => res.json({ data: 'user updated' })),
  deleteUser: jest.fn((req, res) => res.json({ data: 'user deleted' })),
  getProfile: jest.fn((req, res) => res.json({ data: 'user profile' })),
  updateProfile: jest.fn((req, res) => res.json({ data: 'profile updated' })),
  searchUsers: jest.fn((req, res) => res.json({ data: 'search results' }))
}));

// Mock middleware
jest.mock('../../src/middleware/index.mjs', () => ({
  authMiddleware: {
    authenticate: jest.fn((req, res, next) => {
      req.user = { _id: 'user123', role: 'admin' };
      next();
    }),
    restrictTo: jest.fn((...roles) => {
      return (req, res, next) => {
        if (roles.includes(req.user.role)) {
          next();
        } else {
          res.status(403).json({ message: 'Forbidden' });
        }
      };
    })
  },
  validationMiddleware: {
    validate: jest.fn(() => jest.fn((req, res, next) => next())),
    chains: {
      registerUser: [],
      updateUser: [],
      updateProfileValidation: []
    }
  },
  auditMiddleware: {
    logAccess: jest.fn(() => jest.fn((req, res, next) => next())),
    logCreation: jest.fn(() => jest.fn((req, res, next) => next())),
    logUpdate: jest.fn(() => jest.fn((req, res, next) => next())),
    logDeletion: jest.fn(() => jest.fn((req, res, next) => next()))
  },
  cacheMiddleware: {
    cacheResponse: jest.fn(() => jest.fn((req, res, next) => next())),
    clearCacheOnWrite: jest.fn(() => jest.fn((req, res, next) => next()))
  }
}));

// Import routes after mocks
let userRoutes;
let app;

describe('User Routes', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    
    // Dynamically import the routes file after mocks are set up
    const routesModule = await import('../../src/routes/userRoutes.mjs');
    userRoutes = routesModule.default;
    
    // Set up Express app
    app = express();
    app.use(express.json());
    app.use('/api/users', userRoutes);
    
    // Add basic error handling
    app.use((err, req, res, next) => {
      res.status(err.statusCode || 500).json({
        status: err.status || 'error',
        message: err.message || 'Something went wrong'
      });
    });
  });

  describe('Profile routes', () => {
    it('should get user profile', async () => {
      const response = await request(app).get('/api/users/profile');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'user profile' });
      
      const { authMiddleware, auditMiddleware, cacheMiddleware } = await import('../../src/middleware/index.mjs');
      const { getProfile } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(auditMiddleware.logAccess).toHaveBeenCalled();
      expect(cacheMiddleware.cacheResponse).toHaveBeenCalled();
      expect(getProfile).toHaveBeenCalled();
    });

    it('should update user profile', async () => {
      const profileData = {
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com'
      };
      
      const response = await request(app)
        .put('/api/users/profile')
        .send(profileData);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'profile updated' });
      
      const { authMiddleware, validationMiddleware, auditMiddleware } = await import('../../src/middleware/index.mjs');
      const { updateProfile } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(validationMiddleware.validate).toHaveBeenCalled();
      expect(auditMiddleware.logUpdate).toHaveBeenCalled();
      expect(updateProfile).toHaveBeenCalled();
    });
  });

  describe('Search routes', () => {
    it('should search users when admin role', async () => {
      const response = await request(app)
        .get('/api/users/search')
        .query({ query: 'john' });
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'search results' });
      
      const { authMiddleware, cacheMiddleware } = await import('../../src/middleware/index.mjs');
      const { searchUsers } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(authMiddleware.restrictTo).toHaveBeenCalled();
      expect(cacheMiddleware.cacheResponse).toHaveBeenCalled();
      expect(searchUsers).toHaveBeenCalled();
    });
    
    it('should reject search when non-admin role', async () => {
      // Override the auth middleware to simulate a non-admin user
      const { authMiddleware } = await import('../../src/middleware/index.mjs');
      authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user456', role: 'patient' };
        next();
      });
      
      const response = await request(app)
        .get('/api/users/search')
        .query({ query: 'john' });
      
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Forbidden' });
    });
  });

  describe('Admin routes', () => {
    it('should get all users', async () => {
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'users list' });
      
      const { authMiddleware, cacheMiddleware } = await import('../../src/middleware/index.mjs');
      const { getUsers } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(authMiddleware.restrictTo).toHaveBeenCalled();
      expect(cacheMiddleware.cacheResponse).toHaveBeenCalled();
      expect(getUsers).toHaveBeenCalled();
    });

    it('should create a new user', async () => {
      const userData = {
        firstName: 'New',
        lastName: 'User',
        email: 'new.user@example.com',
        password: 'password123',
        role: 'staff'
      };
      
      const response = await request(app)
        .post('/api/users')
        .send(userData);
      
      expect(response.status).toBe(201);
      expect(response.body).toEqual({ data: 'user created' });
      
      const { authMiddleware, validationMiddleware, auditMiddleware } = await import('../../src/middleware/index.mjs');
      const { createUser } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(authMiddleware.restrictTo).toHaveBeenCalled();
      expect(validationMiddleware.validate).toHaveBeenCalled();
      expect(auditMiddleware.logCreation).toHaveBeenCalled();
      expect(createUser).toHaveBeenCalled();
    });

    it('should get a specific user', async () => {
      const response = await request(app).get('/api/users/user123');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'user details' });
      
      const { authMiddleware, auditMiddleware, cacheMiddleware } = await import('../../src/middleware/index.mjs');
      const { getUser } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(auditMiddleware.logAccess).toHaveBeenCalled();
      expect(cacheMiddleware.cacheResponse).toHaveBeenCalled();
      expect(getUser).toHaveBeenCalled();
    });

    it('should update a user', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'User',
        role: 'doctor'
      };
      
      const response = await request(app)
        .put('/api/users/user123')
        .send(updateData);
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'user updated' });
      
      const { authMiddleware, validationMiddleware, auditMiddleware } = await import('../../src/middleware/index.mjs');
      const { updateUser } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(validationMiddleware.validate).toHaveBeenCalled();
      expect(auditMiddleware.logUpdate).toHaveBeenCalled();
      expect(updateUser).toHaveBeenCalled();
    });

    it('should delete a user', async () => {
      const response = await request(app).delete('/api/users/user123');
      
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ data: 'user deleted' });
      
      const { authMiddleware, auditMiddleware } = await import('../../src/middleware/index.mjs');
      const { deleteUser } = await import('../../src/controllers/userController.mjs');
      
      expect(authMiddleware.authenticate).toHaveBeenCalled();
      expect(auditMiddleware.logDeletion).toHaveBeenCalled();
      expect(deleteUser).toHaveBeenCalled();
    });

    it('should reject non-admin from accessing admin routes', async () => {
      // Override the auth middleware to simulate a non-admin user
      const { authMiddleware } = await import('../../src/middleware/index.mjs');
      authMiddleware.authenticate.mockImplementationOnce((req, res, next) => {
        req.user = { _id: 'user456', role: 'patient' };
        next();
      });
      
      const response = await request(app).get('/api/users');
      
      expect(response.status).toBe(403);
      expect(response.body).toEqual({ message: 'Forbidden' });
    });
  });
}); 