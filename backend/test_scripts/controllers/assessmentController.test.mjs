import mongoose from 'mongoose';
import { ApiResponse, ApiError } from '../../src/utils/apiResponse.mjs';
import { validateObjectId } from '../../src/utils/validation.mjs';

// Mock dependencies
jest.mock('../../src/services/assessmentService.mjs', () => ({
  startAssessment: jest.fn(),
  submitAnswersAndGenerateReport: jest.fn(),
  skipAssessment: jest.fn(),
  getAssessmentById: jest.fn(),
  getAssessmentForAppointment: jest.fn(),
  getPatientAssessments: jest.fn()
}));

jest.mock('../../src/utils/validation.mjs', () => ({
  validateObjectId: jest.fn()
}));

// Import controller after mocks are set up
import assessmentController from '../../src/controllers/assessmentController.mjs';
import assessmentService from '../../src/services/assessmentService.mjs';

describe('Assessment Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { _id: 'user123' },
      userRole: 'admin'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
  });
  
  describe('startAssessment', () => {
    test('should start an assessment successfully', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.body = {
        appointmentId: 'appointment123',
        symptoms: ['fever', 'cough']
      };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.startAssessment.mockResolvedValue({
        assessmentId: 'assessment123',
        questions: ['question1', 'question2']
      });
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('appointment123');
      expect(validateObjectId).toHaveBeenCalledWith('patient123');
      expect(assessmentService.startAssessment).toHaveBeenCalledWith(
        'patient123',
        'appointment123',
        ['fever', 'cough'],
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment started, questions generated',
          data: {
            assessmentId: 'assessment123',
            questions: ['question1', 'question2']
          }
        })
      );
    });
    
    test('should handle missing user authentication', async () => {
      // Arrange
      req.user = null;
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User authentication required to start assessment',
          statusCode: 401
        })
      );
    });
    
    test('should handle missing patient ID', async () => {
      // Arrange
      req.params = {};
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Patient ID is required in the URL',
          statusCode: 400
        })
      );
    });
    
    test('should handle invalid appointment ID', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.body = {
        appointmentId: 'invalid-id',
        symptoms: ['fever', 'cough']
      };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid or missing appointment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle invalid patient ID', async () => {
      // Arrange
      req.params = { patientId: 'invalid-id' };
      req.body = {
        appointmentId: 'appointment123',
        symptoms: ['fever', 'cough']
      };
      
      validateObjectId
        .mockReturnValueOnce(true) // appointmentId is valid
        .mockReturnValueOnce(false); // patientId is invalid
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid patient ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle missing or invalid symptoms', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.body = {
        appointmentId: 'appointment123',
        symptoms: [] // Empty array
      };
      
      validateObjectId.mockReturnValue(true);
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Symptoms must be provided as a non-empty array',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.body = {
        appointmentId: 'appointment123',
        symptoms: ['fever', 'cough']
      };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.startAssessment.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  describe('submitAnswers', () => {
    test('should submit answers successfully', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = {
        answers: [
          { questionId: 'q1', answer: 'Yes' },
          { questionId: 'q2', answer: 'No' }
        ]
      };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.submitAnswersAndGenerateReport.mockResolvedValue({
        _id: 'assessment123',
        status: 'completed',
        aiGeneratedReport: 'Report content'
      });
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('assessment123');
      expect(assessmentService.submitAnswersAndGenerateReport).toHaveBeenCalledWith(
        'assessment123',
        [
          { questionId: 'q1', answer: 'Yes' },
          { questionId: 'q2', answer: 'No' }
        ],
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Answers submitted and report generated successfully',
          data: expect.objectContaining({
            _id: 'assessment123',
            status: 'completed'
          })
        })
      );
    });
    
    test('should handle missing user authentication', async () => {
      // Arrange
      req.user = null;
      req.params = { id: 'assessment123' };
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User authentication required',
          statusCode: 401
        })
      );
    });
    
    test('should handle invalid assessment ID', async () => {
      // Arrange
      req.params = { id: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid assessment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle missing or invalid answers', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = {
        answers: 'not an array' // Not an array
      };
      
      validateObjectId.mockReturnValue(true);
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Answers must be provided as an array',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = {
        answers: [
          { questionId: 'q1', answer: 'Yes' }
        ]
      };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.submitAnswersAndGenerateReport.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  describe('skipAssessment', () => {
    test('should skip assessment successfully', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = { reason: 'Patient declined' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.skipAssessment.mockResolvedValue({
        _id: 'assessment123',
        status: 'skipped',
        skipReason: 'Patient declined'
      });
      
      // Act
      await assessmentController.skipAssessment(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('assessment123');
      expect(assessmentService.skipAssessment).toHaveBeenCalledWith(
        'assessment123',
        'Patient declined',
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment skipped successfully',
          data: expect.objectContaining({
            _id: 'assessment123',
            status: 'skipped'
          })
        })
      );
    });
    
    test('should handle missing user authentication', async () => {
      // Arrange
      req.user = null;
      req.params = { id: 'assessment123' };
      
      // Act
      await assessmentController.skipAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'User authentication required',
          statusCode: 401
        })
      );
    });
    
    test('should handle invalid assessment ID', async () => {
      // Arrange
      req.params = { id: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.skipAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid assessment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = { reason: 'Patient declined' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.skipAssessment.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.skipAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  describe('getAssessment', () => {
    test('should get assessment by ID successfully', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentById.mockResolvedValue({
        _id: 'assessment123',
        patientId: 'patient123',
        appointmentId: 'appointment123',
        status: 'completed'
      });
      
      // Act
      await assessmentController.getAssessment(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('assessment123');
      expect(assessmentService.getAssessmentById).toHaveBeenCalledWith('assessment123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment retrieved successfully',
          data: expect.objectContaining({
            _id: 'assessment123',
            status: 'completed'
          })
        })
      );
    });
    
    test('should handle invalid assessment ID', async () => {
      // Arrange
      req.params = { id: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.getAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid assessment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentById.mockRejectedValue(new Error('Assessment not found'));
      
      // Act
      await assessmentController.getAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Assessment not found',
          statusCode: 500
        })
      );
    });
  });
  
  describe('getAssessmentByAppointment', () => {
    test('should get assessment by appointment ID successfully', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockResolvedValue({
        _id: 'assessment123',
        patientId: 'patient123',
        appointmentId: 'appointment123',
        status: 'completed'
      });
      
      // Act
      await assessmentController.getAssessmentByAppointment(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('appointment123');
      expect(assessmentService.getAssessmentForAppointment).toHaveBeenCalledWith('appointment123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment retrieved successfully',
          data: expect.objectContaining({
            _id: 'assessment123',
            status: 'completed'
          })
        })
      );
    });
    
    test('should handle case when no assessment exists for appointment', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockResolvedValue(null);
      
      // Act
      await assessmentController.getAssessmentByAppointment(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'No assessment found for this appointment',
          data: null
        })
      );
    });
    
    test('should handle invalid appointment ID', async () => {
      // Arrange
      req.params = { appointmentId: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.getAssessmentByAppointment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid appointment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.getAssessmentByAppointment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  describe('getPatientAssessments', () => {
    test('should get patient assessments successfully with default pagination', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getPatientAssessments.mockResolvedValue({
        assessments: [
          { _id: 'assessment1', status: 'completed' },
          { _id: 'assessment2', status: 'in-progress' }
        ],
        pagination: {
          total: 2,
          page: 1,
          limit: 10,
          pages: 1
        }
      });
      
      // Act
      await assessmentController.getPatientAssessments(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('patient123');
      expect(assessmentService.getPatientAssessments).toHaveBeenCalledWith('patient123', {
        page: 1,
        limit: 10,
        sort: 'creationDate',
        order: -1
      });
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Patient assessments retrieved successfully',
          data: expect.objectContaining({
            assessments: expect.arrayContaining([
              expect.objectContaining({ _id: 'assessment1' }),
              expect.objectContaining({ _id: 'assessment2' })
            ]),
            pagination: expect.objectContaining({
              total: 2,
              page: 1
            })
          })
        })
      );
    });
    
    test('should get patient assessments with custom pagination', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.query = {
        page: '2',
        limit: '5',
        sort: 'status',
        order: 'asc'
      };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getPatientAssessments.mockResolvedValue({
        assessments: [{ _id: 'assessment3', status: 'completed' }],
        pagination: {
          total: 8,
          page: 2,
          limit: 5,
          pages: 2
        }
      });
      
      // Act
      await assessmentController.getPatientAssessments(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('patient123');
      expect(assessmentService.getPatientAssessments).toHaveBeenCalledWith('patient123', {
        page: 2,
        limit: 5,
        sort: 'status',
        order: 1 // asc = 1
      });
    });
    
    test('should handle invalid patient ID', async () => {
      // Arrange
      req.params = { patientId: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.getPatientAssessments(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid patient ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getPatientAssessments.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.getPatientAssessments(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  describe('checkAssessmentExists', () => {
    test('should check if assessment exists for appointment successfully - exists', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockResolvedValue({
        _id: 'assessment123',
        status: 'completed'
      });
      
      // Act
      await assessmentController.checkAssessmentExists(req, res, next);
      
      // Assert
      expect(validateObjectId).toHaveBeenCalledWith('appointment123');
      expect(assessmentService.getAssessmentForAppointment).toHaveBeenCalledWith('appointment123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment existence check completed',
          data: {
            exists: true,
            appointmentId: 'appointment123'
          }
        })
      );
    });
    
    test('should check if assessment exists for appointment successfully - does not exist', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockResolvedValue(null);
      
      // Act
      await assessmentController.checkAssessmentExists(req, res, next);
      
      // Assert
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: 'Assessment existence check completed',
          data: {
            exists: false,
            appointmentId: 'appointment123'
          }
        })
      );
    });
    
    test('should handle invalid appointment ID', async () => {
      // Arrange
      req.params = { appointmentId: 'invalid-id' };
      
      validateObjectId.mockReturnValue(false);
      
      // Act
      await assessmentController.checkAssessmentExists(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Invalid appointment ID',
          statusCode: 400
        })
      );
    });
    
    test('should handle service errors', async () => {
      // Arrange
      req.params = { appointmentId: 'appointment123' };
      
      validateObjectId.mockReturnValue(true);
      assessmentService.getAssessmentForAppointment.mockRejectedValue(new Error('Service error'));
      
      // Act
      await assessmentController.checkAssessmentExists(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Service error',
          statusCode: 500
        })
      );
    });
  });
  
  // Edge case coverage
  describe('Edge case handling', () => {
    test('should handle null user in error handler', async () => {
      // Arrange
      req.user = null;
      req.params = { id: 'assessment123' };
      
      // Act
      await assessmentController.getAssessment(req, res, next);
      
      // No explicit user check in getAssessment, should attempt to get assessment
      expect(validateObjectId).toHaveBeenCalledWith('assessment123');
    });
    
    test('should handle various types of error objects', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      
      validateObjectId.mockReturnValue(true);
      
      // Test with Error with statusCode
      const errorWithStatusCode = new Error('Custom error');
      errorWithStatusCode.statusCode = 403;
      assessmentService.getAssessmentById.mockRejectedValueOnce(errorWithStatusCode);
      
      // Act
      await assessmentController.getAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Custom error',
          statusCode: 403
        })
      );
      
      // Clear for next test
      jest.clearAllMocks();
      
      // Test with regular Error
      req.params = { id: 'assessment123' };
      assessmentService.getAssessmentById.mockRejectedValueOnce(new Error('Regular error'));
      
      // Act again
      await assessmentController.getAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Regular error',
          statusCode: 500 // Default status code
        })
      );
    });
    
    test('should handle malformed answer data', async () => {
      // Arrange
      req.params = { id: 'assessment123' };
      req.body = {
        answers: null // null instead of array
      };
      
      validateObjectId.mockReturnValue(true);
      
      // Act
      await assessmentController.submitAnswers(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Answers must be provided as an array',
          statusCode: 400
        })
      );
    });
    
    test('should handle empty symptoms array properly', async () => {
      // Arrange
      req.params = { patientId: 'patient123' };
      req.body = {
        appointmentId: 'appointment123',
        symptoms: null // null instead of array
      };
      
      validateObjectId.mockReturnValue(true);
      
      // Act
      await assessmentController.startAssessment(req, res, next);
      
      // Assert
      expect(next).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Symptoms must be provided as a non-empty array',
          statusCode: 400
        })
      );
    });
  });
}); 