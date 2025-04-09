// import React from 'react';
// import { Navigate, useLocation } from 'react-router-dom';
// import { useAuth } from '../../context/AuthContext';
// import { CircularProgress, Box } from '@mui/material';

const AuthWrapper = ({ children }) => {


  /* Original code - uncomment when ready to restore auth
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
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

  // List of public routes that don't require authentication
  const publicRoutes = ['/', '/login', '/register'];

  // If the user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !publicRoutes.includes(location.pathname)) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the user is authenticated and trying to access auth routes
  if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
    return <Navigate to="/dashboard" replace />;
  }
  */

  return children;
};

export default AuthWrapper; 