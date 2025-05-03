import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Grid,
  Paper,
  Button,
  CircularProgress,
  Alert,
} from '@mui/material';
import { clinicAuthService } from '../services/api';

const ClinicDashboard = () => {
  const navigate = useNavigate();
  const [clinic, setClinic] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        setLoading(true);
        const response = await clinicAuthService.getProfile();
        
        if (response.success) {
          setClinic(response.clinic);
        } else {
          setError('Failed to load clinic data');
        }
      } catch (error) {
        console.error('Error fetching clinic data:', error);
        setError('Failed to load clinic data. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchClinicData();
  }, []);

  // Helper function to get verification status chip color
  const getVerificationColor = (status) => {
    switch (status) {
      case 'verified':
        return '#4caf50'; // green
      case 'pending':
        return '#ff9800'; // orange
      case 'rejected':
        return '#f44336'; // red
      default:
        return '#9e9e9e'; // grey
    }
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
        <CircularProgress />
        <Typography variant="h6" sx={{ mt: 2 }}>
          Loading clinic dashboard...
        </Typography>
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
        <Box sx={{ mt: 2, textAlign: 'center' }}>
          <Button variant="contained" onClick={() => navigate('/')}>
            Return to Home
          </Button>
        </Box>
      </Container>
    );
  }

  // Use local storage as a fallback if API call fails
  const clinicData = clinic || JSON.parse(localStorage.getItem('clinic') || '{}');

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Clinic Dashboard
      </Typography>
      
      {clinicData.verificationStatus !== 'verified' && (
        <Alert severity={clinicData.verificationStatus === 'rejected' ? 'error' : 'warning'} sx={{ mb: 3 }}>
          {clinicData.verificationStatus === 'pending' 
            ? 'Your clinic is pending verification. Some features may be limited until verification is complete.'
            : 'Your clinic verification was rejected. Please contact support for more information.'}
        </Alert>
      )}

      <Grid container spacing={3}>
        {/* Clinic Profile Card */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Clinic Profile
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Typography variant="body1" gutterBottom>
                <strong>Name:</strong> {clinicData.name || 'N/A'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Email:</strong> {clinicData.email || 'N/A'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Phone:</strong> {clinicData.phone || 'N/A'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Address:</strong> {clinicData.address || 'N/A'}
              </Typography>
              <Typography variant="body1" gutterBottom>
                <strong>Verification Status:</strong>{' '}
                <Box
                  component="span"
                  sx={{
                    display: 'inline-block',
                    px: 1,
                    py: 0.5,
                    borderRadius: 1,
                    backgroundColor: getVerificationColor(clinicData.verificationStatus),
                    color: 'white',
                  }}
                >
                  {clinicData.verificationStatus || 'pending'}
                </Box>
              </Typography>
            </Box>
            <Box sx={{ mt: 3 }}>
              <Button variant="contained" onClick={() => navigate('/clinic/profile')}>
                Edit Profile
              </Button>
            </Box>
          </Paper>
        </Grid>
        
        {/* Quick Actions */}
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" gutterBottom>
              Quick Actions
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => navigate('/clinic/staff')}
                  disabled={clinicData.verificationStatus !== 'verified'}
                >
                  Manage Staff
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => navigate('/clinic/patients')}
                  disabled={clinicData.verificationStatus !== 'verified'}
                >
                  View Patients
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => navigate('/clinic/appointments')}
                  disabled={clinicData.verificationStatus !== 'verified'}
                >
                  Appointments
                </Button>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Button 
                  variant="outlined" 
                  fullWidth
                  onClick={() => navigate('/clinic/settings')}
                >
                  Settings
                </Button>
              </Grid>
            </Grid>
          </Paper>
        </Grid>

        {/* Stats Summary */}
        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Clinic Statistics
            </Typography>
            <Grid container spacing={3} sx={{ mt: 1 }}>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4">0</Typography>
                  <Typography variant="body2" color="text.secondary">Doctors</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4">0</Typography>
                  <Typography variant="body2" color="text.secondary">Patients</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4">0</Typography>
                  <Typography variant="body2" color="text.secondary">Appointments Today</Typography>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6} md={3}>
                <Box sx={{ textAlign: 'center', p: 2 }}>
                  <Typography variant="h4">0</Typography>
                  <Typography variant="body2" color="text.secondary">Upcoming Appointments</Typography>
                </Box>
              </Grid>
            </Grid>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default ClinicDashboard; 