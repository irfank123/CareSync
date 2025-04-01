// src/routes/patientRoutes.mjs

import express from 'express';
import patientController from '../controllers/patientController.mjs';
import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Protect all routes
router.use(authMiddleware.authenticate);

// Patient-specific routes (for patient users)
router.get('/me', patientController.getMyProfile);
router.put('/me', patientController.updatePatientValidation, patientController.updateMyProfile);

// Admin/Staff/Doctor routes
router.route('/')
  .get(authMiddleware.restrictTo('admin', 'doctor', 'staff'), patientController.getPatients)
  .post(authMiddleware.restrictTo('admin', 'staff'), patientController.createPatientValidation, patientController.createPatient);

router.route('/:id')
  .get(patientController.getPatient) // Auth checking is done in the controller
  .put(patientController.updatePatientValidation, patientController.updatePatient) // Auth checking is done in the controller
  .delete(authMiddleware.restrictTo('admin'), patientController.deletePatient);

// Medical history route
router.get('/:id/medical-history', patientController.getMedicalHistory); // Auth checking is done in the controller

export default router;