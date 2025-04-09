import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';

const Register = () => {
  const { loginWithRedirect } = useAuth0();

  const handleSignUp = () => {
    loginWithRedirect({
      screen_hint: 'signup',
    });
  };

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography component="h1" variant="h4" gutterBottom>
            Join CareSync
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
            Create your account to get started with CareSync
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={handleSignUp}
            sx={{ mt: 2 }}
          >
            Sign Up
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default Register; 