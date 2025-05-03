import React from 'react';
import { useLocation, Link as RouterLink } from 'react-router-dom';
import { Container, Typography, Paper, Box, Alert, Button } from '@mui/material';

const AuthError = () => {
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const errorMessage = queryParams.get('message') || 'An unknown authentication error occurred.';

  return (
    <Container component="main" maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography variant="h5" component="h1" gutterBottom align="center">
            Authentication Error
          </Typography>
          <Alert severity="error" sx={{ mb: 3 }}>
            {decodeURIComponent(errorMessage)} 
          </Alert>
          <Button 
            component={RouterLink} 
            to="/" 
            variant="contained" 
            fullWidth
          >
            Return to Home
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default AuthError; 