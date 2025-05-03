import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { CircularProgress, Box } from '@mui/material';

const ProtectedClinicRoute = ({ children }) => {
  const { isClinicAuthenticated, loading } = useClinicAuth();
  const location = useLocation();

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="100vh">
        <CircularProgress />
      </Box>
    );
  }

  if (!isClinicAuthenticated) {
    // If not authenticated, redirect them to the home page 
    // (where they can choose the Clinic Portal login).
    // Pass the current location so we can redirect back if needed (though Auth0 handles redirect).
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If authenticated, render the children components
  return children;
};

export default ProtectedClinicRoute; 