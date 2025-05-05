import assessmentService from '../services/assessmentService.mjs';
import { ApiResponse, ApiError } from '../utils/apiResponse.mjs';
import { validateObjectId } from '../utils/validation.mjs';
import mongoose from 'mongoose';

/**
 * Controller for handling assessment-related API endpoints
 */
class AssessmentController {
  /**
   * Start a new assessment, generate questions, and return them.
   * Assumes patientId might come from authenticated user or request body.
   * @param {Object} req - Express request object (body: { appointmentId, symptoms, patientId? })
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async startAssessment(req, res, next) {
    try {
      const { appointmentId, symptoms } = req.body;
      const { patientId: patientIdFromParam } = req.params; // Get patient ID from URL param named 'patientId'
      const userId = req.user?._id; // ID of the user performing the action (for audit)

      // Use patientId from URL parameter primarily
      const patientId = patientIdFromParam; 

      if (!userId) {
         return next(new ApiError('User authentication required to start assessment', 401));
      }
      if (!patientId) {
          return next(new ApiError('Patient ID is required in the URL', 400));
      }
      if (!validateObjectId(appointmentId)) {
        return next(new ApiError('Invalid or missing appointment ID', 400));
      }
      if (!validateObjectId(patientId)) {
        return next(new ApiError('Invalid patient ID', 400));
      }
      if (!symptoms || !Array.isArray(symptoms) || symptoms.length === 0) {
        return next(new ApiError('Symptoms must be provided as a non-empty array', 400));
      }

      // Call the service to start assessment and get questions
      const { assessmentId, questions } = await assessmentService.startAssessment(
        patientId,
        appointmentId,
        symptoms,
        userId // Pass user ID for audit log
      );

      return res.status(201).json(
        new ApiResponse(true, 'Assessment started, questions generated', { assessmentId, questions })
      );
    } catch (error) {
      console.error("Start Assessment Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }
  
  /**
   * Submit answers, generate and save the AI report.
   * @param {Object} req - Express request object (params: {id}, body: { answers })
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async submitAnswers(req, res, next) {
    try {
      const { id: assessmentId } = req.params; 
      const { answers } = req.body;
      const userId = req.user?._id; // ID of the user performing the action

      if (!userId) {
         return next(new ApiError('User authentication required', 401));
      }
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      if (!answers || !Array.isArray(answers)) {
        return next(new ApiError('Answers must be provided as an array', 400));
      }

      // Call service to save answers and generate report
      const completedAssessment = await assessmentService.submitAnswersAndGenerateReport(
          assessmentId, 
          answers, 
          userId
      );

      return res.status(200).json(
        new ApiResponse(true, 'Answers submitted and report generated successfully', completedAssessment)
      );
    } catch (error) {
      console.error("Submit Answers Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }

  /**
   * Skip an assessment.
   * @param {Object} req - Express request object (params: {id}, body: { reason })
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async skipAssessment(req, res, next) {
    try {
      const { id: assessmentId } = req.params; // Assuming route is /assessments/:id/skip
      const { reason } = req.body;
      const userId = req.user?._id; // ID of the user performing the action

      if (!userId) {
         return next(new ApiError('User authentication required', 401));
      }
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }

      const assessment = await assessmentService.skipAssessment(assessmentId, reason, userId);

      return res.status(200).json(
        new ApiResponse(true, 'Assessment skipped successfully', assessment)
      );
    } catch (error) {
       console.error("Skip Assessment Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }

  /**
   * Get assessment by Assessment ID.
   * @param {Object} req - Express request object (params: {id})
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAssessment(req, res, next) {
    try {
      const { id: assessmentId } = req.params; // Assuming route is /assessments/:id
      
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }

      // TODO: Add permission check - only involved parties or admin/staff

      const assessment = await assessmentService.getAssessmentById(assessmentId);

      return res.status(200).json(
        new ApiResponse(true, 'Assessment retrieved successfully', assessment)
      );
    } catch (error) {
      console.error("Get Assessment Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }

  /**
   * Get assessment for a specific appointment.
   * @param {Object} req - Express request object (params: {appointmentId})
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAssessmentByAppointment(req, res, next) {
    try {
      const { appointmentId } = req.params; // Assuming route is /appointments/:appointmentId/assessment

      if (!validateObjectId(appointmentId)) {
        return next(new ApiError('Invalid appointment ID', 400));
      }

      // TODO: Add permission check - only involved parties or admin/staff

      const assessment = await assessmentService.getAssessmentForAppointment(appointmentId);

      if (!assessment) {
        // It's not an error if no assessment exists, just return empty
        return res.status(200).json(
          new ApiResponse(true, 'No assessment found for this appointment', null)
        );
      }

      return res.status(200).json(
        new ApiResponse(true, 'Assessment retrieved successfully', assessment)
      );
    } catch (error) {
       console.error("Get Assessment By Appointment Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }

  /**
   * Get all assessments for a specific patient (paginated).
   * @param {Object} req - Express request object (params: {patientId}, query: { page, limit, sort, order })
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getPatientAssessments(req, res, next) {
    try {
      const { patientId } = req.params; // Assuming route is /patients/:patientId/assessments
      const { page, limit, sort, order } = req.query;
      
      if (!validateObjectId(patientId)) {
        return next(new ApiError('Invalid patient ID', 400));
      }

      // TODO: Add permission check - only patient themselves or admin/staff/doctor

      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: sort || 'creationDate',
        order: order === 'asc' ? 1 : -1
      };

      const result = await assessmentService.getPatientAssessments(patientId, options);

      return res.status(200).json(
        new ApiResponse(true, 'Patient assessments retrieved successfully', result)
      );
    } catch (error) {
       console.error("Get Patient Assessments Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }

  /**
   * Check if an assessment exists for a specific appointment without returning data.
   * @param {Object} req - Express request object (params: {appointmentId})
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async checkAssessmentExists(req, res, next) {
    try {
      const { appointmentId } = req.params;

      if (!validateObjectId(appointmentId)) {
        return next(new ApiError('Invalid appointment ID', 400));
      }

      // Just check if assessment exists
      const assessment = await assessmentService.getAssessmentForAppointment(appointmentId);

      return res.status(200).json(
        new ApiResponse(true, 'Assessment existence check completed', { 
          exists: !!assessment,
          appointmentId
        })
      );
    } catch (error) {
      console.error("Check Assessment Exists Controller Error:", error);
      return next(new ApiError(error.message, error.statusCode || 500));
    }
  }
}

// Helper can likely be removed if not needed elsewhere, assuming patientService handles this
// assessmentService.getPatientIdForUser = async function(userId) { ... };

export default new AssessmentController(); 