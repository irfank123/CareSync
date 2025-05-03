import React, { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import auth0Service from '../services/auth0Service';

const Auth0Callback = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const handleCallback = async () => {
      try {
        // Get the authorization code from the URL
        const urlParams = new URLSearchParams(location.search);
        const code = urlParams.get('code');
        
        if (!code) {
          setError('Authentication failed. No authorization code received.');
          setLoading(false);
          return;
        }
        
        // Exchange code for token
        const result = await auth0Service.handleAuth0Callback(code);
        
        if (result.success) {
          // Check if it's a clinic login or user login
          const authType = localStorage.getItem('auth_type');
          
          // Navigate to the appropriate dashboard
          if (authType === 'clinic') {
            navigate('/clinic/dashboard');
          } else {
            // For regular users, determine which dashboard to show based on role
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            
            if (user.role === 'doctor') {
              navigate('/doctor-dashboard');
            } else {
              navigate('/dashboard');
            }
          }
        } else {
          setError(result.error || 'Authentication failed');
        }
      } catch (err) {
        console.error('Auth0 callback error:', err);
        setError('An error occurred while processing your login. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    handleCallback();
  }, [navigate, location]);

  return (
    <Container maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        {loading ? (
          <>
            <CircularProgress size={60} />
            <Typography variant="h6" sx={{ mt: 3 }}>
              Completing authentication...
            </Typography>
          </>
        ) : error ? (
          <Alert severity="error" sx={{ width: '100%', mt: 2 }}>
            {error}
          </Alert>
        ) : (
          <Typography variant="h6" color="primary">
            Authentication successful! Redirecting...
          </Typography>
        )}
      </Box>
    </Container>
  );
};

export default Auth0Callback; 