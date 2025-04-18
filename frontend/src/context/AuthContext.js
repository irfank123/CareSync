import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // List of public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];

  // Check for token expiration and refresh if needed
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Check if token is expired
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = tokenData.exp * 1000; // Convert to milliseconds
          
          if (expirationTime < Date.now()) {
            // Token expired, try to refresh
            try {
              await authService.refreshToken();
            } catch (error) {
              // If refresh fails, logout
              await authService.logout();
              navigate('/login');
              return;
            }
          }
          
          // Get user data
          const storedUser = JSON.parse(localStorage.getItem('user'));
          if (storedUser) {
            setUser(storedUser);
            // Only redirect to dashboard if on a public route
            if (publicRoutes.includes(location.pathname)) {
              if (storedUser.role === 'doctor') {
                navigate('/doctor-dashboard');
              } else {
                navigate('/dashboard');
              }
            }
          }
        }
      } catch (error) {
        console.error('Auth check error:', error);
        await authService.logout();
        navigate('/login');
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [navigate, location.pathname]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      
      if (response.success) {
        setUser(response.user);
        toast.success('Login successful!');
        // Navigate based on user role
        if (response.user.role === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/dashboard');
        }
        return { success: true };
      } else if (response.requiresMfa) {
        return { success: true, requiresMfa: true };
      } else {
        toast.error(response.message || 'Login failed');
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'An error occurred during login';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await authService.register(userData);
      
      if (response.success) {
        setUser(response.user);
        toast.success('Registration successful!');
        // Navigate based on user role
        if (response.user.role === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/dashboard');
        }
        return { success: true };
      } else {
        toast.error(response.message || 'Registration failed');
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'An error occurred during registration';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      setLoading(true);
      await authService.logout();
      setUser(null);
      toast.info('You have been logged out');
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
      // Still clear local state even if server logout fails
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    } finally {
      setLoading(false);
    }
  };

  const verifyMfa = async (email, mfaCode) => {
    try {
      setLoading(true);
      const response = await authService.verifyMfa(email, mfaCode);
      
      if (response.success) {
        setUser(response.user);
        toast.success('MFA verification successful!');
        // Navigate based on user role
        if (response.user.role === 'doctor') {
          navigate('/doctor-dashboard');
        } else {
          navigate('/dashboard');
        }
        return { success: true };
      } else {
        toast.error(response.message || 'MFA verification failed');
        return { success: false, error: response.message };
      }
    } catch (error) {
      const errorMessage = error.response?.data?.message || 'An error occurred during MFA verification';
      toast.error(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = (updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
    localStorage.setItem('user', JSON.stringify({ ...user, ...updatedData }));
  };

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    verifyMfa,
    updateUserProfile,
    isAuthenticated: !!user,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext; 