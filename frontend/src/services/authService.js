import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Configure axios to include credentials
axios.defaults.withCredentials = true;

// Add request interceptor for authentication
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

const authService = {
  async register(userData) {
    try {
      console.log('Registering user:', { email: userData.email });
      const response = await axios.post(`${API_URL}/auth/register`, userData);
      
      // Store token and user data if available in response
      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
      }
      
      return response.data;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

  login: async (credentials) => {
    try {
      console.log('Auth service login called with:', 
        { email: credentials.email, hasPassword: !!credentials.password });
      
      const response = await axiosInstance.post('/auth/login', credentials);
      console.log('Raw API response:', response);
      
      // Your backend is returning {success: true, user: {...}, roleData: {...}}
      // Instead of checking for token, check for success
      if (response && response.success) {
        console.log('Login successful, storing user data');
        localStorage.setItem('user', JSON.stringify(response.user));
        
        // Set authorization for future requests using a session cookie instead
        // Your backend might be using cookies for authentication instead of tokens
      }
      
      return response;
    } catch (error) {
      console.error('Login error in auth service:', error);
      throw error;
    }
  },

  async logout() {
    try {
      const response = await axios.post(`${API_URL}/auth/logout`);
      // Clear token and user data regardless of response
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      return response.data;
    } catch (error) {
      // Still clear storage even if API call fails
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      throw error;
    }
  },

  async getMe() {
    const response = await axios.get(`${API_URL}/auth/me`);
    return response.data;
  },

  async refreshToken() {
    try {
      const response = await axios.post(`${API_URL}/auth/refresh-token`);
      
      // Update token if available in response
      if (response.data && response.data.token) {
        localStorage.setItem('token', response.data.token);
      }
      
      return response.data;
    } catch (error) {
      console.error('Token refresh error:', error);
      throw error;
    }
  },

  async forgotPassword(email) {
    const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    return response.data;
  },

  async resetPassword(resetToken, newPassword) {
    const response = await axios.put(`${API_URL}/auth/reset-password/${resetToken}`, { newPassword });
    return response.data;
  },
  
  // Helper method to check if user is authenticated
  isAuthenticated() {
    return !!localStorage.getItem('token');
  }
};

export default authService;