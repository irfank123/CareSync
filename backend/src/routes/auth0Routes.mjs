// src/routes/auth0Routes.mjs

import express from 'express';
import { 
  initiateClinicAuth0LoginWithDI,
  handleClinicAuth0CallbackWithDI
} from '../controllers/clinicAuthController.mjs'; // Still use same controller
import { auditMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// --- Auth0 Routes for Clinic ---
// These should be PUBLIC

// Route to initiate Auth0 login/signup for clinics
/*
router.get(
  '/clinic/login', // Path relative to mount point (e.g., /api/auth0/clinic/login)
  auditMiddleware.logAuth('clinic-auth0-initiate'), 
  initiateClinicAuth0LoginWithDI
);
*/

// Route for Auth0 callback
// /*
router.get(
  '/clinic/callback', // Path relative to mount point (e.g., /api/auth0/clinic/callback)
  auditMiddleware.logAuth('clinic-auth0-callback'), 
  handleClinicAuth0CallbackWithDI
);
// */

// TODO: Add Auth0 routes for Patients/Doctors if needed later

export default router; 