import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
} from '@mui/material';
import { useNavigate } from 'react-router-dom';

const DoctorDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const handleNavigate = (path) => {
    console.log('Navigating to:', path);
    console.log('Current user:', user);
    navigate(path);
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Doctor Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Welcome, Dr. {user?.firstName} {user?.lastName}
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Today's Appointments
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleNavigate('/appointments')}
              sx={{ mt: 2 }}
            >
              View Appointments
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Patient Management
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleNavigate('/patients')}
              sx={{ mt: 2 }}
            >
              View Patients
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Availability Management
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleNavigate('/manage-availability')}
              sx={{ mt: 2 }}
            >
              Manage Availability
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Profile Settings
            </Typography>
            <Button
              variant="contained"
              onClick={() => handleNavigate('/profile')}
              sx={{ mt: 2 }}
            >
              Update Profile
            </Button>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default DoctorDashboard; 