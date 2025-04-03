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
  createUserValidation,
  updateUserValidation,
  updateProfileValidation
} from '../controllers/userController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.authenticate);

// Public profile routes (for authenticated users)
router.get('/profile', getProfile);
router.put('/profile', updateProfileValidation, updateProfile);

// Admin routes
router.route('/')
  .get(authMiddleware.restrictTo('admin', 'staff'), getUsers)
  .post(authMiddleware.restrictTo('admin', 'staff'), createUserValidation, createUser);

router.route('/:id')
  .get(getUser) // Auth checking is done in the controller
  .put(updateUserValidation, updateUser) // Auth checking is done in the controller
  .delete(authMiddleware.restrictTo('admin'), deleteUser);

export default router;