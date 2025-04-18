// src/services/assessmentService.mjs

import mongoose from 'mongoose';
import aiService from './aiService.mjs';

// Import models
const Assessment = mongoose.model('Assessment');
const Appointment = mongoose.model('Appointment');
const AuditLog = mongoose.model('AuditLog');
const Patient = mongoose.model('Patient');

/**
 * Assessment Service for managing patient assessments
 */
class AssessmentService {
  /**
   * Start a new assessment, generate initial questions.
   * @param {string} patientId
   * @param {string} appointmentId
   * @param {string[]} symptoms
   * @param {string} userId - ID of the user starting the assessment (for audit)
   * @returns {Promise<Object>} { assessmentId: string, questions: Array }
   */
  async startAssessment(patientId, appointmentId, symptoms, userId) {
    try {
      // Validate the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment || appointment.patientId.toString() !== patientId) {
        throw new Error('Invalid appointment or patient ID mismatch');
      }

      // Generate initial questions based on symptoms
      const generatedQuestions = await aiService.generateQuestions(symptoms || []);

      // Create a new assessment
      const assessment = await Assessment.create({
        patientId,
        appointmentId,
        symptoms: symptoms || [],
        generatedQuestions: generatedQuestions, // Store generated questions
        responses: [],
        status: 'in-progress',
        creationDate: new Date()
      });

      // Link assessment to appointment
      await Appointment.findByIdAndUpdate(appointmentId, { 
        preliminaryAssessmentId: assessment._id 
      });

      // Log the assessment creation
      await AuditLog.create({
        userId: userId, // Use the provided userId
        action: 'create',
        resource: 'assessment',
        resourceId: assessment._id,
        details: { patientId, appointmentId, symptoms: symptoms?.join(', ') }
      });

      // Return the ID and the questions for the frontend
      return {
        assessmentId: assessment._id.toString(),
        questions: generatedQuestions
      };

    } catch (error) {
      console.error('Error starting assessment:', error);
      throw new Error(`Failed to start assessment: ${error.message}`);
    }
  }

  /**
   * Save patient responses and trigger AI report generation.
   * @param {string} assessmentId - Assessment ID
   * @param {Array} answers - Array of { questionId: string, answer: any }
   * @param {string} userId - ID of user submitting answers (for audit)
   * @returns {Promise<Object>} Completed assessment
   */
  async submitAnswersAndGenerateReport(assessmentId, answers, userId) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      if (assessment.status !== 'in-progress') {
        throw new Error('Assessment is not in-progress. Cannot submit answers.');
      }

      // Map answers to the structure expected by the schema and AI
      const formattedResponses = assessment.generatedQuestions.map(q => {
          const patientAnswer = answers.find(a => a.questionId === q.questionId);
          return {
              questionId: q.questionId,
              question: q.question, // Include original question text for context
              answer: patientAnswer ? patientAnswer.answer : null // Store the answer
          };
      }).filter(r => r.answer !== null); // Filter out unanswered questions potentially

      // Update the assessment with responses first
      assessment.responses = formattedResponses;
      await assessment.save();

      // Generate AI report using symptoms and the formatted responses
      const aiResults = await aiService.generateAssessmentReport({
        symptoms: assessment.symptoms,
        responses: assessment.responses // Pass the saved responses
      });

      // Update assessment with report details and mark as completed
      assessment.aiGeneratedReport = aiResults.report;
      assessment.severity = aiResults.severity; // Use severity from AI report
      assessment.completionDate = new Date();
      assessment.status = 'completed';
      const completedAssessment = await assessment.save();

      // Log the completion
      await AuditLog.create({
        userId: userId, 
        action: 'update',
        resource: 'assessment',
        resourceId: assessmentId,
        details: { status: 'completed', severity: assessment.severity }
      });

      return completedAssessment;

    } catch (error) {
      console.error('Error submitting answers and generating report:', error);
       throw new Error(`Failed to submit answers: ${error.message}`);
    }
  }

  /**
   * Get a specific assessment by its ID.
   * @param {string} assessmentId
   * @returns {Promise<Object>} Assessment details
   */
  async getAssessmentById(assessmentId) {
    try {
      if (!mongoose.Types.ObjectId.isValid(assessmentId)) {
         throw new Error('Invalid assessment ID format');
      }
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
      return assessment;
    } catch (error) {
      console.error('Error getting assessment by ID:', error);
      throw new Error(`Failed to retrieve assessment: ${error.message}`);
    }
  }
  
  /**
   * Get the assessment associated with a specific appointment.
   * @param {string} appointmentId
   * @returns {Promise<Object|null>} Assessment details or null
   */
  async getAssessmentForAppointment(appointmentId) {
    try {
       if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
         throw new Error('Invalid appointment ID format');
      }
      const assessment = await Assessment.findOne({ appointmentId });
      // No error if not found, just return null
      return assessment;
    } catch (error) {
      console.error('Error getting assessment for appointment:', error);
      throw new Error(`Failed to retrieve assessment for appointment: ${error.message}`);
    }
  }

  // --- Existing methods below (like skipAssessment, getPatientAssessments) can be kept or refactored as needed ---

  /**
   * Skip assessment and mark it as abandoned
   * @param {string} assessmentId - Assessment ID
   * @param {string} reason - Reason for skipping
   * @param {string} userId - ID of user skipping (for audit)
   * @returns {Promise<Object>} Updated assessment
   */
  async skipAssessment(assessmentId, reason, userId) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }

      if (assessment.status !== 'in-progress') {
        throw new Error('Cannot skip an already completed or archived assessment');
      }

      // Update assessment to abandoned status
      const skippedAssessment = await Assessment.findByIdAndUpdate(
        assessmentId,
        {
          status: 'abandoned',
          completionDate: new Date(),
          aiGeneratedReport: reason || 'Assessment skipped by user' // Store reason in report field
        },
        { new: true }
      );

      // Log the skip action
      await AuditLog.create({
          userId: userId,
          action: 'update',
          resource: 'assessment',
          resourceId: assessmentId,
          details: { status: 'abandoned', reason: reason || 'Skipped' }
      });

      return skippedAssessment;
    } catch (error) {
      console.error('Error skipping assessment:', error);
      throw error;
    }
  }

  /**
   * Get assessments for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} options - Query options
   * @returns {Promise<Array>} Patient assessments
   */
  async getPatientAssessments(patientId, options = {}) {
    try {
      const { limit = 10, page = 1, sort = 'creationDate', order = -1 } = options;

      const skip = (page - 1) * limit;
      const sortOptions = {};
      sortOptions[sort] = order;

      const assessments = await Assessment.find({ patientId })
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);

      const total = await Assessment.countDocuments({ patientId });

      return {
        assessments,
        pagination: {
          total,
          page,
          limit,
          pages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting patient assessments:', error);
      throw error;
    }
  }
}

export default new AssessmentService(); 