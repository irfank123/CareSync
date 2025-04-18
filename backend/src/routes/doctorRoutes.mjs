// src/routes/doctorRoutes.mjs

import express from 'express';
import mongoose from 'mongoose';
import {
  getDoctorsWithDI,
  getDoctorWithDI,
  createDoctorWithDI,
  updateDoctorWithDI,
  deleteDoctorWithDI,
  getMyProfileWithDI,
  updateMyProfileWithDI,
  getDoctorAvailabilityWithDI,
  createDoctorValidation,
  updateDoctorValidation
} from '../controllers/doctorController.mjs';
import { 
  authMiddleware, 
  validationMiddleware, 
  permissionMiddleware,
  auditMiddleware,
  dataMiddleware,
  cacheMiddleware
} from '../middleware/index.mjs';
import doctorService from '../services/doctorService.mjs';

const router = express.Router();

// Public routes
router.get(
  '/', 
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  getDoctorsWithDI
);

// Route to get doctor by user ID - must be before /:id route
router.get(
  '/user/:userId',
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  async (req, res) => {
    try {
      console.log('GET doctor by userId request:', {
        userId: req.params.userId,
        url: req.originalUrl,
        method: req.method
      });
      
      const { Doctor } = await import('../models/index.mjs');
      const userId = req.params.userId;
      console.log('Looking up doctor with userId:', userId);
      
      // Ensure the userId is a valid ObjectId
      if (!mongoose.Types.ObjectId.isValid(userId)) {
        console.log('Invalid userId format:', userId);
        return res.status(400).json({
          success: false,
          message: 'Invalid user ID format'
        });
      }
      
      const doctor = await Doctor.findOne({ userId: new mongoose.Types.ObjectId(userId) });
      console.log('Doctor lookup result:', doctor ? 'Found' : 'Not found');
      
      if (!doctor) {
        console.log('Doctor not found for userId:', userId);
        return res.status(404).json({
          success: false,
          message: 'Doctor not found for this user'
        });
      }
      
      console.log('Returning doctor info for userId:', userId, 'doctorId:', doctor._id);
      res.status(200).json({
        success: true,
        data: doctor
      });
    } catch (err) {
      console.error('Error fetching doctor by user ID:', err);
      res.status(500).json({
        success: false,
        message: 'Error fetching doctor profile',
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  }
);

router.get(
  '/:id', 
  cacheMiddleware.cacheResponse(300), // Cache for 5 minutes
  getDoctorWithDI
);

router.get(
  '/:id/availability',
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  cacheMiddleware.setCacheHeaders({ public: true, maxAge: 300 }),
  getDoctorAvailabilityWithDI
);

// Protect remaining routes with authentication
router.use(authMiddleware.authenticate);

// Apply data middleware for consistent responses
router.use(dataMiddleware.formatResponse);

// Doctor-specific routes (for doctor users)
router.get(
  '/me', 
  authMiddleware.restrictTo('doctor'),
  cacheMiddleware.cacheResponse(60), // Cache for 1 minute
  auditMiddleware.logAccess('doctor-profile'),
  getMyProfileWithDI
);

router.put(
  '/me', 
  authMiddleware.restrictTo('doctor'),
  validationMiddleware.validate([
    validationMiddleware.rules.doctor.specialties.optional(),
    validationMiddleware.rules.doctor.licenseNumber.optional()
  ]),
  auditMiddleware.logUpdate('doctor-profile'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  updateMyProfileWithDI
);

// Admin/Staff routes
router.post(
  '/', 
  authMiddleware.restrictTo('admin', 'staff'),
  validationMiddleware.validate([
    validationMiddleware.rules.user.userId,
    validationMiddleware.rules.doctor.specialties,
    validationMiddleware.rules.doctor.licenseNumber,
    validationMiddleware.rules.doctor.appointmentFee
  ]),
  auditMiddleware.logCreation('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  createDoctorWithDI
);

router.put(
  '/:id',
  permissionMiddleware.isOwnerOrAdmin(doctorService.getDoctorUserId.bind(doctorService)),
  validationMiddleware.validate([
    validationMiddleware.rules.doctor.specialties.optional(),
    validationMiddleware.rules.doctor.licenseNumber.optional(),
    validationMiddleware.rules.doctor.appointmentFee.optional()
  ]),
  auditMiddleware.logUpdate('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  updateDoctorWithDI
);

router.delete(
  '/:id',
  authMiddleware.restrictTo('admin'),
  auditMiddleware.logDeletion('doctor'),
  cacheMiddleware.clearCacheOnWrite('doctors'),
  deleteDoctorWithDI
);

// Temporary endpoint to create a doctor record for a user
router.post(
  '/create-for-user/:userId',
  async (req, res) => {
    try {
      console.log('Creating doctor for userId:', req.params.userId);
      
      const { Doctor, User } = await import('../models/index.mjs');
      
      // Check if user exists
      const user = await User.findById(req.params.userId);
      if (!user) {
        console.log('User not found:', req.params.userId);
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }
      
      // Check if doctor already exists
      const existingDoctor = await Doctor.findOne({ userId: req.params.userId });
      if (existingDoctor) {
        console.log('Doctor already exists for user:', req.params.userId);
        return res.status(200).json({
          success: true,
          data: existingDoctor,
          message: 'Doctor already exists for this user'
        });
      }
      
      // Create doctor record
      const doctor = await Doctor.create({
        userId: req.params.userId,
        specialties: req.body.specialties || ['General Medicine'],
        licenseNumber: req.body.licenseNumber || `TMP-${Date.now()}`,
        appointmentFee: req.body.appointmentFee || 50,
        acceptingNewPatients: true
      });
      
      console.log('Created new doctor record:', doctor._id);
      
      res.status(201).json({
        success: true,
        data: doctor
      });
    } catch (err) {
      console.error('Error creating doctor for user:', err);
      res.status(500).json({
        success: false,
        message: 'Error creating doctor record'
      });
    }
  }
);

export default router;