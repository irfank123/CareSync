// src/routes/doctorRoutes.mjs

import express from 'express';
import {
  getDoctors,
  getDoctor,
  createDoctor,
  updateDoctor,
  deleteDoctor,
  getMyProfile,
  updateMyProfile,
  getDoctorAvailability
} from '../controllers/doctorController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  permissionMiddleware,
  auditMiddleware,
  dataMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';
import doctorService from '../services/doctorService.mjs';

const router = express.Router();

// Public doctor listing routes don't need authentication
router.get(
  '/',
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  cacheMiddleware.setCacheHeaders({ public: true, maxAge: 3600 }),
  getDoctors
);

router.get(
  '/:id',
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  cacheMiddleware.setCacheHeaders({ public: true, maxAge: 3600 }),
  getDoctor
);

router.get(
  '/:id/availability',
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  cacheMiddleware.setCacheHeaders({ public: true, maxAge: 300 }),
  getDoctorAvailability
);

// Protect remaining routes with authentication
router.use(authMiddleware.authenticate);

// Apply data middleware for consistent responses
router.use(dataMiddleware.formatResponse);

// Doctor-specific routes (for doctor users)
router.get(
  '/me', 
  authMiddleware.restrictTo('doctor'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('doctor-profile'),
  getMyProfile
);

router.put(
  '/me', 
  authMiddleware.restrictTo('doctor'),
  validationMiddleware.validate([
    validationMiddleware.rules.doctor.specialties.optional(),
    validationMiddleware.rules.doctor.licenseNumber.optional()
  ]),
  auditMiddleware.logUpdate('doctor-profile'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  updateMyProfile
);

// Admin/Staff routes
router.post(
  '/', 
  authMiddleware.restrictTo('admin', 'staff'),
  validationMiddleware.validate([
    validationMiddleware.rules.user.userId,
    validationMiddleware.rules.doctor.specialties,
    validationMiddleware.rules.doctor.licenseNumber,
    validationMiddleware.rules.doctor.appointmentFee
  ]),
  auditMiddleware.logCreation('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  createDoctor
);

router.put(
  '/:id',
  permissionMiddleware.isOwnerOrAdmin(doctorService.getDoctorUserId.bind(doctorService)),
  validationMiddleware.validate([
    validationMiddleware.rules.doctor.specialties.optional(),
    validationMiddleware.rules.doctor.licenseNumber.optional(),
    validationMiddleware.rules.doctor.appointmentFee.optional()
  ]),
  auditMiddleware.logUpdate('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  updateDoctor
);

router.delete(
  '/:id',
  authMiddleware.restrictTo('admin'),
  auditMiddleware.logDeletion('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  deleteDoctor
);

export default router;