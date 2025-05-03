import axios from 'axios';
import { safeObjectId } from '../utils/stringUtils';

// Validate environment variables
if (!process.env.REACT_APP_API_URL) {
  console.error('REACT_APP_API_URL is not defined in environment variables');
}

// Create axios instance with default config
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 10000, // 10 seconds timeout
});

// Export the axios instance for use in other services
export const axiosInstance = api;

// Add request interceptor for token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response) {
      // Server responded with error status
      switch (error.response.status) {
        case 401:
          // Unauthorized - clear token and redirect to login
          localStorage.removeItem('token');
          localStorage.removeItem('user');
          window.location.href = '/login';
          break;
        case 403:
          // Forbidden
          console.error('Access forbidden:', error.response.data);
          break;
        case 429:
          // Too many requests
          console.error('Rate limit exceeded:', error.response.data);
          break;
        default:
          console.error('API Error:', error.response.data);
      }
    } else if (error.request) {
      // Request made but no response received
      console.error('No response received:', error.request);
    } else {
      // Error in request setup
      console.error('Request setup error:', error.message);
    }
    return Promise.reject(error);
  }
);

// Auth service methods
export const authService = {
  login: async (credentials) => {
    try {
      // Only send email and password for initial login
      const loginData = {
        email: credentials.email,
        password: credentials.password
      };
      
      console.log('Login request being sent:', {
        email: loginData.email,
        password: loginData.password
      });
      
      const response = await api.post('/auth/login', loginData);
      console.log('Login response received:', response.data);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Login error:', error.response?.data || error.message);
      throw error;
    }
  },

  register: async (userData) => {
    try {
      const response = await api.post('/auth/register', userData);
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  logout: async () => {
    try {
      await api.post('/auth/logout');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    } catch (error) {
      // Even if logout fails, clear local storage
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  },

  refreshToken: async () => {
    try {
      const response = await api.post('/auth/refresh-token');
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  },

  verifyMfa: async (email, mfaCode) => {
    try {
      const response = await api.post('/auth/verify-mfa', { email, mfaCode });
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      return response.data;
    } catch (error) {
      throw error;
    }
  }
};

export const appointmentService = {
  create: (appointmentData) => api.post('/appointments', appointmentData),
  getAll: () => api.get('/appointments'),
  getById: (id) => {
    // More strict ID validation before making API call
    if (!id) {
      console.error('Null or undefined appointment ID passed to getById');
      return Promise.reject(new Error('Invalid appointment ID'));
    }
    
    // Check for temporary IDs that we know will fail
    if (typeof id === 'string' && id.startsWith('temp-')) {
      console.error('Temporary ID detected that backend will reject:', id);
      return Promise.reject(new Error('Invalid appointment ID format'));
    }
    
    // Validate MongoDB ObjectID format
    const isValidObjectId = typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
    if (!isValidObjectId) {
      console.error('Invalid MongoDB ObjectID format:', id);
      return Promise.reject(new Error('Invalid appointment ID format'));
    }
    
    // If we passed all validation, make the API call with the ID as-is
    return api.get(`/appointments/${id}`);
  },
  update: (id, appointmentData) => {
    // Use our safe utility to handle object IDs
    const safeId = safeObjectId(id) || id;
    return api.put(`/appointments/${safeId}`, appointmentData);
  },
  delete: (id) => {
    // Use our safe utility to handle object IDs
    const safeId = safeObjectId(id) || id;
    return api.delete(`/appointments/${safeId}`);
  },
  getPatientAppointments: (patientId) => {
    // Use our safe utility to handle object IDs
    const safeId = safeObjectId(patientId) || patientId;
    return api.get(`/appointments/patient/${safeId}`);
  },
  getDoctorAppointments: (doctorId) => {
    // Use our safe utility to handle object IDs
    const safeId = safeObjectId(doctorId) || doctorId;
    return api.get(`/appointments/doctor/${safeId}`);
  },
  getUpcomingAppointments: () => api.get('/appointments/upcoming'),
  getMyAppointments: () => api.get('/appointments/me'),
  // Add methods to handle object ID issues
  cancelAppointment: (id, reason) => {
    const safeId = safeObjectId(id) || id;
    return api.patch(`/appointments/${safeId}/cancel`, reason);
  },
  updateAppointment: (id, data) => {
    const safeId = safeObjectId(id) || id;
    return api.patch(`/appointments/${safeId}`, data);
  }
};

export const doctorService = {
  getAll: () => api.get('/doctors'),
  getById: (id) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.get(`/doctors/${safeId}`);
  },
  getByUserId: (userId) => {
    // Ensure user ID is a string
    const safeId = typeof userId === 'object' && userId !== null 
      ? (userId.toString ? userId.toString() : String(userId)) 
      : String(userId);
    return api.get(`/doctors/user/${safeId}`);
  },
  getAvailability: (id) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.get(`/doctors/${safeId}/availability`);
  },
  updateProfile: (id, profileData) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.put(`/doctors/${safeId}`, profileData);
  },
};

export const patientService = {
  getAll: () => api.get('/patients'),
  getById: (id) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.get(`/patients/${safeId}`);
  },
  getByUserId: (userId) => {
    // Ensure user ID is a string
    const safeId = typeof userId === 'object' && userId !== null 
      ? (userId.toString ? userId.toString() : String(userId)) 
      : String(userId);
    return api.get(`/patients/user/${safeId}`);
  },
  updateProfile: (id, profileData) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.put(`/patients/${safeId}`, profileData);
  },
  getMedicalHistory: (id) => {
    // Ensure ID is a string
    const safeId = typeof id === 'object' && id !== null 
      ? (id.toString ? id.toString() : String(id)) 
      : String(id);
    return api.get(`/patients/${safeId}/medical-history`);
  },
};

export default api;