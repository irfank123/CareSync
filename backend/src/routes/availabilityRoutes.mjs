// src/routes/availabilityRoutes.mjs

import express from 'express';
import {
  getTimeSlots,
  getAvailableTimeSlots,
  createTimeSlot,
  updateTimeSlot,
  deleteTimeSlot,
  getTimeSlotById,
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

// Middleware to ensure no caching for available slots
const noCacheMiddleware = (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Expires', '0');
  res.set('Pragma', 'no-cache');
  res.set('X-Cache-Disabled', 'true');
  next();
};

// Public routes for viewing availability
router.get(
  '/doctor/:doctorId/slots', 
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  cacheMiddleware.setCacheHeaders({ isPublic: true, maxAge: 300 }), // 5 minutes for public caching
  getTimeSlots
);

router.get(
  '/doctor/:doctorId/slots/available', 
  noCacheMiddleware, // Ensure no caching for available slots which change frequently
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

// Get a specific timeslot by ID with formatted date
router.get('/timeslot/:id', getTimeSlotById);

// Add a simple test route to verify the router is working
router.get('/test-route', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Availability router is working correctly',
    timestamp: new Date()
  });
});

export default router;