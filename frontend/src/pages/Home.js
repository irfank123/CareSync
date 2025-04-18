import React from 'react';
import { Link as RouterLink } from 'react-router-dom';
import {
  Box,
  Container,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  CardMedia,
} from '@mui/material';
import { useAuth } from '../context/AuthContext';

const features = [
  {
    title: 'Easy Appointment Booking',
    description: 'Book appointments with your preferred doctors in just a few clicks.',
    icon: '📅',
  },
  {
    title: 'Doctor Profiles',
    description: 'View detailed profiles of doctors, including their specialties and availability.',
    icon: '👨‍⚕️',
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
  const { isAuthenticated } = useAuth();

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
              <Box sx={{ mt: 4 }}>
                {isAuthenticated ? (
                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    component={RouterLink}
                    to="/dashboard"
                  >
                    Go to Dashboard
                  </Button>
                ) : (
                  <Button
                    variant="contained"
                    color="secondary"
                    size="large"
                    component={RouterLink}
                    to="/register"
                  >
                    Get Started
                  </Button>
                )}
              </Box>
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
                }}
              />
            </Grid>
          </Grid>
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