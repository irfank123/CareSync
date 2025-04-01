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
  getDoctorAvailability,
  createDoctorValidation,
  updateDoctorValidation
} from '../controllers/doctorController.mjs';
import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Public doctor listing could be unprotected if needed
router.get('/', getDoctors);
router.get('/:id', getDoctor);
router.get('/:id/availability', getDoctorAvailability);

// Protect remaining routes
router.use(authMiddleware.authenticate);

// Doctor-specific routes (for doctor users)
router.get('/me', getMyProfile);
router.put('/me', updateDoctorValidation, updateMyProfile);

// Admin/Staff routes
router.post('/', authMiddleware.restrictTo('admin', 'staff'), createDoctorValidation, createDoctor);
router.put('/:id', updateDoctorValidation, updateDoctor); // Auth checking is done in the controller
router.delete('/:id', authMiddleware.restrictTo('admin'), deleteDoctor);

export default router;