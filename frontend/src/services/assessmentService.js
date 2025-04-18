import { axiosInstance } from './api';

/**
 * Service for handling assessment-related API calls
 */
const assessmentService = {
  /**
   * Start a new assessment and get initial questions.
   * Assumes authentication provides necessary context (like patientId if user is patient).
   * @param {string} appointmentId - Appointment ID assessment is linked to.
   * @param {Array} symptoms - Array of symptom descriptions.
   * @returns {Promise<Object>} { assessmentId: string, questions: Array }
   */
  startAssessment: (appointmentId, symptoms) => {
    // Route changed to /api/assessments/start
    return axiosInstance.post(`/assessments/start`, {
      appointmentId,
      symptoms
      // patientId might be inferred from auth on backend if needed
    });
  },

  /**
   * Submit answers for an assessment and trigger report generation.
   * @param {string} assessmentId - The ID of the assessment being answered.
   * @param {Array} answers - Array of answer objects { questionId: string, answer: any }.
   * @returns {Promise<Object>} Completed assessment data.
   */
  submitAnswers: (assessmentId, answers) => {
    // Route changed to /api/assessments/:id/responses
    return axiosInstance.post(`/assessments/${assessmentId}/responses`, {
      answers
    });
  },
  
  /**
   * Get a specific assessment by its ID.
   * @param {string} assessmentId - Assessment ID.
   * @returns {Promise<Object>} Assessment data.
   */
  getAssessment: (assessmentId) => {
    // Route changed to /api/assessments/:id
    return axiosInstance.get(`/assessments/${assessmentId}`);
  },

  /**
   * Get all assessments for a specific patient.
   * @param {string} patientId - Patient ID.
   * @param {Object} params - Query parameters (page, limit, sort, order).
   * @returns {Promise<Object>} Assessment list and pagination data.
   */
  getPatientAssessments: (patientId, params = {}) => {
    // Route changed to /api/assessments?patientId=...
    return axiosInstance.get(`/assessments`, { params: { ...params, patientId } });
  },

  /**
   * Skip an assessment.
   * @param {string} assessmentId - Assessment ID.
   * @param {string} reason - Reason for skipping.
   * @returns {Promise<Object>} Skipped assessment data.
   */
  skipAssessment: (assessmentId, reason) => {
    // Route changed to /api/assessments/:id/skip
    return axiosInstance.post(`/assessments/${assessmentId}/skip`, {
      reason
    });
  },

  /**
   * Get assessment for a specific appointment.
   * @param {string} appointmentId - Appointment ID.
   * @returns {Promise<Object>} Assessment data.
   */
  getAssessmentByAppointment: (appointmentId) => {
    // Route changed slightly
    return axiosInstance.get(`/assessments/by-appointment/${appointmentId}`);
  }

  // Removed obsolete methods: getQuestions, saveResponses, completeAssessment
};

export default assessmentService; 