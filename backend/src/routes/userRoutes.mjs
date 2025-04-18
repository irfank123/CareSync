// src/routes/userRoutes.mjs

import express from 'express';
import {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  getProfile,
  updateProfile,
  searchUsers
} from '../controllers/userController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  auditMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.authenticate);

// Public profile routes (for authenticated users)
router.get(
  '/profile', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('user-profile'),
  getProfile
);

router.put(
  '/profile', 
  validationMiddleware.validate(validationMiddleware.chains.updateProfileValidation),
  auditMiddleware.logUpdate('user-profile'),
  updateProfile
);

// Search users route
router.get(
  '/search',
  authMiddleware.restrictTo('admin', 'staff'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  searchUsers
);

// Admin routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'staff'), 
    cacheMiddleware.cacheResponse(60), // Cache for 1 minute
    getUsers
  )
  .post(
    authMiddleware.restrictTo('admin', 'staff'), 
    validationMiddleware.validate(validationMiddleware.chains.registerUser),
    auditMiddleware.logCreation('user'),
    createUser
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(60), // Cache for 1 minute
    auditMiddleware.logAccess('user'),
    getUser
  )
  .put(
    validationMiddleware.validate(validationMiddleware.chains.updateUser),
    auditMiddleware.logUpdate('user'),
    updateUser
  )
  .delete(
    auditMiddleware.logDeletion('user'),
    deleteUser
  );

export default router;