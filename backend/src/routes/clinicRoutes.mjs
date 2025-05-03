// src/routes/clinicRoutes.mjs

import express from 'express';
import { authMiddleware, auditMiddleware } from '../middleware/index.mjs';
import { createClinicWithDI, createClinicValidation } from '../controllers/clinicController.mjs';

const router = express.Router();

// All routes in this file require authentication
router.use(authMiddleware.authenticate);

// Route to create a new clinic
router.post(
  '/', 
  createClinicValidation, // Add validation middleware
  authMiddleware.authorizeClinicAdminCreation, // Add specific authorization middleware
  auditMiddleware.logCreation('clinic'), // Corrected method name: logCreation
  createClinicWithDI // Controller method
);

// TODO: Add other clinic management routes (GET /, GET /:id, PUT /:id, etc.) later

export default router; 