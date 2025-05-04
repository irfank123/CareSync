import React, { createContext, useState, useEffect, useContext, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react'; // Import useAuth0
import { jwtDecode } from 'jwt-decode'; // Keep for potential use, but primary auth is Auth0
import Cookies from 'js-cookie'; // Keep for removing old cookies
import { axiosInstance } from '../services/api';

const ClinicAuthContext = createContext(null);

export const ClinicAuthProvider = ({ children }) => {
  // Use Auth0 hook for primary authentication state
  const { 
    user: auth0User, 
    isAuthenticated: isAuth0Authenticated, 
    isLoading: auth0Loading, 
    logout: auth0Logout,
    getAccessTokenSilently // Needed if you call protected APIs later
  } = useAuth0();

  // State for additional clinic-specific info fetched from your backend
  const [clinicInfo, setClinicInfo] = useState(null);
  // Separate loading state for the backend profile fetch
  const [profileLoading, setProfileLoading] = useState(false);

  // Use Auth0's state for core authentication status and loading
  const isClinicAuthenticated = isAuth0Authenticated;
  const loading = auth0Loading; // Primary loading indicator tied to Auth0 init
  const clinicUser = auth0User; // Use the user object from Auth0

  // Function to fetch additional clinic profile data from backend *after* Auth0 login
  const fetchClinicProfile = useCallback(async () => {
    // Only fetch if authenticated via Auth0
    if (!isAuth0Authenticated) return;
    
    setProfileLoading(true);
    try {
      // --- Secure backend calls using the Auth0 Access Token ---
      const token = await getAccessTokenSilently();
      // Log the actual token value
      console.log('Auth0 Access Token fetched for /me request:', token); 
      const response = await axiosInstance.get('/api/auth/clinic/me', {
        headers: { Authorization: `Bearer ${token}` }
      });
      // --- Remove the fallback direct call ---
      // const response = await axiosInstance.get('/api/auth/clinic/me'); 
      
      if (response.data.success && response.data.clinic) {
        setClinicInfo(response.data.clinic);
      } else {
        console.warn('Could not fetch clinic-specific info from backend.');
        setClinicInfo(null); // Ensure state is clear if fetch fails
      }
    } catch (error) {
      console.error('Error fetching clinic profile from backend:', error);
      setClinicInfo(null);
    } finally {
      setProfileLoading(false);
    }
  }, [isAuth0Authenticated, getAccessTokenSilently]); // Add dependencies

  // Fetch backend profile info when Auth0 authentication completes
  useEffect(() => {
    if (isAuth0Authenticated) {
      fetchClinicProfile();
    } else {
      // Clear clinic-specific info if Auth0 session ends
      setClinicInfo(null);
    }
  }, [isAuth0Authenticated, fetchClinicProfile]); // Depend on Auth0 state

  // Logout function: Clears Auth0 session and potentially local state/cookies
  const logoutClinic = useCallback(() => {
    console.log('Logging out clinic user via Auth0...');
    // Clear any old backend cookies just in case
    Cookies.remove('token'); 
    // Trigger Auth0 logout - redirects to Auth0 logout endpoint
    // and then back to the configured logout URL (usually app root)
    auth0Logout({ logoutParams: { returnTo: window.location.origin } });
    // No need to manually set state here, Auth0Provider handles it after redirect
  }, [auth0Logout]);

  const value = {
    clinicUser, // User object from Auth0
    clinicInfo, // Additional info from backend
    isClinicAuthenticated, // Auth state from Auth0
    loading: loading || profileLoading, // Combined loading state
    fetchClinicProfile,
    logoutClinic, // Use this for logout buttons
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