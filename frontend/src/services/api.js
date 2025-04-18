import axios from 'axios';

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
  getById: (id) => api.get(`/appointments/${id}`),
  update: (id, appointmentData) => api.put(`/appointments/${id}`, appointmentData),
  delete: (id) => api.delete(`/appointments/${id}`),
  getPatientAppointments: (patientId) => api.get(`/appointments/patient/${patientId}`),
  getDoctorAppointments: (doctorId) => api.get(`/appointments/doctor/${doctorId}`),
  getUpcomingAppointments: () => api.get('/appointments/upcoming'),
  getMyAppointments: () => api.get('/appointments/me'),
};

export const doctorService = {
  getAll: () => api.get('/doctors'),
  getById: (id) => api.get(`/doctors/${id}`),
  getByUserId: (userId) => api.get(`/doctors/user/${userId}`),
  getAvailability: (id) => api.get(`/doctors/${id}/availability`),
  updateProfile: (id, profileData) => api.put(`/doctors/${id}`, profileData),
};

export const patientService = {
  getAll: () => api.get('/patients'),
  getById: (id) => api.get(`/patients/${id}`),
  getByUserId: (userId) => api.get(`/patients/user/${userId}`),
  updateProfile: (id, profileData) => api.put(`/patients/${id}`, profileData),
  getMedicalHistory: (id) => api.get(`/patients/${id}/medical-history`),
};

export default api;