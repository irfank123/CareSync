// src/services/api.js

import axios from 'axios';
import { toast } from 'react-toastify';

// Create axios instance with base URL
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001/api';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true // Include cookies in requests
});

// Add request interceptor for authentication
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for handling common errors
axiosInstance.interceptors.response.use(
  (response) => response.data, // Automatically extract data from response
  async (error) => {
    // Handle token refresh
    const originalRequest = error.config;
    
    if (error.response?.status === 401 && !originalRequest._retry && 
        !originalRequest.url?.includes('auth/login') && 
        !originalRequest.url?.includes('auth/refresh-token')) {
      originalRequest._retry = true;
      
      try {
        console.log('Attempting to refresh token...');
        // Try to refresh the token
        const response = await axiosInstance.post('/auth/refresh-token');
        if (response.data && response.data.token) {
          const newToken = response.data.token;
          console.log('Token refreshed successfully');
          localStorage.setItem('token', newToken);
          axiosInstance.defaults.headers.Authorization = `Bearer ${newToken}`;
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return axiosInstance(originalRequest);
        }
      } catch (refreshError) {
        console.error('Token refresh failed:', refreshError);
        // If refresh fails, logout
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Only redirect if not already on login page
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
        
        return Promise.reject(refreshError);
      }
    }
    
    // Handle other errors
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login if not already there
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          if (!error.config.url.includes('auth/login') && 
              !window.location.pathname.includes('/login')) {
            window.location.href = '/login';
          }
          break;
        case 403:
          // Forbidden
          toast.error('You do not have permission to perform this action');
          break;
        case 429:
          // Too many requests
          toast.error('Too many requests. Please try again later');
          break;
        default:
          // Other errors
          const errorMessage = error.response.data?.message || 'An error occurred';
          toast.error(errorMessage);
      }
    } else if (error.request) {
      // Request made but no response received
      toast.error('No response from server. Please check your connection');
    } else {
      // Error in request setup
      toast.error('Request error: ' + error.message);
    }
    
    return Promise.reject(error);
  }
);

// Auth service methods
export const authService = {
  login: async (credentials) => {
    try {
      console.log('Auth service login called with:', 
        { email: credentials.email, hasPassword: !!credentials.password });
      
      const response = await axiosInstance.post('/auth/login', credentials);
      console.log('Raw API response:', response);
      
      // Handle successful login with token
      if (response && response.token) {
        console.log('Token received, storing in localStorage');
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Set auth token for future requests
        axiosInstance.defaults.headers.Authorization = `Bearer ${response.token}`;
      }
      
      return response;
    } catch (error) {
      console.error('Login error in auth service:', error);
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await axiosInstance.post('/auth/register', userData);
      
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Set auth token for future requests
        axiosInstance.defaults.headers.Authorization = `Bearer ${response.token}`;
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await axiosInstance.post('/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Remove auth token from requests
      delete axiosInstance.defaults.headers.Authorization;
      
      return { success: true };
    } catch (error) {
      // Even if logout fails, clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Remove auth token from requests
      delete axiosInstance.defaults.headers.Authorization;
      
      throw error;
    }
  },

  refreshToken: async () => {
    try {
      const response = await axiosInstance.post('/auth/refresh-token');
      
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        
        // Update auth token for future requests
        axiosInstance.defaults.headers.Authorization = `Bearer ${response.token}`;
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },

  verifyMfa: async (email, mfaCode) => {
    try {
      const response = await axiosInstance.post('/auth/verify-mfa', { email, mfaCode });
      
      if (response && response.token) {
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Set auth token for future requests
        axiosInstance.defaults.headers.Authorization = `Bearer ${response.token}`;
      }
      
      return response;
    } catch (error) {
      throw error;
    }
  },
  
  getProfile: async () => {
    return axiosInstance.get('/auth/me');
  },
  
  updatePassword: async (data) => {
    return axiosInstance.post('/auth/update-password', data);
  },
  
  forgotPassword: async (email) => {
    return axiosInstance.post('/auth/forgot-password', { email });
  },
  
  resetPassword: async (resetToken, password) => {
    return axiosInstance.put(`/auth/reset-password/${resetToken}`, { password });
  }
};

// Appointment service
export const appointmentService = {
  getAll: (params) => axiosInstance.get('/appointments', { params }),
  getById: (id) => axiosInstance.get(`/appointments/${id}`),
  create: (data) => axiosInstance.post('/appointments', data),
  update: (id, data) => axiosInstance.put(`/appointments/${id}`, data),
  delete: (id) => axiosInstance.delete(`/appointments/${id}`),
  getUpcoming: () => axiosInstance.get('/appointments/upcoming'),
  getPatientAppointments: (patientId, params) => 
    axiosInstance.get(`/appointments/patient/${patientId}`, { params }),
  getDoctorAppointments: (doctorId, params) => 
    axiosInstance.get(`/appointments/doctor/${doctorId}`, { params })
};

// Doctor service
export const doctorService = {
  getAll: (params) => axiosInstance.get('/doctors', { params }),
  getById: (id) => axiosInstance.get(`/doctors/${id}`),
  create: (data) => axiosInstance.post('/doctors', data),
  update: (id, data) => axiosInstance.put(`/doctors/${id}`, data),
  delete: (id) => axiosInstance.delete(`/doctors/${id}`),
  getProfile: () => axiosInstance.get('/doctors/me'),
  updateProfile: (data) => axiosInstance.put('/doctors/me', data),
  getAvailability: (id, params) => axiosInstance.get(`/doctors/${id}/availability`, { params })
};

// Patient service
export const patientService = {
  getAll: (params) => axiosInstance.get('/patients', { params }),
  getById: (id) => axiosInstance.get(`/patients/${id}`),
  create: (data) => axiosInstance.post('/patients', data),
  update: (id, data) => axiosInstance.put(`/patients/${id}`, data),
  delete: (id) => axiosInstance.delete(`/patients/${id}`),
  getProfile: () => axiosInstance.get('/patients/me'),
  updateProfile: (data) => axiosInstance.put('/patients/me', data),
  getMedicalHistory: (id) => axiosInstance.get(`/patients/${id}/medical-history`)
};

// Availability service
export const availabilityService = {
  getTimeSlots: (doctorId, params) => 
    axiosInstance.get(`/availability/doctor/${doctorId}/slots`, { params }),
  getAvailableTimeSlots: (doctorId, params) => 
    axiosInstance.get(`/availability/doctor/${doctorId}/slots/available`, { params }),
  createTimeSlot: (data) => axiosInstance.post('/availability/slots', data),
  updateTimeSlot: (slotId, data) => axiosInstance.put(`/availability/slots/${slotId}`, data),
  deleteTimeSlot: (slotId) => axiosInstance.delete(`/availability/slots/${slotId}`),
  generateTimeSlots: (doctorId, data) => 
    axiosInstance.post(`/availability/doctor/${doctorId}/generate`, data)
};

// User service
export const userService = {
  getAll: (params) => axiosInstance.get('/users', { params }),
  getById: (id) => axiosInstance.get(`/users/${id}`),
  create: (data) => axiosInstance.post('/users', data),
  update: (id, data) => axiosInstance.put(`/users/${id}`, data),
  delete: (id) => axiosInstance.delete(`/users/${id}`),
  getProfile: () => axiosInstance.get('/users/profile'),
  updateProfile: (data) => axiosInstance.put('/users/profile', data),
  searchUsers: (query) => axiosInstance.get('/users/search', { params: { query } })
};

// Export both the instance and a set of helper methods
const api = {
  // Set auth token for API requests
  setAuthToken: (token) => {
    if (token) {
      axiosInstance.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    } else {
      delete axiosInstance.defaults.headers.common['Authorization'];
    }
  },
  
  // Utility method to check if user is authenticated
  isAuthenticated: () => {
    return !!localStorage.getItem('token');
  },
  
  // Helper to get the current user from localStorage
  getCurrentUser: () => {
    const userString = localStorage.getItem('user');
    return userString ? JSON.parse(userString) : null;
  }
};

export default api;