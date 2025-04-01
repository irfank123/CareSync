// src/routes/staffRoutes.mjs

import express from 'express';
import {
  getStaffMembers,
  getStaffMember,
  createStaffMember,
  updateStaffMember,
  deleteStaffMember,
  getMyProfile,
  updateMyProfile,
  createStaffValidation,
  updateStaffValidation
} from '../controllers/staffController.mjs';
import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.authenticate);

// Staff-specific routes (for staff users)
router.get('/me', getMyProfile);
router.put('/me', updateStaffValidation, updateMyProfile);

// Admin/Clinic Admin routes
router.route('/')
  .get(authMiddleware.restrictTo('admin'), getStaffMembers) // Auth checking is also done in the controller for clinic admins
  .post(authMiddleware.restrictTo('admin'), createStaffValidation, createStaffMember); // Auth checking is also done in the controller for clinic admins

router.route('/:id')
  .get(getStaffMember) // Auth checking is done in the controller
  .put(updateStaffValidation, updateStaffMember) // Auth checking is done in the controller
  .delete(deleteStaffMember); // Auth checking is done in the controller

export default router;