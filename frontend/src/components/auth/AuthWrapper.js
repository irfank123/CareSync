import React, { useEffect } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { CircularProgress, Box } from '@mui/material';
import Cookies from 'js-cookie';

const AuthWrapper = ({ children }) => {
  const { isAuthenticated: isRegularAuth, loading: regularLoading, user } = useAuth();
  const { isClinicAuthenticated, loading: clinicLoading, clinicUser } = useClinicAuth();
  const location = useLocation();

  // Log authentication state for debugging
  useEffect(() => {
    // Direct check of tokens for debugging
    const localStorageToken = localStorage.getItem('token');
    const cookieToken = Cookies.get('token');
    
    console.log('AuthWrapper - Auth State:', {
      regularAuth: isRegularAuth,
      clinicAuth: isClinicAuthenticated,
      regularUser: user?.email,
      clinicUser: clinicUser?.email,
      hasLocalToken: !!localStorageToken,
      hasCookieToken: !!cookieToken,
      localTokenStart: localStorageToken ? localStorageToken.substring(0, 10) + '...' : 'none',
      path: location.pathname
    });
  }, [isRegularAuth, isClinicAuthenticated, user, clinicUser, location.pathname]);

  if (regularLoading || clinicLoading) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        minHeight="100vh"
      >
        <CircularProgress />
      </Box>
    );
  }

  // Direct token check for temporary override
  const localStorageToken = localStorage.getItem('token');
  // If we have a token in localStorage but context didn't pick it up, consider auth in progress
  const localTokenButNoAuth = !!localStorageToken && !isRegularAuth;
  
  if (localTokenButNoAuth && !regularLoading) {
    console.log('AuthWrapper - Found localStorage token but auth context not updated yet. Allowing access temporarily.');
    // If we have a token but the context hasn't updated, still render the children
    return children;
  }

  const isAnyAuthenticated = isRegularAuth || isClinicAuthenticated;

  // List of paths that don't require authentication
  const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/auth/error'];

  // Special case for clinic-dashboard - requires clinic auth only
  if (location.pathname === '/clinic-dashboard' && !isClinicAuthenticated) {
    // Only redirect if explicitly trying to access clinic dashboard without clinic auth
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // For all other protected routes, check if any authentication is valid
  if (!isAnyAuthenticated && !publicRoutes.includes(location.pathname)) {
    console.log('Not authenticated for', location.pathname, '- redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};

export default AuthWrapper; 