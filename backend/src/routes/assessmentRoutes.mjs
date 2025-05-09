import express from 'express';
import assessmentController from '../controllers/assessmentController.mjs';
import { authMiddleware, auditMiddleware } from '../middleware/index.mjs';
import mongoose from 'mongoose';

const router = express.Router();

// Assume authentication middleware (protect) is applied upstream or here
// For now, using bypassAuth for simplicity based on original file
const { protect, restrictTo, bypassAuth } = authMiddleware;

// --- Routes under /assessments ---

// Start assessment (expects patientId, symptoms in body)
// Using /start path as defined in this file.
router.post(
    '/start', 
    protect, // Apply authentication check
    restrictTo('patient'), // Ensure only patients can start
    assessmentController.startAssessment
);

// Submit answers and generate report
router.post(
    '/:id/responses', 
    bypassAuth, // Replace with protect, restrictTo('patient') later
    assessmentController.submitAnswers // Renamed from saveResponses
);

// Get a specific assessment by its ID
router.get(
    '/:id', 
    bypassAuth, // Replace with protect, restrictTo('patient', 'doctor', 'admin', 'staff') later
    assessmentController.getAssessment
);

// Skip an assessment
router.post(
    '/:id/skip', 
    bypassAuth, // Replace with protect, restrictTo('patient') later
    assessmentController.skipAssessment
);

// --- Routes related to other resources ---

// Get assessment associated with a specific appointment
router.get(
    '/by-appointment/:appointmentId', 
    bypassAuth, // Replace with protect, restrictTo('patient', 'doctor', 'admin', 'staff') later
    assessmentController.getAssessmentByAppointment // Changed route slightly
);

// Check if an assessment exists for a specific appointment (without returning data)
router.get(
    '/exists/:appointmentId',
    bypassAuth, // Replace with protect, restrictTo('patient', 'doctor', 'admin', 'staff') later
    assessmentController.checkAssessmentExists
);

// Get all assessments for a specific patient (using query param)
router.get(
    '/', // Changed route from /patients/:id/assessments
    bypassAuth, // Replace with protect, restrictTo('patient', 'doctor', 'admin', 'staff') later
    (req, res, next) => { // Middleware to extract patientId from query
        if (!req.query.patientId) {
            return next(new Error('patientId query parameter is required'));
        }
        if (!mongoose.Types.ObjectId.isValid(req.query.patientId)) {
             return next(new Error('Invalid patientId query parameter'));
        }
        req.params.patientId = req.query.patientId; // Make it available for the controller
        next();
    },
    assessmentController.getPatientAssessments
);


// --- Deprecated Routes (to be removed) ---
/*
router.route('/patients/:id/assessments/:assessmentId/questions')
  .get(bypassAuth, assessmentController.getQuestions); // Removed

router.route('/patients/:id/assessments/:assessmentId/complete')
  .post(bypassAuth, assessmentController.completeAssessment); // Removed
*/

export default router; 