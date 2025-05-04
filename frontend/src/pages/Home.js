import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
  CardActions,
  CircularProgress,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';
import { useClinicAuth } from '../context/ClinicAuthContext';

const features = [
  {
    title: 'Appointment Management',
    description: 'Schedule and manage your appointments with ease.',
    icon: '📅',
  },
  {
    title: 'Prescription Tracking',
    description: 'Keep track of your prescriptions and medications.',
    icon: '💊',
  },
  {
    title: 'Medical History',
    description: 'Keep track of your medical history and appointments in one place.',
    icon: '📋',
  },
  {
    title: 'Secure Communication',
    description: 'Communicate securely with your healthcare providers.',
    icon: '🔒',
  },
];

const Home = () => {
  const { isAuthenticated: isClientAuthenticated, user: clientUser } = useAuth();
  const { isClinicAuthenticated, loading: clinicLoading } = useClinicAuth();
  const navigate = useNavigate();

  // Initiate Auth0 login/signup flow by redirecting to the backend endpoint
  const initiateAuth0Flow = () => {
    const baseApiUrl = process.env.REACT_APP_API_URL || window.location.origin;
    
    try {
      // Create a URL object for easier manipulation
      const apiUrl = new URL(baseApiUrl);
      
      // The clinic auth0 login endpoint
      const authPath = '/auth/clinic/auth0/login';
      
      // If the API URL already has a path (e.g. /api), we need to properly join them
      let finalPath;
      if (apiUrl.pathname === '/' || apiUrl.pathname === '') {
        // If API URL has no specific path, we need to add /api prefix
        finalPath = `/api${authPath}`;
      } else {
        // If API URL already has a path like /api, just append our auth path
        // Remove trailing slash from pathname if it exists
        const basePath = apiUrl.pathname.endsWith('/') 
          ? apiUrl.pathname.slice(0, -1) 
          : apiUrl.pathname;
        finalPath = `${basePath}${authPath}`;
      }
      
      // Set the new pathname and create the full URL
      apiUrl.pathname = finalPath;
      const finalUrl = apiUrl.toString();
      
      console.log('Redirecting to Auth0 backend URL:', finalUrl);
      window.location.href = finalUrl;
    } catch (error) {
      console.error('Error constructing Auth0 login URL:', error);
      alert('Could not initiate OAuth login. Please try again or contact support.');
    }
  };

  // Both login and signup for the clinic portal now initiate the same Auth0 flow
  const handleClinicLogin = () => {
    console.log('Initiating Clinic Auth0 Login...');
    initiateAuth0Flow();
  };

  const handleClinicSignUp = () => {
    console.log('Initiating Clinic Auth0 Sign Up...');
    initiateAuth0Flow();
  };

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          py: 8,
        }}
      >
        <Container maxWidth="lg">
          <Grid container spacing={4} alignItems="center">
            <Grid item xs={12} md={6}>
              <Typography variant="h2" component="h1" gutterBottom>
                Welcome to CareSync
              </Typography>
              <Typography variant="h5" gutterBottom>
                Your all-in-one healthcare management platform
              </Typography>
            </Grid>
            <Grid item xs={12} md={6}>
              <Box
                component="img"
                src="/hero-image.png"
                alt="Healthcare illustration"
                sx={{
                  width: '100%',
                  maxWidth: 500,
                  height: 'auto',
                  display: { xs: 'none', md: 'block' }
                }}
              />
            </Grid>
          </Grid>

          <Box sx={{ mt: 6 }}>
            <Typography variant="h4" component="h2" align="center" gutterBottom sx={{ mb: 4 }}>
              Access Your Portal
            </Typography>
            <Grid container spacing={4} justifyContent="center">
              <Grid item xs={12} sm={6} md={5}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" component="div" gutterBottom>
                      Client Portal
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      For Patients and Doctors. Access your appointments, records, and manage your healthcare journey.
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                    {isClientAuthenticated && (clientUser?.role === 'patient' || clientUser?.role === 'doctor') ? (
                      <Button
                        variant="contained"
                        color="secondary"
                        onClick={() => navigate(clientUser.role === 'doctor' ? '/doctor-dashboard' : '/dashboard')}
                      >
                        Go to Dashboard
                      </Button>
                    ) : (
                      <>
                        <Button variant="contained" color="secondary" component={RouterLink} to="/login" disabled={isClinicAuthenticated}>
                          Login
                        </Button>
                        <Button variant="outlined" color="secondary" component={RouterLink} to="/register" sx={{ ml: 1 }} disabled={isClinicAuthenticated}>
                          Sign Up
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>

              <Grid item xs={12} sm={6} md={5}>
                <Card sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <CardContent sx={{ flexGrow: 1 }}>
                    <Typography variant="h5" component="div" gutterBottom>
                      Clinic Portal
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                      For Clinic Administrators. Manage clinic operations, staff, and integrations. (Auth0 Login)
                    </Typography>
                  </CardContent>
                  <CardActions sx={{ justifyContent: 'center', pb: 2 }}>
                    {clinicLoading ? (
                      <CircularProgress size={24} /> 
                    ) : isClinicAuthenticated ? (
                      <Button 
                        variant="contained" 
                        color="secondary"
                        onClick={() => navigate('/clinic-dashboard')}
                      >
                        Go to Clinic Dashboard
                      </Button>
                    ) : (
                      <>
                        <Button variant="contained" color="secondary" onClick={handleClinicLogin} disabled={isClientAuthenticated}>
                          Login
                        </Button>
                        <Button variant="outlined" color="secondary" onClick={handleClinicSignUp} sx={{ ml: 1 }} disabled={isClientAuthenticated}>
                          Sign Up
                        </Button>
                      </>
                    )}
                  </CardActions>
                </Card>
              </Grid>
            </Grid>
          </Box>
        </Container>
      </Box>

      {/* Features Section */}
      <Container maxWidth="lg" sx={{ py: 8 }}>
        <Typography variant="h3" component="h2" align="center" gutterBottom>
          Features
        </Typography>
        <Grid container spacing={4} sx={{ mt: 2 }}>
          {features.map((feature, index) => (
            <Grid item xs={12} sm={6} md={3} key={index}>
              <Card
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                }}
              >
                <CardContent sx={{ flexGrow: 1 }}>
                  <Typography variant="h1" align="center" gutterBottom>
                    {feature.icon}
                  </Typography>
                  <Typography variant="h5" component="h3" gutterBottom>
                    {feature.title}
                  </Typography>
                  <Typography>{feature.description}</Typography>
                </CardContent>
              </Card>
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  );
};

export default Home; 