import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

const ProtectedRoute = ({ children, roles }) => {
  const { user, isAuthenticated, loading } = useAuth();
  const location = useLocation();

  console.log('ProtectedRoute:', {
    path: location.pathname,
    isAuthenticated,
    userRole: user?.role,
    requiredRoles: roles,
    user: user ? `${user.firstName} ${user.lastName} (${user.email})` : null
  });

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

  // Check if user is authenticated with regular auth (not clinic auth)
  if (!isAuthenticated) {
    console.log('User not authenticated, redirecting to login');
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // If no specific roles are required, any authenticated user can access
  if (!roles) {
    return children;
  }

  // Check if user has required role
  if (!roles.includes(user?.role)) {
    console.log(`User role (${user?.role}) does not match required roles:`, roles);
    
    // Redirect to appropriate dashboard based on user role
    if (user?.role === 'doctor') {
      return <Navigate to="/doctor-dashboard" replace />;
    } else if (user?.role === 'patient') {
      return <Navigate to="/dashboard" replace />;
    } else if (user?.role === 'staff') {
      return <Navigate to="/staff-dashboard" replace />;
    }
    
    // Fallback to general dashboard
    return <Navigate to="/dashboard" replace />;
  }

  // User is authenticated and has the required role
  return children;
};

export default ProtectedRoute; 