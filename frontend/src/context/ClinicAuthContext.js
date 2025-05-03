import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { jwtDecode } from 'jwt-decode'; // Correct named import
import Cookies from 'js-cookie'; // Using js-cookie for easier cookie handling
import { axiosInstance } from '../services/api'; // Corrected import name

const ClinicAuthContext = createContext(null);

export const ClinicAuthProvider = ({ children }) => {
  const [clinicUser, setClinicUser] = useState(null);
  const [clinicInfo, setClinicInfo] = useState(null);
  const [isClinicAuthenticated, setIsClinicAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchClinicProfile = useCallback(async () => {
    setLoading(true);
    try {
      // Use the imported axiosInstance
      const response = await axiosInstance.get('/auth/clinic/me'); 
      if (response.data.success) {
        setClinicUser(response.data.user); // Contains user info (admin)
        setClinicInfo(response.data.clinic); // Contains clinic details
        setIsClinicAuthenticated(true);
        return true;
      }
      throw new Error('Failed to fetch clinic profile');
    } catch (error) {
      console.error('Error fetching clinic profile:', error);
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
      const token = Cookies.get('token');
      if (token) {
        try {
          const decoded = jwtDecode(token);
          // Check if token is expired
          const isExpired = decoded.exp * 1000 < Date.now();
          // Check if it looks like a clinic admin token (based on backend logic)
          // Note: Role might be just 'admin', check clinicId presence is safer
          const looksLikeClinicToken = decoded.role === 'admin' && decoded.clinicId;

          if (!isExpired && looksLikeClinicToken) {
            // Token exists, is not expired, and looks like a clinic token.
            // Fetch full profile from backend to confirm validity and get full data.
            await fetchClinicProfile();
          } else {
            // Token is expired or doesn\'t seem to be a clinic token
            Cookies.remove('token');
            setIsClinicAuthenticated(false);
            setLoading(false);
          }
        } catch (error) {
          console.error('Error decoding token:', error);
          Cookies.remove('token');
          setIsClinicAuthenticated(false);
          setLoading(false);
        }
      } else {
        setIsClinicAuthenticated(false);
        setLoading(false);
      }
    };

    validateTokenAndFetchUser();
    // Re-fetch profile when the function reference changes (though it shouldn't often)
  }, [fetchClinicProfile]);

  const logoutClinic = useCallback(async () => {
    setLoading(true);
    try {
      // Optional: Call a backend logout endpoint if one exists for clinics 
      // await axiosInstance.post('/auth/clinic/logout'); 
      console.log('Logging out clinic user');
    } catch (error) {
      console.error('Clinic logout error:', error);
      // Proceed with client-side logout even if backend fails
    } finally {
      Cookies.remove('token');
      setClinicUser(null);
      setClinicInfo(null);
      setIsClinicAuthenticated(false);
      setLoading(false);
      // Redirect to home or login page after logout
      window.location.href = '/'; // Simple redirect for now
    }
  }, []);

  const value = {
    clinicUser,
    clinicInfo,
    isClinicAuthenticated,
    loading,
    fetchClinicProfile, // Expose fetch profile in case manual refresh is needed
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