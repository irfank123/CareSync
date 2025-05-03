import React, { useEffect } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Box,
  Typography,
  Button,
  Link,
  Paper,
  CircularProgress,
} from '@mui/material';
import auth0Service from '../services/auth0Service';

const ClinicLogin = () => {
  useEffect(() => {
    // Redirect to Auth0 for clinic login
    auth0Service.loginWithAuth0();
    
    // This component will unmount during redirect, 
    // returning here only happens if there was an issue with the redirect
  }, []);

  return (
    <Container component="main" maxWidth="sm">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper
          elevation={3}
          sx={{
            p: 4,
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <Typography component="h1" variant="h4" gutterBottom>
            Redirecting to Secure Login
          </Typography>
          
          <Box sx={{ mt: 4, mb: 4, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <CircularProgress size={60} />
            <Typography variant="body1" sx={{ mt: 3, textAlign: 'center' }}>
              Redirecting you to our secure login page...
            </Typography>
          </Box>
          
          <Box sx={{ mt: 2, textAlign: 'center' }}>
            <Typography variant="body2" color="text.secondary" gutterBottom>
              If you are not redirected automatically, please click the button below:
            </Typography>
            <Button 
              variant="contained" 
              onClick={() => auth0Service.loginWithAuth0()}
              sx={{ mt: 1 }}
            >
              Go to Login
            </Button>
          </Box>
          
          <Box sx={{ mt: 3, textAlign: 'center' }}>
            <Link component={RouterLink} to="/clinic/register" variant="body2">
              {"Don't have a clinic account? Register here"}
            </Link>
          </Box>
          <Box sx={{ mt: 1, textAlign: 'center' }}>
            <Link component={RouterLink} to="/" variant="body2">
              {"Back to Home"}
            </Link>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default ClinicLogin; 