// src/routes/adminRoutes.mjs

import express from 'express';
import {
  getClinics,
  getClinic,
  updateClinicVerification,
  getClinicDocuments,
  getClinicStaff,
  suspendClinic,
  updateVerificationValidation
} from '../controllers/adminController.mjs';
import { 
  authMiddleware, 
  auditMiddleware,
  cacheMiddleware 
} from '../middleware/index.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);
router.use(authMiddleware.restrictTo('admin'));
router.use(authMiddleware.checkClinicStatus);

// Clinic management routes
router.get(
  '/clinics', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('clinics'),
  getClinics
);

router.get(
  '/clinics/:id', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('clinic'),
  getClinic
);

router.put(
  '/clinics/:id/verification', 
  updateVerificationValidation, 
  auditMiddleware.logUpdate('clinic-verification'),
  updateClinicVerification
);

router.get(
  '/clinics/:id/documents', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('clinic-documents'),
  getClinicDocuments
);

router.get(
  '/clinics/:id/staff', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('clinic-staff'),
  getClinicStaff
);

router.put(
  '/clinics/:id/suspend', 
  auditMiddleware.logUpdate('clinic-status'),
  suspendClinic
);

export default router;