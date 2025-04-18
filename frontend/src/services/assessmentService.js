import { axiosInstance } from './api';

/**
 * Service for handling assessment-related API calls
 */
const assessmentService = {
  /**
   * Start a new assessment
   * @param {string} patientId - Patient ID
   * @param {string} appointmentId - Appointment ID
   * @param {Array} symptoms - Array of symptom descriptions
   * @returns {Promise<Object>} Assessment data
   */
  startAssessment: (patientId, appointmentId, symptoms) => {
    return axiosInstance.post(`/assessments/patients/${patientId}/assessments/start`, {
      appointmentId,
      symptoms
    });
  },

  /**
   * Get assessment by ID
   * @param {string} patientId - Patient ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object>} Assessment data
   */
  getAssessment: (patientId, assessmentId) => {
    return axiosInstance.get(`/assessments/patients/${patientId}/assessments/${assessmentId}`);
  },

  /**
   * Get all assessments for a patient
   * @param {string} patientId - Patient ID
   * @param {Object} params - Query parameters (page, limit, sort, order)
   * @returns {Promise<Object>} Assessment list and pagination data
   */
  getPatientAssessments: (patientId, params = {}) => {
    return axiosInstance.get(`/assessments/patients/${patientId}/assessments`, { params });
  },

  /**
   * Get assessment questions
   * @param {string} patientId - Patient ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Array>} Questions list
   */
  getQuestions: (patientId, assessmentId) => {
    return axiosInstance.get(`/assessments/patients/${patientId}/assessments/${assessmentId}/questions`);
  },

  /**
   * Save responses to assessment questions
   * @param {string} patientId - Patient ID
   * @param {string} assessmentId - Assessment ID
   * @param {Array} responses - Array of response objects
   * @returns {Promise<Object>} Updated assessment
   */
  saveResponses: (patientId, assessmentId, responses) => {
    return axiosInstance.post(`/assessments/patients/${patientId}/assessments/${assessmentId}/responses`, {
      responses
    });
  },

  /**
   * Complete an assessment and generate report
   * @param {string} patientId - Patient ID
   * @param {string} assessmentId - Assessment ID
   * @returns {Promise<Object>} Completed assessment with report
   */
  completeAssessment: (patientId, assessmentId) => {
    return axiosInstance.post(`/assessments/patients/${patientId}/assessments/${assessmentId}/complete`);
  },

  /**
   * Skip an assessment
   * @param {string} patientId - Patient ID
   * @param {string} assessmentId - Assessment ID
   * @param {string} reason - Reason for skipping
   * @returns {Promise<Object>} Skipped assessment
   */
  skipAssessment: (patientId, assessmentId, reason) => {
    return axiosInstance.post(`/assessments/patients/${patientId}/assessments/${assessmentId}/skip`, {
      reason
    });
  },

  /**
   * Get assessment for a specific appointment
   * @param {string} appointmentId - Appointment ID
   * @returns {Promise<Object>} Assessment data
   */
  getAssessmentByAppointment: (appointmentId) => {
    return axiosInstance.get(`/assessments/appointments/${appointmentId}/assessment`);
  }
};

export default assessmentService; 