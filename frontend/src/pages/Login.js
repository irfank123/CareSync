import React from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import { Box, Button, Container, Typography, Paper } from '@mui/material';

const Login = () => {
  const { loginWithRedirect } = useAuth0();

  return (
    <Container maxWidth="sm">
      <Box sx={{ mt: 8, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <Paper elevation={3} sx={{ p: 4, display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
          <Typography component="h1" variant="h4" gutterBottom>
            Welcome to CareSync
          </Typography>
          <Typography variant="body1" sx={{ mb: 3, textAlign: 'center' }}>
            Please log in to access your healthcare dashboard
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={() => loginWithRedirect()}
            sx={{ mt: 2 }}
          >
            Log In
          </Button>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 