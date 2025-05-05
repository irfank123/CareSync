import { axiosInstance } from './api'; // Import the configured Axios instance

// Get all assessments
export const getAllAssessments = async (params = {}) => {
  try {
    const response = await axiosInstance.get('/assessments', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching assessments:', error);
    throw error;
  }
};

// Get assessments for a specific patient
export const getPatientAssessments = async (patientId, params = {}) => {
  try {
    const response = await axiosInstance.get(`/patients/${patientId}/assessments`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching assessments for patient ${patientId}:`, error);
    throw error;
  }
};

// Get a specific assessment by ID
export const getAssessmentById = async (assessmentId) => {
  try {
    const response = await axiosInstance.get(`/assessments/${assessmentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

// Create a new assessment (start the process)
export const createAssessment = async (assessmentData) => {
  try {
    // Extract patientId for the URL and send the rest in the body
    const { patientId, ...bodyData } = assessmentData;
    if (!patientId) {
      throw new Error('Patient ID is missing for createAssessment call');
    }
    // Log token existence before making the call
    const tokenExists = !!localStorage.getItem('token');
    console.log(`[createAssessment] Token exists in localStorage just before API call: ${tokenExists}`);
    
    // Construct the URL with patientId
    const url = `/patients/${patientId}/assessments/start`;
    console.log(`Calling createAssessment endpoint: POST ${url}`);
    const response = await axiosInstance.post(url, bodyData);
    return response.data;
  } catch (error) {
    console.error('Error creating assessment:', error.response?.data || error.message);
    // Re-throw a more specific error if possible
    const errorMessage = error.response?.data?.message || error.message || 'Failed to start assessment.';
    throw new Error(errorMessage);
  }
};

// Update an existing assessment
export const updateAssessment = async (assessmentId, assessmentData) => {
  try {
    const response = await axiosInstance.put(`/assessments/${assessmentId}`, assessmentData);
    return response.data;
  } catch (error) {
    console.error(`Error updating assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

// Delete an assessment
export const deleteAssessment = async (assessmentId) => {
  try {
    const response = await axiosInstance.delete(`/assessments/${assessmentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

// Submit answers (using update for now, assuming it takes responses)
export const submitAnswers = async (assessmentId, answersData) => {
  try {
    // Backend route is /:id/responses, expects { answers: [...] } in body
    const response = await axiosInstance.post(`/assessments/${assessmentId}/responses`, { answers: answersData });
    return response.data;
  } catch (error) {
    console.error(`Error submitting answers for assessment ${assessmentId}:`, error);
    throw error;
  }
};

export default {
  getAllAssessments,
  getPatientAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment,
  submitAnswers
}; 