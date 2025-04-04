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
import { 
  authMiddleware, 
  auditMiddleware,
  cacheMiddleware 
} from '../middleware/index.mjs';

const router = express.Router();

// Public routes for viewing availability
router.get(
  '/doctor/:doctorId/slots', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  cacheMiddleware.setCacheHeaders({ isPublic: true, maxAge: 300 }), // 5 minutes for public caching
  getTimeSlots
);

router.get(
  '/doctor/:doctorId/slots/available', 
  cacheMiddleware.cacheResponse(30), // Cache for 30 seconds
  cacheMiddleware.setCacheHeaders({ isPublic: true, maxAge: 300 }), // 5 minutes for public caching
  getAvailableTimeSlots
);

// Protected routes for managing availability
router.use(authMiddleware.authenticate);

// Time slot management
router.route('/slots')
  .post(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
    createTimeSlotValidation,
    auditMiddleware.logCreation('timeslot'),
    cacheMiddleware.clearCacheOnWrite('timeslots'),
    createTimeSlot
  );

router.route('/slots/:slotId')
  .put(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    updateTimeSlotValidation,
    auditMiddleware.logUpdate('timeslot'),
    cacheMiddleware.clearCacheOnWrite('timeslots'),
    updateTimeSlot
  )
  .delete(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    auditMiddleware.logDeletion('timeslot'),
    cacheMiddleware.clearCacheOnWrite('timeslots'),
    deleteTimeSlot
  );

// Schedule generation, import/export
router.post(
  '/doctor/:doctorId/generate', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  auditMiddleware.logCreation('timeslots'),
  cacheMiddleware.clearCacheOnWrite('timeslots'),
  generateTimeSlots
);

// Google Calendar integration
router.post(
  '/doctor/:doctorId/import/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  auditMiddleware.logCreation('timeslots'),
  cacheMiddleware.clearCacheOnWrite('timeslots'),
  importFromGoogle
);

router.post(
  '/doctor/:doctorId/export/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  auditMiddleware.logUpdate('timeslots'),
  exportToGoogle
);

router.post(
  '/doctor/:doctorId/sync/google', 
  authMiddleware.restrictTo('admin', 'doctor', 'staff'), 
  auditMiddleware.logUpdate('timeslots'),
  cacheMiddleware.clearCacheOnWrite('timeslots'),
  syncWithGoogle
);

export default router;