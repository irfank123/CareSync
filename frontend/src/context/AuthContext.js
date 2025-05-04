import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { toast } from 'react-toastify';
import { authService } from '../services/api';
import Cookies from 'js-cookie';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Manual reload user from localStorage
  const reloadUserFromStorage = () => {
    try {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');
      
      console.log('[AuthContext] Reloading user from storage:', { 
        hasToken: !!storedToken,
        hasUser: !!storedUser
      });
      
      if (storedToken && storedUser) {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
        console.log('[AuthContext] User reloaded from storage:', parsedUser.email);
        return true;
      }
      return false;
    } catch (error) {
      console.error('[AuthContext] Error reloading user from storage:', error);
      return false;
    }
  };

  // Additional check to ensure we always load user when token exists but user state is null
  useEffect(() => {
    if (!user && !loading) {
      const token = localStorage.getItem('token');
      if (token) {
        console.log('[AuthContext] Found token but no user state, reloading user');
        reloadUserFromStorage();
      }
    }
  }, [user, loading]);

  // List of public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];

  // Check for token expiration and refresh if needed
  useEffect(() => {
    const checkAuth = async () => {
      // No need to setLoading(true) here, default is true
      let isAuthenticated = false;
      try {
        console.log('[AuthContext] Starting auth check...');
        
        // Check if there's a conflict with Auth0 cookies
        const cookieToken = Cookies.get('token');
        if (cookieToken) {
          console.log('[AuthContext] Found Auth0/clinic cookie token. Will not use localStorage token to avoid conflicts.');
          // Don't set authenticated yet - let the ClinicAuthContext handle this token
          setLoading(false);
          return;
        }
        
        // Proceed with regular auth token check
        const token = localStorage.getItem('token');
        if (token) {
          console.log('[AuthContext] Found localStorage token, validating...');
          // Check if token is expired
          const tokenData = JSON.parse(atob(token.split('.')[1]));
          const expirationTime = tokenData.exp * 1000;
          
          if (expirationTime < Date.now()) {
            console.log('[AuthContext] localStorage token expired.');
            // Token expired, try to refresh (optional, might remove if causing issues)
            try {
              console.log('[AuthContext] Attempting token refresh...');
              await authService.refreshToken();
              // Re-fetch user data after refresh?
              const refreshedToken = localStorage.getItem('token');
              if(refreshedToken) {
                 // If refresh worked, need to re-validate and fetch user
                 // For simplicity now, let's just mark as unauthenticated and let user re-login
                 console.log('[AuthContext] Token refreshed, but requires re-validation/login.');
              } else {
                 throw new Error('Refresh failed to provide a new token.');
              }
            } catch (refreshError) {
              console.error('[AuthContext] Token refresh failed:', refreshError);
              // If refresh fails, clear storage but DON'T navigate yet
              localStorage.removeItem('token');
              localStorage.removeItem('user');
              setUser(null);
            }
          } else {
            // Token is valid and not expired
            console.log('[AuthContext] localStorage token is valid.');
            // Load user from localStorage using the reloadUserFromStorage function
            const reloaded = reloadUserFromStorage();
            isAuthenticated = reloaded;
          }
        } else {
          console.log('[AuthContext] No localStorage token found.');
          // No token found, user is not authenticated via standard flow
          setUser(null); // Ensure user state is null
        }
      } catch (error) {
        // This catch handles errors during token validation/parsing
        console.error('[AuthContext] Auth check/validation error:', error);
        // Clear potentially corrupted storage
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
      } finally {
        console.log(`[AuthContext] checkAuth finished. isAuthenticated: ${isAuthenticated}`);
        setLoading(false);
      }
    };

    checkAuth();
    // Only run on mount, navigate/location changes shouldn't trigger re-check here
  }, []);

  const login = async (credentials) => {
    try {
      setLoading(true);
      const response = await authService.login(credentials);
      console.log("Full login response:", response); // Debug log

      if (response.success && response.token) { // Check for token specifically
        // Store token and user data
        localStorage.setItem('token', response.token);
        localStorage.setItem('user', JSON.stringify(response.user));
        console.log("[AuthContext] Token and user stored in localStorage.");

        // Clear potential conflicting clinic cookie
        Cookies.remove('token', { path: '/' });
        Cookies.remove('auth_debug', { path: '/' });
        console.log("[AuthContext] Cleared potential clinic cookies.");

        // Set state BEFORE navigation
        setUser(response.user);
        
        // Add a small delay to ensure state updates
        setTimeout(() => {
          toast.success('Login successful!');
          
          // Navigate based on user role
          if (response.user.role === 'doctor') {
            navigate('/doctor-dashboard');
          } else if (response.user.role === 'patient') { // Be explicit for patient
            navigate('/dashboard'); // Or '/patient-dashboard' if that exists
          } else {
            // Fallback or handle other roles if necessary
            navigate('/');
          }
        }, 50);
        
        return { success: true };
      } else if (response.requiresMfa) {
        // Handle MFA - Don't store token yet
        localStorage.removeItem('token'); // Ensure no partial token storage
        localStorage.removeItem('user');
        setUser(null); // Keep user state null until MFA completes
        return { success: true, requiresMfa: true };
      } else {
        // Handle login failure
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
      // Call backend logout, ignore errors as we clear client-side anyway
      await authService.logout().catch(err => console.warn("Backend logout call failed, proceeding with client cleanup:", err));
    } finally {
      console.log("[AuthContext] Logging out, clearing ALL auth tokens...");
      
      // Clear state
      setUser(null);
      
      // Clear regular auth tokens
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Also clear clinic auth tokens (cookies) to avoid conflicts
      Cookies.remove('token', { path: '/' });
      Cookies.remove('auth_debug', { path: '/' });
      
      toast.info('You have been logged out');
      setLoading(false);
      navigate('/login');
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