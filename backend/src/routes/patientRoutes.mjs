// src/routes/patientRoutes.mjs

import express from 'express';
import mongoose from 'mongoose';
import {
  getPatientsWithDI,
  getPatientWithDI,
  createPatientWithDI,
  updatePatientWithDI,
  deletePatientWithDI,
  getMyProfileWithDI,
  updateMyProfileWithDI,
  getMedicalHistoryWithDI,
  createPatientValidation,
  updatePatientValidation
} from '../controllers/patientController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  permissionMiddleware,
  auditMiddleware,
  dataMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';

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
  getMyProfileWithDI
);

// Route to get patient by user ID - must be before /:id route
router.get(
  '/user/:userId',
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      console.log('GET patient by userId request:', {
        userId: req.params.userId,
        url: req.originalUrl,
        method: req.method
      });
      
      const { Patient } = await import('../models/index.mjs');
      const userId = req.params.userId;
      console.log('Looking up patient with userId:', userId);
      
      // Ensure the userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log('Invalid userId format:', userId);
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }
      
      const patient = await Patient.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      console.log('Patient lookup result:', patient ? 'Found' : 'Not found');
      
      if (!patient) {
        console.log('Patient not found for userId:', userId);
        return res.status(404).json({
          success: false,
          message: 'Patient not found for this user'
        });
      }
      
      console.log('Returning patient info for userId:', userId, 'patientId:', patient._id);
      res.status(200).json({
        success: true,
        data: patient
      });
    } catch (err) {
      console.error('Error fetching patient by user ID:', err);
      res.status(500).json({
        success: false,
        message: 'Error fetching patient profile',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

router.put(
  '/me', 
  authMiddleware.restrictTo('patient'),
  validationMiddleware.validate(updatePatientValidation),
  auditMiddleware.logUpdate('patient-profile'),
  updateMyProfileWithDI
);

// Admin/Staff/Doctor routes
router.route('/')
  .get(
    authMiddleware.restrictTo('admin', 'doctor', 'staff'),
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patients'),
    getPatientsWithDI
  )
  .post(
    authMiddleware.restrictTo('admin', 'staff'),
    validationMiddleware.validate(createPatientValidation),
    auditMiddleware.logCreation('patient'),
    createPatientWithDI
  );

router.route('/:id')
  .get(
    cacheMiddleware.cacheResponse(120), // Cache for 2 minutes
    auditMiddleware.logAccess('patient'),
    getPatientWithDI
  )
  .put(
    validationMiddleware.validate(updatePatientValidation),
    auditMiddleware.logUpdate('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    updatePatientWithDI
  )
  .delete(
    authMiddleware.restrictTo('admin'),
    auditMiddleware.logDeletion('patient'),
    cacheMiddleware.clearCacheOnWrite('patients'),
    deletePatientWithDI
  );

// Medical history route
router.get(
  '/:id/medical-history',
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('medical-history'),
  getMedicalHistoryWithDI
);

export default router;