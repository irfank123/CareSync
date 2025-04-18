// src/routes/patientRoutes.mjs

import express from 'express';
import {
  getPatientsWithDI,
  getPatientWithDI,
  createPatientWithDI,
  updatePatientWithDI,
  deletePatientWithDI,
  getMyProfileWithDI,
  updateMyProfileWithDI,
  getMedicalHistoryWithDI,
  createPatientValidation,
  updatePatientValidation
} from '../controllers/patientController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  permissionMiddleware,
  auditMiddleware,
  dataMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';

const router = express.Router();

// Apply authentication to all routes
router.use(authMiddleware.authenticate);

// Apply data middleware for consistent responses
router.use(dataMiddleware.formatResponse);

// Patient-specific routes (for patient users)
router.get(
  '/me', 
  authMiddleware.restrictTo('patient'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('patient-profile'),
  getMyProfileWithDI
);

router.put(
  '/me', 
  authMiddleware.restrictTo('patient'),
  validationMiddleware.validate(updatePatientValidation),
  auditMiddleware.logUpdate('patient-profile'),
  updateMyProfileWithDI
);

// Admin/Staff/Doctor routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patients'),
    getPatientsWithDI
  )
  .post(
    authMiddleware.restrictTo('admin', 'staff'),
    validationMiddleware.validate(createPatientValidation),
    auditMiddleware.logCreation('patient'),
    createPatientWithDI
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patient'),
    getPatientWithDI
  )
  .put(
    validationMiddleware.validate(updatePatientValidation),
    auditMiddleware.logUpdate('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    updatePatientWithDI
  )
  .delete(
    authMiddleware.restrictTo('admin'),
    auditMiddleware.logDeletion('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    deletePatientWithDI
  );

// Medical history route
router.get(
  '/:id/medical-history',
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('medical-history'),
  getMedicalHistoryWithDI
);

export default router;