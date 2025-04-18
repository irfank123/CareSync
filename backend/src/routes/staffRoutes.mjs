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
import { 
  authMiddleware, 
  auditMiddleware,
  cacheMiddleware 
} from '../middleware/index.mjs';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.authenticate);

// Staff-specific routes (for staff users)
router.get(
  '/me', 
  authMiddleware.restrictTo('staff'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('staff-profile'),
  getMyProfile
);

router.put(
  '/me', 
  authMiddleware.restrictTo('staff'),
  updateStaffValidation,
  auditMiddleware.logUpdate('staff-profile'),
  updateMyProfile
);

// Admin/Clinic Admin routes
router.route('/')
  .get(
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    getStaffMembers  // Auth checking is done in the controller
  )
  .post(
    createStaffValidation,
    auditMiddleware.logCreation('staff'),
    createStaffMember  // Auth checking is done in the controller
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('staff'),
    getStaffMember  // Auth checking is done in the controller
  )
  .put(
    updateStaffValidation,
    auditMiddleware.logUpdate('staff'),
    updateStaffMember  // Auth checking is done in the controller
  )
  .delete(
    auditMiddleware.logDeletion('staff'),
    deleteStaffMember  // Auth checking is done in the controller
  );

export default router;