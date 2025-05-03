// src/routes/appointmentRoutes.mjs

import express from 'express';
import {
  getAppointmentsWithDI,
  getAppointmentWithDI,
  createAppointmentWithDI,
  updateAppointmentWithDI,
  deleteAppointmentWithDI,
  getPatientAppointmentsWithDI,
  getDoctorAppointmentsWithDI,
  getUpcomingAppointmentsWithDI,
  createAppointmentValidation,
  updateAppointmentValidation,
  getAppointmentTimeslot,
  getMyAppointmentsWithDI
} from '../controllers/appointmentController.mjs';
import authMiddleware from '../middleware/auth/authMiddleware.mjs';
import { auditMiddleware, cacheMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);

// Get upcoming appointments for the current user
router.get(
  '/upcoming', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  getUpcomingAppointmentsWithDI
);

// Get my appointments (for patients/doctors to view their own appointments)
router.get(
  '/me',
  authMiddleware.restrictTo('patient', 'doctor'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('my-appointments'),
  getMyAppointmentsWithDI
);

// Patient-specific routes
router.get(
  '/patient/:patientId',
  auditMiddleware.logAccess('patient-appointments'),
  getPatientAppointmentsWithDI
);

// Doctor-specific routes
router.get(
  '/doctor/:doctorId',
  auditMiddleware.logAccess('doctor-appointments'),
  getDoctorAppointmentsWithDI
);

// General appointment routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('appointments'),
    getAppointmentsWithDI
  )
  .post(
    createAppointmentValidation,
    auditMiddleware.logCreation('appointment'),
    createAppointmentWithDI
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(60), // Cache for 1 minute
    auditMiddleware.logAccess('appointment'),
    getAppointmentWithDI
  )
  .put(
    updateAppointmentValidation,
    auditMiddleware.logUpdate('appointment'),
    cacheMiddleware.clearCacheOnWrite('appointments'),
    updateAppointmentWithDI
  )
  .delete(
    authMiddleware.restrictTo('admin'),
    auditMiddleware.logDeletion('appointment'),
    cacheMiddleware.clearCacheOnWrite('appointments'),
    deleteAppointmentWithDI
  );

// Add the route for getting a timeslot
router.get('/timeslot/:id', getAppointmentTimeslot);

export default router;