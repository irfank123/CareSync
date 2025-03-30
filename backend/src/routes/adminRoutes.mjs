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
import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);
router.use(authMiddleware.authorize('admin'));

// Clinic management routes
router.get('/clinics', getClinics);
router.get('/clinics/:id', getClinic);
router.put('/clinics/:id/verification', updateVerificationValidation, updateClinicVerification);
router.get('/clinics/:id/documents', getClinicDocuments);
router.get('/clinics/:id/staff', getClinicStaff);
router.put('/clinics/:id/suspend', suspendClinic);

export default router;