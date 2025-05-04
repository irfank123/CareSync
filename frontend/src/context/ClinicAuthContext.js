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
    setLoading(true);
    setAuthError(null);
    try {
      // Use the imported axiosInstance with proper Authorization header
      const token = Cookies.get('token');
      if (!token) {
        console.log('No token found in cookies');
        throw new Error('No authentication token found');
      }
      
      console.log('Fetching clinic profile with token from cookies');
      
      // Set token in axiosInstance for this request
      const response = await axiosInstance.get('/auth/clinic/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      
      if (response.data.success) {
        console.log('Successfully fetched clinic profile:', response.data);
        setClinicUser(response.data.user);
        setClinicInfo(response.data.clinic);
        setIsClinicAuthenticated(true);
        return true;
      }
      throw new Error('Failed to fetch clinic profile');
    } catch (error) {
      const errorMsg = error.response?.data?.message || error.message;
      console.error('Error fetching clinic profile:', errorMsg);
      setAuthError(errorMsg);
      
      // Clear potentially invalid token/state if fetch fails
      Cookies.remove('token'); 
      setClinicUser(null);
      setClinicInfo(null);
      setIsClinicAuthenticated(false);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const validateTokenAndFetchUser = async () => {
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
          console.log('No clinic auth token found in cookies');
          setIsClinicAuthenticated(false);
          setLoading(false);
          return;
        }
        
        try {
          // Validate token by decoding it
          console.log('Validating clinic token from cookies');
          const decoded = jwtDecode(token);
          
          // Check if token is expired
          const isExpired = decoded.exp * 1000 < Date.now();
          if (isExpired) {
            console.log('Token is expired, expiry:', new Date(decoded.exp * 1000).toLocaleString());
            Cookies.remove('token');
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
            setIsClinicAuthenticated(false);
            setAuthError('Invalid authentication token');
            setLoading(false);
            return;
          }
          
          console.log('Token validation successful, fetching full profile');
          // Token looks valid, fetch full profile from server
          await fetchClinicProfile();
        } catch (decodeError) {
          console.error('Token decode error:', decodeError);
          Cookies.remove('token');
          setIsClinicAuthenticated(false);
          setAuthError('Invalid token format');
          setLoading(false);
        }
      } catch (error) {
        console.error('Auth validation error:', error);
        Cookies.remove('token');
        setIsClinicAuthenticated(false);
        setAuthError('Authentication error');
        setLoading(false);
      }
    };

    validateTokenAndFetchUser();
  }, [fetchClinicProfile]);

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
      Cookies.remove('token', { path: '/' });
      setClinicUser(null);
      setClinicInfo(null);
      setIsClinicAuthenticated(false);
      setLoading(false);
      setAuthError(null);
      // Redirect to home page after logout
      window.location.href = '/';
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