import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth context from localStorage on component mount
  useEffect(() => {
    const initAuth = async () => {
      try {
        const token = localStorage.getItem('token');
        if (token) {
          // Try to set the user from localStorage first for immediate display
          const storedUser = JSON.parse(localStorage.getItem('user'));
          if (storedUser) {
            console.log('Setting user from localStorage');
            setUser(storedUser);
          }
          
          // Check if token is expired
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = tokenData.exp * 1000; // Convert to milliseconds
          
          if (expirationTime < Date.now()) {
            console.log('Token expired, attempting to refresh');
            // Token expired, try to refresh
            try {
              const refreshResult = await authService.refreshToken();
              console.log('Token refresh result:', refreshResult);
              
              if (!refreshResult.success) {
                console.log('Token refresh failed, logging out');
                await logout();
              }
            } catch (error) {
              console.error('Error refreshing token:', error);
              // If refresh fails, logout
              await logout();
            }
          } else {
            console.log('Token valid, fetching current user');
            // Token still valid, try to get fresh user data
            try {
              const userProfile = await authService.getProfile();
              if (userProfile && userProfile.user) {
                console.log('User profile fetched successfully');
                setUser(userProfile.user);
                localStorage.setItem('user', JSON.stringify(userProfile.user));
              }
            } catch (profileError) {
              console.error('Error fetching user profile:', profileError);
              // Non-fatal - we already have user from localStorage
            }
          }
        } else {
          console.log('No token found in localStorage');
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        await logout();
      } finally {
        setLoading(false);
      }
    };

    initAuth();
  }, [navigate]);

  const login = async (credentials) => {
    try {
      setLoading(true);
      console.log('AuthContext login called with email:', credentials.email);
      
      const response = await authService.login(credentials);
      console.log('Login response in AuthContext:', response);
      
      if (response.success) {
        if (response.requiresMfa) {
          console.log('MFA required, returning to Login component');
          return { success: true, requiresMfa: true };
        }
        
        if (response.token && response.user) {
          console.log('Setting user in context:', response.user);
          setUser(response.user);
          return { success: true };
        } else {
          console.warn('Login successful but missing token or user data:', response);
          return { success: false, error: 'Login successful but missing data' };
        }
      } else {
        console.warn('Login failed:', response.message);
        return { success: false, error: response.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Login error in AuthContext:', error);
      const errorMessage = error.response?.data?.message || 'Login failed';
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const register = async (userData) => {
    try {
      setLoading(true);
      const response = await authService.register(userData);
      
      if (response.success && response.token && response.user) {
        setUser(response.user);
        return { success: true };
      } else {
        return { success: false, error: response.message || 'Registration failed' };
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error.response?.data?.message || 'Registration failed';
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
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      setLoading(false);
      // Even on error, clear local state
      setUser(null);
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      navigate('/login');
    }
  };

  const verifyMfa = async (email, mfaCode) => {
    try {
      setLoading(true);
      const response = await authService.verifyMfa(email, mfaCode);
      
      if (response.success && response.token && response.user) {
        setUser(response.user);
        return { success: true };
      } else {
        return { success: false, error: response.message || 'MFA verification failed' };
      }
    } catch (error) {
      console.error('MFA verification error:', error);
      const errorMessage = error.response?.data?.message || 'MFA verification failed';
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  };

  const updateUserProfile = (updatedData) => {
    const updatedUser = { ...user, ...updatedData };
    setUser(updatedUser);
    localStorage.setItem('user', JSON.stringify(updatedUser));
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
      {children}
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