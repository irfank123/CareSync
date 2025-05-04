import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode';
import Cookies from 'js-cookie';
import { axiosInstance } from '../services/api';

const ClinicAuthContext = createContext(null);

export const ClinicAuthProvider = ({ children }) => {
  const [clinicUser, setClinicUser] = useState(null);
  const [clinicInfo, setClinicInfo] = useState(null);
  const [isClinicAuthenticated, setIsClinicAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(null);

  const fetchClinicProfile = useCallback(async () => {
    console.log('[fetchClinicProfile] Starting...');
    setLoading(true);
    setAuthError(null);
    try {
      const token = Cookies.get('token');
      if (!token) {
        console.log('[fetchClinicProfile] No token found in cookies');
        throw new Error('No authentication token found');
      }
      console.log('[fetchClinicProfile] Fetching /me...');
      const response = await axiosInstance.get('/auth/clinic/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      console.log('[fetchClinicProfile] /me response status:', response.status);
      if (response.data.success) {
        console.log('[fetchClinicProfile] Success! Setting state...');
        setClinicUser(response.data.user);
        setClinicInfo(response.data.clinic);
        setIsClinicAuthenticated(true);
        console.log('[fetchClinicProfile] State set: isAuth=true');
        return true;
      }
      console.log('[fetchClinicProfile] API call did not return success=true');
      throw new Error('Failed to fetch clinic profile');
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('[fetchClinicProfile] Error fetching clinic profile:', errorMsg);
      setAuthError(errorMsg);
      
      // Clear potentially invalid token/state if fetch fails
      Cookies.remove('token'); 
      setClinicUser(null);
      setClinicInfo(null);
      console.log('[fetchClinicProfile] Error! Setting state: isAuth=false');
      setIsClinicAuthenticated(false);
      return false;
    } finally {
      console.log('[fetchClinicProfile] Finally block. Setting loading=false');
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const validateTokenAndFetchUser = async () => {
      console.log('[Context useEffect] Starting validation...');
      setLoading(true);
      setAuthError(null);
      try {
        // Check URL for error parameters (from Auth0 redirect)
        const urlParams = new URLSearchParams(window.location.search);
        const error = urlParams.get('error');
        const errorDescription = urlParams.get('error_description');
        
        if (error) {
          console.error('Auth error in URL:', error, errorDescription);
          setAuthError(errorDescription || error);
          setLoading(false);
          return;
        }
        
        // Look for token in cookies
        const token = Cookies.get('token');
        if (!token) {
          console.log('[Context useEffect] No token found. Setting state: isAuth=false, loading=false');
          setIsClinicAuthenticated(false);
          setLoading(false);
          return;
        }
        console.log('[Context useEffect] Token found:', token.substring(0, 10) + '...');
        
        try {
          // Validate token by decoding it
          console.log('[Context useEffect] Validating clinic token from cookies');
          const decoded = jwtDecode(token);
          
          // Check if token is expired
          const isExpired = decoded.exp * 1000 < Date.now();
          if (isExpired) {
            console.log('Token is expired, expiry:', new Date(decoded.exp * 1000).toLocaleString());
            Cookies.remove('token');
            console.log('[Context useEffect] Expired Token! Setting state: isAuth=false, loading=false');
            setIsClinicAuthenticated(false);
            setAuthError('Authentication session expired');
            setLoading(false);
            return;
          }
          
          // Verify this is a clinic token - should have clinicId or appropriate role
          const isClinicToken = decoded.clinicId || 
                               (decoded.role === 'admin' && decoded.type === 'user');
          
          if (!isClinicToken) {
            console.log('Not a valid clinic token:', decoded);
            Cookies.remove('token');
            console.log('[Context useEffect] Invalid Clinic Token! Setting state: isAuth=false, loading=false');
            setIsClinicAuthenticated(false);
            setAuthError('Invalid authentication token');
            setLoading(false);
            return;
          }
          
          console.log('[Context useEffect] Token validation successful. Calling fetchClinicProfile...');
          const fetchSuccess = await fetchClinicProfile();
          console.log('[Context useEffect] fetchClinicProfile returned:', fetchSuccess);
        } catch (decodeError) {
          console.error('Token decode error:', decodeError);
          Cookies.remove('token');
          console.log('[Context useEffect] Decode Error! Setting state: isAuth=false, loading=false');
          setIsClinicAuthenticated(false);
          setAuthError('Invalid token format');
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        Cookies.remove('token');
        console.log('[Context useEffect] Top Level Error! Setting state: isAuth=false, loading=false');
        setIsClinicAuthenticated(false);
        setAuthError('Authentication error');
        setLoading(false);
      }
    };

    validateTokenAndFetchUser();
  }, []);

  useEffect(() => {
    // Check URL for code_reuse parameter (from special Auth0 redirect)
    const urlParams = new URLSearchParams(window.location.search);
    const authStatus = urlParams.get('auth');
    
    if (authStatus === 'success' || authStatus === 'code_reuse') {
      console.log(`[ClinicAuthContext] Auth status detected in URL: ${authStatus}`);
      // If we see auth=success or auth=code_reuse in URL, trigger a profile fetch
      // This helps after Auth0 redirects back to the dashboard
      setLoading(true);
      fetchClinicProfile().finally(() => {
        // Clear the URL params after processing
        if (window.history && window.history.replaceState) {
          const cleanUrl = window.location.pathname;
          window.history.replaceState({}, document.title, cleanUrl);
        }
      });
    }
  }, []);
  
  // Added for debugging - this will help track route changes
  useEffect(() => {
    console.log(`[ClinicAuthContext] Route changed: ${window.location.pathname}${window.location.search}`);
    console.log(`[ClinicAuthContext] Auth state: isClinicAuthenticated=${isClinicAuthenticated}, loading=${loading}`);
    
    // If we're on the clinic dashboard and not authenticated and not loading, try to fetch profile
    if (window.location.pathname.includes('/clinic-dashboard') && !isClinicAuthenticated && !loading) {
      console.log('[ClinicAuthContext] On clinic dashboard but not authenticated - trying to fetch profile');
      fetchClinicProfile();
    }
  }, [window.location.pathname, window.location.search]);

  const logoutClinic = useCallback(async () => {
    setLoading(true);
    try {
      // Call the clinic logout endpoint 
      await axiosInstance.post('/auth/clinic/logout');
      console.log('Clinic user logged out successfully');
    } catch (error) {
      console.error('Clinic logout error:', error);
      // Proceed with client-side logout even if backend fails
    } finally {
      console.log('[ClinicAuthContext] Logging out, clearing ALL auth tokens...');
      
      // Clear clinic-specific storage (cookie)
      Cookies.remove('token', { path: '/' }); 
      Cookies.remove('auth_debug', { path: '/' });
      
      // Also clear potential regular user tokens to prevent conflicts
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      
      // Clear state
      setClinicUser(null);
      setClinicInfo(null);
      setIsClinicAuthenticated(false);
      setLoading(false);
      setAuthError(null);
      
      // Redirect to home page after logout
      window.location.href = '/'; // Use window.location to ensure full page refresh
    }
  }, []);

  const value = {
    clinicUser,
    clinicInfo,
    isClinicAuthenticated,
    loading,
    authError,
    fetchClinicProfile,
    logoutClinic,
  };

  return (
    <ClinicAuthContext.Provider value={value}>
      {children}
    </ClinicAuthContext.Provider>
  );
};

// Custom hook to use the ClinicAuthContext
export const useClinicAuth = () => {
  const context = useContext(ClinicAuthContext);
  if (context === undefined) {
    throw new Error('useClinicAuth must be used within a ClinicAuthProvider');
  }
  return context;
}; 