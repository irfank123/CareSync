import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Container, Box, Typography, CircularProgress, Alert } from '@mui/material';

const Auth0Callback = () => {
  const { handleAuthCallback, loading: authLoading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const processAuth = async () => {
      console.log('Auth0Callback: Processing callback...');
      console.log('Auth0Callback: Full URL:', window.location.href);
      console.log('Auth0Callback: Location search params:', location.search);

      const params = new URLSearchParams(location.search);
      const authError = params.get('error');
      const errorCode = params.get('code');
      const state = params.get('state'); // Auth0 might include state

      console.log(`Auth0Callback: Error param = ${authError}`);
      console.log(`Auth0Callback: Code param = ${errorCode}`);
      console.log(`Auth0Callback: State param = ${state}`);

      if (authError) {
        const errorDescription = params.get('error_description') || 'Unknown error from Auth0.';
        console.error('Auth0Callback: Error received from Auth0:', authError, errorDescription);
        setError(`Authentication failed: ${errorDescription}`);
        setLoading(false);
        return;
      }

      if (!errorCode) {
        console.error('Auth0Callback: No authorization code found in URL.');
        setError('Authentication failed. No authorization code received.');
        setLoading(false);
        return;
      }

      try {
        console.log('Auth0Callback: Calling handleAuthCallback...');
        await handleAuthCallback();
        console.log('Auth0Callback: handleAuthCallback completed successfully.');
        
        // Determine redirect target based on localStorage or default
        const authType = localStorage.getItem('auth_type');
        let redirectPath = '/dashboard'; // Default patient dashboard
        if (authType === 'clinic') {
          redirectPath = '/clinic/dashboard';
        } else if (authType === 'doctor') {
          redirectPath = '/doctor-dashboard';
        }
        // Clear the type after use
        localStorage.removeItem('auth_type'); 

        console.log(`Auth0Callback: Redirecting to ${redirectPath}`);
        navigate(redirectPath, { replace: true });
        
      } catch (err) {
        console.error('Auth0Callback: Error during handleAuthCallback:', err);
        setError(err.message || 'An error occurred during authentication.');
        setLoading(false);
      }
    };

    processAuth();
  }, [handleAuthCallback, location, navigate]);

  // Combine local loading state with context loading state
  const isLoading = loading || authLoading;

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center'
        }}
      >
        {isLoading && (
          <>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 3 }}>
              Processing authentication... Please wait.
            </Typography>
          </>
        )}
        {!isLoading && error && (
          <Alert severity="error" sx={{ width: '100%', mt: 3 }}>
            {error}
          </Alert>
        )}
        {/* Optionally add a button to retry or go home if there's an error */}
      </Box>
    </Container>
  );
};

export default Auth0Callback; 