import express from 'express';
// Import the controller as a namespace
import * as prescriptionController from '../controllers/prescriptionController.mjs'; 
import authMiddleware from '../middleware/auth/authMiddleware.mjs';
import { auditMiddleware } from '../middleware/index.mjs'; // Assuming audit middleware might be useful
// Import validation if needed later

const router = express.Router();

// Protect all routes in this router
router.use(authMiddleware.authenticate);

// --- Patient-Specific Route --- 
// MUST be defined before the general /:id route
router.get(
  '/me',
  authMiddleware.restrictTo('patient'), // Only patients can access this
  // Add audit log if needed: auditMiddleware.logAccess('my-prescriptions'),
  prescriptionController.getMyPrescriptionsWithDI // Use the correct controller function
);

// Route to create a new prescription (Doctor only)
router.post(
  '/',
  authMiddleware.restrictTo('doctor'),
  auditMiddleware.logCreation('prescription'), // Example audit log
  // Add validation middleware here later if needed
  prescriptionController.createPrescriptionWithDI
);

// Route to get prescriptions for a specific patient (Doctor or the Patient themselves)
router.get(
  '/patient/:patientId',
  // Custom permission check middleware
  async (req, res, next) => {
    try {
      const requestedPatientId = req.params.patientId;
      const loggedInUserId = req.user._id;
      const loggedInUserRole = req.userRole;

      // Allow admin, doctor, staff
      if (['admin', 'doctor', 'staff'].includes(loggedInUserRole)) {
        return next(); 
      }

      // Allow patient to access their own records
      if (loggedInUserRole === 'patient') {
        // Need patientService to check if the logged-in user matches the requested patientId
        const { default: patientService } = await import('../services/patientService.mjs');
        const patientProfile = await patientService.getByUserId(loggedInUserId);
        if (patientProfile && patientProfile._id.toString() === requestedPatientId) {
          return next(); 
        }
      }

      // If none of the above, deny access
      return res.status(403).json({ success: false, message: 'Forbidden: You do not have permission to access these prescriptions.' });

    } catch (error) {
      console.error("Permission check error in prescription route:", error);
      next(error); // Pass error to global handler
    }
  },
  auditMiddleware.logAccess('patient-prescriptions'),
  prescriptionController.getPatientPrescriptionsWithDI
);

// Route to get a specific prescription by ID (Doctor or Patient involved)
router.get(
  '/:id',
  // TODO: Add specific permission check (is doctor or related patient)
  auditMiddleware.logAccess('prescription-detail'),
  prescriptionController.getPrescriptionByIdWithDI
);

// Route to update a prescription (e.g., cancel) (Doctor only)
router.put(
  '/:id',
  authMiddleware.restrictTo('doctor'),
  auditMiddleware.logUpdate('prescription'),
  // Add validation middleware here later if needed
  prescriptionController.updatePrescriptionWithDI
);

// Commenting out this route as getAllPrescriptionsWithDI is not defined/exported
/*
// Route to get all prescriptions for a patient (Doctor only)
router.get(
  '/all/:patientId',
  authMiddleware.restrictTo('doctor'),
  auditMiddleware.logAccess('patient-prescriptions'),
  prescriptionController.getAllPrescriptionsWithDI
);
*/

// Commenting out this route as deletePrescriptionWithDI is not defined/exported
/*
// Route to delete a prescription (Doctor only)
router.delete(
  '/:id',
  authMiddleware.restrictTo('doctor'),
  auditMiddleware.logDeletion('prescription'),
  prescriptionController.deletePrescriptionWithDI
);
*/

// Commenting out this route as getPrescriptionsByPatientWithDI is not defined/exported
/*
// Route to get prescriptions for a patient (Doctor only)
router.get(
  '/prescriptions/:patientId',
  authMiddleware.restrictTo('doctor'),
  auditMiddleware.logAccess('patient-prescriptions'),
  prescriptionController.getPrescriptionsByPatientWithDI
);
*/

// --- Patient-Specific Route WAS HERE --- MOVED UP

// --- Doctor/Admin Routes ---
// ... existing code ...

export default router; 