import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const authService = {
  async register(userData) {
    const response = await axios.post(`${API_URL}/auth/register`, userData);
    return response.data;
  },

  async login(credentials) {
    const response = await axios.post(`${API_URL}/auth/login`, credentials);
    return response.data;
  },

  async logout() {
    const response = await axios.post(`${API_URL}/auth/logout`);
    return response.data;
  },

  async getMe() {
    const response = await axios.get(`${API_URL}/auth/me`);
    return response.data;
  },

  async refreshToken() {
    const response = await axios.post(`${API_URL}/auth/refresh-token`);
    return response.data;
  },

  async forgotPassword(email) {
    const response = await axios.post(`${API_URL}/auth/forgot-password`, { email });
    return response.data;
  },

  async resetPassword(resetToken, newPassword) {
    const response = await axios.put(`${API_URL}/auth/reset-password/${resetToken}`, { newPassword });
    return response.data;
  }
};

export default authService; 