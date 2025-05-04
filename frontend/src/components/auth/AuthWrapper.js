import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { CircularProgress, Box } from '@mui/material';

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, loading: clientLoading, user: clientUser } = useAuth();
  const { isClinicAuthenticated, loading: clinicLoading } = useClinicAuth();
  const location = useLocation();

  const loading = clientLoading || clinicLoading;

  if (loading) {
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

  if (isClinicAuthenticated && location.pathname === '/') {
    console.log('AuthWrapper: Clinic user authenticated, redirecting from / to /clinic-dashboard');
    return <Navigate to="/clinic-dashboard" replace />;
  }

  const publicRoutes = ['/', '/login', '/register', '/forgot-password'];

  if (!isAuthenticated && !publicRoutes.includes(location.pathname) && location.pathname !== '/clinic-dashboard') {
    console.log('AuthWrapper: Client not authenticated, redirecting to /login from:', location.pathname);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
    const clientDashboardPath = clientUser?.role === 'doctor' ? '/doctor-dashboard' : '/dashboard';
    console.log('AuthWrapper: Client authenticated, redirecting from login/register to:', clientDashboardPath);
    return <Navigate to={clientDashboardPath} replace />;
  }

  if (isAuthenticated && location.pathname === '/clinic-dashboard') {
    console.log('AuthWrapper: Authenticated client attempting to access /clinic-dashboard, redirecting to client dashboard');
    const clientDashboardPath = clientUser?.role === 'doctor' ? '/doctor-dashboard' : '/dashboard';
    return <Navigate to={clientDashboardPath} replace />;
  }

  return children;
};

export default AuthWrapper; 