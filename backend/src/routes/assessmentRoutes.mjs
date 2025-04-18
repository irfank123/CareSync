import express from 'express';
import assessmentController from '../controllers/assessmentController.mjs';
import { authMiddleware, auditMiddleware } from '../middleware/index.mjs';

const router = express.Router();

// Authentication middleware
const { protect, restrictTo, bypassAuth } = authMiddleware;

// TEMPORARY: For testing without authentication
// Remove this comment and restore the authentication middleware later

// Assessment routes under patient context
router.route('/patients/:id/assessments')
  .get(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logAccess('assessment'),
    assessmentController.getPatientAssessments
  );

router.route('/patients/:id/assessments/start')
  .post(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logCreation('assessment'),
    assessmentController.startAssessment
  );

router.route('/patients/:id/assessments/:assessmentId')
  .get(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logAccess('assessment'),
    assessmentController.getAssessment
  );

router.route('/patients/:id/assessments/:assessmentId/questions')
  .get(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logAccess('assessment'),
    assessmentController.getQuestions
  );

router.route('/patients/:id/assessments/:assessmentId/responses')
  .post(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logUpdate('assessment'),
    assessmentController.saveResponses
  );

router.route('/patients/:id/assessments/:assessmentId/complete')
  .post(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logUpdate('assessment'),
    assessmentController.completeAssessment
  );

router.route('/patients/:id/assessments/:assessmentId/skip')
  .post(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logUpdate('assessment'),
    assessmentController.skipAssessment
  );

// Additional route to get assessment by appointment
router.route('/appointments/:appointmentId/assessment')
  .get(
    bypassAuth,
    // restrictTo('patient', 'doctor', 'admin', 'staff'),
    // auditMiddleware.logAccess('assessment'),
    assessmentController.getAssessmentByAppointment
  );

export default router; 