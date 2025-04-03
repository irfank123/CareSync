// src/routes/appointmentRoutes.mjs

import express from 'express';
import {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getUpcomingAppointments,
  createAppointmentValidation,
  updateAppointmentValidation
} from '../controllers/appointmentController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);

// Get upcoming appointments for the current user
router.get('/upcoming', getUpcomingAppointments);

// Patient-specific routes
router.get('/patient/:patientId', getPatientAppointments);

// Doctor-specific routes
router.get('/doctor/:doctorId', getDoctorAppointments);

// General appointment routes
router.route('/')
  .get(authMiddleware.restrictTo('admin', 'doctor', 'staff'), getAppointments)
  .post(createAppointmentValidation, createAppointment);

router.route('/:id')
  .get(getAppointment)
  .put(updateAppointmentValidation, updateAppointment)
  .delete(authMiddleware.restrictTo('admin'), deleteAppointment);

export default router;