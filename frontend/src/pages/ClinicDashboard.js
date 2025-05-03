import React from 'react';
import { Container, Typography, Paper, Box, Button, CircularProgress, Alert } from '@mui/material';
import { useClinicAuth } from '../context/ClinicAuthContext'; // Import the hook
import CreateClinicForm from '../components/clinic/CreateClinicForm'; // Import the form

const ClinicDashboard = () => {
  // Get clinic user details and actions from context
  const { clinicUser, clinicInfo, loading, logoutClinic, isClinicAuthenticated } = useClinicAuth(); 

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" alignItems="center" minHeight="calc(100vh - 200px)">
        <CircularProgress />
      </Box>
    );
  }

  if (!isClinicAuthenticated) {
    // This case should ideally be handled by ProtectedClinicRoute,
    // but as a fallback:
    return (
      <Container component="main" maxWidth="sm">
        <Alert severity="error" sx={{ mt: 4 }}>You are not authorized to view this page. Please log in.</Alert>
      </Container>
    );
  }

  return (
    <Container component="main" maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Paper elevation={3} sx={{ p: 4 }}>
          <Typography variant="h4" component="h1" gutterBottom>
            Clinic Dashboard
          </Typography>
          
          {clinicUser && (
            <Typography variant="body1" gutterBottom>
              Welcome, {clinicUser.firstName || 'Clinic Administrator'}! (Email: {clinicUser.email})
            </Typography>
          )}

          {/* Render based on whether clinicInfo exists */}
          {!clinicInfo ? (
            // If no clinic info, show the create form
            <CreateClinicForm />
          ) : (
            // Otherwise, show clinic details and status
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">Clinic: {clinicInfo.name}</Typography>
              <Typography variant="body2">Status: {clinicInfo.verificationStatus}</Typography>
              {/* TODO: Add specific content based on verificationStatus */}
              {clinicInfo.verificationStatus === 'pending' && (
                <Alert severity="warning" sx={{ mt: 2 }}>Your clinic verification is pending review.</Alert>
              )}
              {/* TODO: Add content for 'verified' status */}
              {clinicInfo.verificationStatus === 'verified' && (
                <Alert severity="success" sx={{ mt: 2 }}>Your clinic is verified. You can now access full features.</Alert>
                // Add links/buttons to other clinic management sections
              )}
              {clinicInfo.verificationStatus === 'rejected' && (
                 <Alert severity="error" sx={{ mt: 2 }}>Clinic verification was rejected. Please contact support.</Alert>
              )}
            </Box>
          )}
          
          <Button 
            variant="outlined" 
            onClick={logoutClinic} 
            sx={{ mt: 3 }}
          >
            Logout Clinic User
          </Button>

        </Paper>
      </Box>
    </Container>
  );
};

export default ClinicDashboard; 