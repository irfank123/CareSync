import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();

  console.log(`AuthWrapper: Path=${location.pathname}, Loading=${loading}, Authenticated=${isAuthenticated}`);

  if (loading) {
    console.log("AuthWrapper: Showing loading indicator");
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
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/forgot-password',
    '/clinic/login',
    '/clinic/register',
    '/callback'
  ];

  // If the user is not authenticated and trying to access a protected route
  if (!isAuthenticated && !publicRoutes.includes(location.pathname)) {
    console.log(`AuthWrapper: Redirecting unauthenticated user from protected route ${location.pathname} to /login`);
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If the user is authenticated and trying to access auth routes
  if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
    console.log(`AuthWrapper: Redirecting authenticated user from ${location.pathname} to /dashboard`);
    return <Navigate to="/dashboard" replace />;
  }

  console.log(`AuthWrapper: Rendering children for path ${location.pathname}`);
  return children;
};

export default AuthWrapper; 