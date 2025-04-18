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
   * Start a new assessment
   * @param {Object} assessmentData - Initial assessment data
   * @returns {Promise<Object>} Created assessment
   */
  async startAssessment(assessmentData) {
    try {
      const { patientId, appointmentId, symptoms } = assessmentData;
      
      // Validate the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Invalid appointment');
      }
      
      // Check if assessment already exists for this appointment
      const existingAssessment = await Assessment.findOne({ appointmentId });
      if (existingAssessment) {
        // If there's already an in-progress assessment, return it
        if (existingAssessment.status === 'in-progress') {
          return existingAssessment;
        }
        
        // If there's a completed assessment, create a new version
        if (existingAssessment.status === 'completed') {
          // Archive the old one by marking it as a previous version
          await Assessment.findByIdAndUpdate(existingAssessment._id, {
            status: 'archived'
          });
        }
      }
      
      // Create a new assessment
      const assessment = await Assessment.create({
        patientId,
        appointmentId,
        symptoms: symptoms || [],
        responses: [],
        status: 'in-progress',
        creationDate: new Date()
      });
      
      // Log the assessment creation
      await AuditLog.create({
        userId: assessmentData.userId,
        action: 'create',
        resource: 'assessment',
        resourceId: assessment._id,
        details: {
          patientId,
          appointmentId
        }
      });
      
      return assessment;
    } catch (error) {
      console.error('Error starting assessment:', error);
      throw error;
    }
  }
  
  /**
   * Generate questions based on symptoms and previous responses
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Array>} Generated questions
   */
  async generateQuestions(assessmentId) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
      
      // If no symptoms are provided, return an empty array
      if (!assessment.symptoms || assessment.symptoms.length === 0) {
        return [];
      }
      
      // Generate questions using AI service
      const questions = await aiService.generateQuestions(
        assessment.symptoms,
        assessment.responses
      );
      
      return questions;
    } catch (error) {
      console.error('Error generating questions:', error);
      throw error;
    }
  }
  
  /**
   * Save patient responses to assessment questions
   * @param {string} assessmentId - Assessment ID
   * @param {Array} responses - Array of question-answer pairs
   * @returns {Promise<Object>} Updated assessment
   */
  async saveResponses(assessmentId, responses) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
      
      if (assessment.status !== 'in-progress') {
        throw new Error('Cannot update a completed or archived assessment');
      }
      
      // Merge existing responses with new ones
      const updatedResponses = [...assessment.responses];
      
      // Process each new response
      for (const response of responses) {
        const { questionId, question, answer, answerType } = response;
        
        // Find existing response with the same questionId
        const existingIndex = updatedResponses.findIndex(r => r.questionId === questionId);
        
        if (existingIndex >= 0) {
          // Update existing response
          updatedResponses[existingIndex] = {
            ...updatedResponses[existingIndex],
            answer,
            updatedAt: new Date()
          };
        } else {
          // Add new response
          updatedResponses.push({
            questionId,
            question,
            answer,
            answerType,
            createdAt: new Date()
          });
        }
      }
      
      // Update the assessment with new responses
      const updatedAssessment = await Assessment.findByIdAndUpdate(
        assessmentId,
        { responses: updatedResponses },
        { new: true }
      );
      
      return updatedAssessment;
    } catch (error) {
      console.error('Error saving responses:', error);
      throw error;
    }
  }
  
  /**
   * Complete assessment and generate AI report
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object>} Completed assessment with AI report
   */
  async completeAssessment(assessmentId) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
      
      if (assessment.status !== 'in-progress') {
        throw new Error('Cannot complete an already completed or archived assessment');
      }
      
      // Generate AI report
      const aiResults = await aiService.generateAssessmentReport({
        symptoms: assessment.symptoms,
        responses: assessment.responses
      });
      
      // Update assessment with report and set status to completed
      const completedAssessment = await Assessment.findByIdAndUpdate(
        assessmentId,
        {
          aiGeneratedReport: aiResults.report,
          severity: aiResults.severity,
          completionDate: new Date(),
          status: 'completed'
        },
        { new: true }
      );
      
      // Update appointment with assessment results
      await Appointment.findByIdAndUpdate(
        assessment.appointmentId,
        {
          preliminaryAssessment: {
            assessmentId: completedAssessment._id,
            severity: aiResults.severity,
            completed: true
          }
        }
      );
      
      return completedAssessment;
    } catch (error) {
      console.error('Error completing assessment:', error);
      throw error;
    }
  }
  
  /**
   * Skip assessment and mark it as abandoned
   * @param {string} assessmentId - Assessment ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>} Updated assessment
   */
  async skipAssessment(assessmentId, reason) {
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
          aiGeneratedReport: reason || 'Assessment skipped by patient'
        },
        { new: true }
      );
      
      // Update appointment with skipped assessment info
      await Appointment.findByIdAndUpdate(
        assessment.appointmentId,
        {
          preliminaryAssessment: {
            assessmentId: skippedAssessment._id,
            skipped: true,
            reason: reason || 'Patient preferred to discuss directly with doctor'
          }
        }
      );
      
      return skippedAssessment;
    } catch (error) {
      console.error('Error skipping assessment:', error);
      throw error;
    }
  }
  
  /**
   * Get assessment by ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object>} Assessment data
   */
  async getAssessmentById(assessmentId) {
    try {
      const assessment = await Assessment.findById(assessmentId);
      if (!assessment) {
        throw new Error('Assessment not found');
      }
      
      return assessment;
    } catch (error) {
      console.error('Error getting assessment:', error);
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
  
  /**
   * Get assessment for a specific appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Assessment data
   */
  async getAssessmentByAppointment(appointmentId) {
    try {
      const assessment = await Assessment.findOne({ 
        appointmentId,
        status: { $ne: 'archived' }
      });
      
      return assessment || null;
    } catch (error) {
      console.error('Error getting assessment by appointment:', error);
      throw error;
    }
  }
}

const assessmentService = new AssessmentService();
export default assessmentService; 