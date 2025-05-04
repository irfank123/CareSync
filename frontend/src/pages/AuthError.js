import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Box, Typography, Button, Paper, Container } from '@mui/material';
import ErrorOutlineIcon from '@mui/icons-material/ErrorOutline';
import { useAuth } from '../context/AuthContext';
import { useClinicAuth } from '../context/ClinicAuthContext';

const AuthError = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const { isClinicAuthenticated } = useClinicAuth();
  
  // Get error message from URL query parameters
  const searchParams = new URLSearchParams(location.search);
  const errorMessage = searchParams.get('message') || 'An authentication error occurred';
  
  // Check if this is likely just a code reuse error after successful auth
  const isCodeReuseError = 
    (errorMessage.includes('Invalid authorization code') || 
     errorMessage.includes('code exchange failed')) &&
    (isAuthenticated || isClinicAuthenticated);
  
  useEffect(() => {
    // If user is authenticated even though there was an error,
    // they might have been automatically redirected here despite successful login
    if (isCodeReuseError) {
      // Instead of showing error, redirect to dashboard after a delay
      const timer = setTimeout(() => {
        if (isClinicAuthenticated) {
          navigate('/clinic-dashboard');
        } else if (isAuthenticated) {
          navigate('/dashboard');
        }
      }, 3000); // 3 second delay
      
      return () => clearTimeout(timer);
    }
  }, [isAuthenticated, isClinicAuthenticated, navigate, isCodeReuseError]);
  
  const handleGoHome = () => {
    navigate('/');
  };
  
  const handleTryAgain = () => {
    navigate('/');
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%', borderRadius: 2 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 3, flexDirection: 'column' }}>
            <ErrorOutlineIcon color="error" sx={{ fontSize: 60, mb: 2 }} />
            <Typography variant="h4" component="h1" gutterBottom>
              {isCodeReuseError ? 'Authentication Processing' : 'Authentication Error'}
            </Typography>
          </Box>
          
          <Typography variant="body1" paragraph align="center">
            {isCodeReuseError ? (
              'You appear to be logged in successfully! Redirecting to dashboard...'
            ) : (
              errorMessage
            )}
          </Typography>
          
          <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, gap: 2 }}>
            <Button variant="outlined" color="primary" onClick={handleGoHome}>
              Go Home
            </Button>
            {!isCodeReuseError && (
              <Button variant="contained" color="primary" onClick={handleTryAgain}>
                Try Again
              </Button>
            )}
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default AuthError; 