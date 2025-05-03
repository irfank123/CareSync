import axios from 'axios';
import { API_BASE_URL } from '../config';

// Get all assessments
export const getAllAssessments = async (params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/assessments`, { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching assessments:', error);
    throw error;
  }
};

// Get assessments for a specific patient
export const getPatientAssessments = async (patientId, params = {}) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/patients/${patientId}/assessments`, { params });
    return response.data;
  } catch (error) {
    console.error(`Error fetching assessments for patient ${patientId}:`, error);
    throw error;
  }
};

// Get a specific assessment by ID
export const getAssessmentById = async (assessmentId) => {
  try {
    const response = await axios.get(`${API_BASE_URL}/assessments/${assessmentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

// Create a new assessment
export const createAssessment = async (assessmentData) => {
  try {
    const response = await axios.post(`${API_BASE_URL}/assessments`, assessmentData);
    return response.data;
  } catch (error) {
    console.error('Error creating assessment:', error);
    throw error;
  }
};

// Update an existing assessment
export const updateAssessment = async (assessmentId, assessmentData) => {
  try {
    const response = await axios.put(`${API_BASE_URL}/assessments/${assessmentId}`, assessmentData);
    return response.data;
  } catch (error) {
    console.error(`Error updating assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

// Delete an assessment
export const deleteAssessment = async (assessmentId) => {
  try {
    const response = await axios.delete(`${API_BASE_URL}/assessments/${assessmentId}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting assessment with ID ${assessmentId}:`, error);
    throw error;
  }
};

export default {
  getAllAssessments,
  getPatientAssessments,
  getAssessmentById,
  createAssessment,
  updateAssessment,
  deleteAssessment
}; 