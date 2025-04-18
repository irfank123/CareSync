import assessmentService from '../services/assessmentService.mjs';
import { ApiResponse, ApiError } from '../utils/apiResponse.mjs';
import { validateObjectId } from '../utils/validation.mjs';

/**
 * Controller for handling assessment-related API endpoints
 */
class AssessmentController {
  /**
   * Start a new assessment for a patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async startAssessment(req, res, next) {
    try {
      const { appointmentId, symptoms } = req.body;
      const { id: patientId } = req.params;
      
      // Validate inputs
      if (!validateObjectId(appointmentId)) {
        return next(new ApiError('Invalid appointment ID', 400));
      }
      
      if (!validateObjectId(patientId)) {
        return next(new ApiError('Invalid patient ID', 400));
      }
      
      if (!symptoms || !Array.isArray(symptoms)) {
        return next(new ApiError('Symptoms must be provided as an array', 400));
      }
      
      // Create assessment with user ID for audit logging
      // For testing without auth, use a placeholder user ID
      const assessmentData = {
        patientId,
        appointmentId,
        symptoms,
        userId: req.user ? req.user._id : '64a3d2f78b008f15d8e6723c' // Use placeholder ID if no user
      };
      
      const assessment = await assessmentService.startAssessment(assessmentData);
      
      return res.status(201).json(
        new ApiResponse(true, 'Assessment started successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Generate questions for a specific assessment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getQuestions(req, res, next) {
    try {
      const { id: patientId, assessmentId } = req.params;
      
      // Validate assessment ID
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      
      const questions = await assessmentService.generateQuestions(assessmentId);
      
      return res.status(200).json(
        new ApiResponse(true, 'Questions generated successfully', questions)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Save responses to assessment questions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async saveResponses(req, res, next) {
    try {
      const { id: patientId, assessmentId } = req.params;
      const { responses } = req.body;
      
      // Validate assessment ID
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      
      // Validate responses
      if (!responses || !Array.isArray(responses)) {
        return next(new ApiError('Responses must be provided as an array', 400));
      }
      
      const assessment = await assessmentService.saveResponses(assessmentId, responses);
      
      return res.status(200).json(
        new ApiResponse(true, 'Responses saved successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Complete an assessment and generate report
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async completeAssessment(req, res, next) {
    try {
      const { id: patientId, assessmentId } = req.params;
      
      // Validate assessment ID
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      
      const assessment = await assessmentService.completeAssessment(assessmentId);
      
      return res.status(200).json(
        new ApiResponse(true, 'Assessment completed successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Skip an assessment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async skipAssessment(req, res, next) {
    try {
      const { id: patientId, assessmentId } = req.params;
      const { reason } = req.body;
      
      // Validate assessment ID
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      
      const assessment = await assessmentService.skipAssessment(assessmentId, reason);
      
      return res.status(200).json(
        new ApiResponse(true, 'Assessment skipped successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Get assessment by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAssessment(req, res, next) {
    try {
      const { id: patientId, assessmentId } = req.params;
      
      // Validate assessment ID
      if (!validateObjectId(assessmentId)) {
        return next(new ApiError('Invalid assessment ID', 400));
      }
      
      const assessment = await assessmentService.getAssessmentById(assessmentId);
      
      return res.status(200).json(
        new ApiResponse(true, 'Assessment retrieved successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Get all assessments for a patient
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getPatientAssessments(req, res, next) {
    try {
      const { id: patientId } = req.params;
      const { page, limit, sort, order } = req.query;
      
      // Validate patient ID
      if (!validateObjectId(patientId)) {
        return next(new ApiError('Invalid patient ID', 400));
      }
      
      const options = {
        page: parseInt(page) || 1,
        limit: parseInt(limit) || 10,
        sort: sort || 'creationDate',
        order: order === 'asc' ? 1 : -1
      };
      
      const result = await assessmentService.getPatientAssessments(patientId, options);
      
      return res.status(200).json(
        new ApiResponse(true, 'Assessments retrieved successfully', result)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
  
  /**
   * Get assessment for a specific appointment
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAssessmentByAppointment(req, res, next) {
    try {
      const { appointmentId } = req.params;
      
      // Validate appointment ID
      if (!validateObjectId(appointmentId)) {
        return next(new ApiError('Invalid appointment ID', 400));
      }
      
      const assessment = await assessmentService.getAssessmentByAppointment(appointmentId);
      
      if (!assessment) {
        return res.status(404).json(
          new ApiResponse(false, 'No assessment found for this appointment', null)
        );
      }
      
      return res.status(200).json(
        new ApiResponse(true, 'Assessment retrieved successfully', assessment)
      );
    } catch (error) {
      return next(new ApiError(error.message, 500));
    }
  }
}

export default new AssessmentController(); 