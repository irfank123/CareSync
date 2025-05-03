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
  Stack,
  Paper,
  useTheme,
} from '@mui/material';
import LocalHospitalIcon from '@mui/icons-material/LocalHospital';
import PersonIcon from '@mui/icons-material/Person';

const Landing = () => {
  const theme = useTheme();

  return (
    <Box>
      {/* Hero Section */}
      <Box
        sx={{
          bgcolor: 'primary.main',
          color: 'white',
          py: 8,
          mb: 6,
        }}
      >
        <Container maxWidth="lg">
          <Typography variant="h2" component="h1" gutterBottom align="center">
            Welcome to CareSync
          </Typography>
          <Typography variant="h5" gutterBottom align="center">
            Your all-in-one healthcare management platform
          </Typography>
        </Container>
      </Box>

      {/* Options Section */}
      <Container maxWidth="lg">
        <Grid container spacing={4} justifyContent="center">
          {/* Clinic Option */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                },
              }}
            >
              <LocalHospitalIcon sx={{ fontSize: 60, color: 'primary.main', mb: 2 }} />
              <Typography variant="h4" component="h2" gutterBottom>
                For Clinics
              </Typography>
              <Typography variant="body1" sx={{ mb: 4 }}>
                Manage your clinic, staff, and patients all in one place. Streamline your operations
                and provide better healthcare services.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  component={RouterLink}
                  to="/clinic/login"
                >
                  Login as Clinic
                </Button>
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  component={RouterLink}
                  to="/clinic/register"
                >
                  Register Clinic
                </Button>
              </Stack>
            </Paper>
          </Grid>

          {/* Patient/Doctor Option */}
          <Grid item xs={12} md={6}>
            <Paper
              elevation={3}
              sx={{
                p: 4,
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                transition: 'transform 0.2s',
                '&:hover': {
                  transform: 'translateY(-5px)',
                },
              }}
            >
              <PersonIcon sx={{ fontSize: 60, color: 'secondary.main', mb: 2 }} />
              <Typography variant="h4" component="h2" gutterBottom>
                For Patients & Doctors
              </Typography>
              <Typography variant="body1" sx={{ mb: 4 }}>
                Schedule appointments, access medical records, and communicate with your
                healthcare providers securely.
              </Typography>
              <Stack direction="row" spacing={2}>
                <Button
                  variant="contained"
                  color="secondary"
                  size="large"
                  component={RouterLink}
                  to="/login"
                >
                  Login
                </Button>
                <Button
                  variant="outlined"
                  color="secondary"
                  size="large"
                  component={RouterLink}
                  to="/register"
                >
                  Register
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </Grid>

        {/* Features Section */}
        <Box sx={{ mt: 8, mb: 4 }}>
          <Typography variant="h3" component="h2" align="center" gutterBottom>
            Why Choose CareSync?
          </Typography>
          <Grid container spacing={4} sx={{ mt: 2 }}>
            {features.map((feature, index) => (
              <Grid item xs={12} sm={6} md={3} key={index}>
                <Card
                  sx={{
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    transition: 'transform 0.2s',
                    '&:hover': {
                      transform: 'translateY(-5px)',
                    },
                  }}
                >
                  <CardContent sx={{ flexGrow: 1, textAlign: 'center' }}>
                    <Typography variant="h1" align="center" gutterBottom>
                      {feature.icon}
                    </Typography>
                    <Typography variant="h6" component="h3" gutterBottom>
                      {feature.title}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {feature.description}
                    </Typography>
                  </CardContent>
                </Card>
              </Grid>
            ))}
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

const features = [
  {
    title: 'Streamlined Booking',
    description: 'Easy appointment scheduling for both clinics and patients.',
    icon: '📅',
  },
  {
    title: 'Secure Platform',
    description: 'HIPAA-compliant security for all your medical data.',
    icon: '🔒',
  },
  {
    title: 'Easy Management',
    description: 'Efficient clinic and patient management tools.',
    icon: '⚡',
  },
  {
    title: '24/7 Access',
    description: 'Access your health information anytime, anywhere.',
    icon: '🌐',
  },
];

export default Landing; 