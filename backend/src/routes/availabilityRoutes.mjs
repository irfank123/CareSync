// src/routes/availabilityRoutes.mjs

import express from 'express';
import {
  getTimeSlots,
  getAvailableTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  generateTimeSlots,
  importFromGoogle,
  exportToGoogle,
  syncWithGoogle,
  createTimeSlotValidation,
  updateTimeSlotValidation
} from '../controllers/availabilityController.mjs';
import authMiddleware from '../middleware/authMiddleware.mjs';

const router = express.Router();

// Public routes for viewing availability
router.get('/doctor/:doctorId/slots', getTimeSlots);
router.get('/doctor/:doctorId/slots/available', getAvailableTimeSlots);

// Protected routes for managing availability
router.use(authMiddleware.authenticate);

// Time slot management
router.route('/slots')
  .post(authMiddleware.restrictTo('admin', 'doctor', 'staff'), createTimeSlotValidation, createTimeSlot);

router.route('/slots/:slotId')
  .put(authMiddleware.restrictTo('admin', 'doctor', 'staff'), updateTimeSlotValidation, updateTimeSlot)
  .delete(authMiddleware.restrictTo('admin', 'doctor', 'staff'), deleteTimeSlot);

// Schedule generation, import/export
router.post('/doctor/:doctorId/generate', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  generateTimeSlots);

// Google Calendar integration
router.post('/doctor/:doctorId/import/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  importFromGoogle);

router.post('/doctor/:doctorId/export/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  exportToGoogle);

router.post('/doctor/:doctorId/sync/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  syncWithGoogle);

export default router;