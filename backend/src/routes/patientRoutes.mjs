// src/routes/patientRoutes.mjs

import express from 'express';
import {
  getPatients,
  getPatient,
  createPatient,
  updatePatient,
  deletePatient,
  getMyProfile,
  updateMyProfile,
  getMedicalHistory
} from '../controllers/patientController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  permissionMiddleware,
  auditMiddleware,
  dataMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';
import patientService from '../services/patientService.mjs';

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
  getMyProfile
);

router.put(
  '/me', 
  authMiddleware.restrictTo('patient'),
  validationMiddleware.validate(validationMiddleware.rules.patient.updateProfile),
  auditMiddleware.logUpdate('patient-profile'),
  updateMyProfile
);

// Admin/Staff/Doctor routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patients'),
    getPatients
  )
  .post(
    authMiddleware.restrictTo('admin', 'staff'),
    validationMiddleware.validate([
      validationMiddleware.rules.patient.userId,
      validationMiddleware.rules.patient.dateOfBirth,
      validationMiddleware.rules.patient.gender
    ]),
    auditMiddleware.logCreation('patient'),
    createPatient
  );

router.route('/:id')
  .get(
    // Custom permission check for patient self-access
    permissionMiddleware.isOwnerOrAdmin(patientService.getPatientUserId.bind(patientService)),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patient'),
    getPatient
  )
  .put(
    // Custom permission check for patient self-access
    permissionMiddleware.isOwnerOrAdmin(patientService.getPatientUserId.bind(patientService)),
    validationMiddleware.validate([
      validationMiddleware.rules.patient.dateOfBirth.optional(),
      validationMiddleware.rules.patient.gender.optional()
    ]),
    auditMiddleware.logUpdate('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    updatePatient
  )
  .delete(
    authMiddleware.restrictTo('admin'),
    auditMiddleware.logDeletion('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    deletePatient
  );

// Medical history route
router.get(
  '/:id/medical-history',
  permissionMiddleware.isOwnerOrAdmin(patientService.getPatientUserId.bind(patientService)),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('medical-history'),
  getMedicalHistory
);

export default router;