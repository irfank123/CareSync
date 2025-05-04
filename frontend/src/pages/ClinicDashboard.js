import React, { useEffect, useState } from 'react';
import { Container, Typography, Paper, Box, Button, CircularProgress, Alert, Link } from '@mui/material';
import { useClinicAuth } from '../context/ClinicAuthContext'; // Import the hook
import { useAuth0 } from '@auth0/auth0-react'; // Import useAuth0
import { axiosInstance } from '../services/api'; // Corrected import path
import CreateClinicForm from '../components/clinic/CreateClinicForm'; // Import the form
import { useNavigate, useLocation } from 'react-router-dom'; // Import useLocation

const ClinicDashboard = () => {
  // Get clinic user details and actions from context
  const { clinicUser, clinicInfo, loading, logoutClinic, isClinicAuthenticated } = useClinicAuth(); 
  const { getAccessTokenSilently } = useAuth0(); // Get token function
  const navigate = useNavigate();
  const location = useLocation(); // Get location object
  
  // State for Google Auth status messages
  const [googleAuthMessage, setGoogleAuthMessage] = useState({ type: '', text: '' });

  // Check for Google Auth status query parameters on mount
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const status = params.get('google_auth_status');
    const message = params.get('message');

    if (status === 'success') {
      setGoogleAuthMessage({ type: 'success', text: 'Successfully connected Google Calendar!' });
    } else if (status === 'error') {
      setGoogleAuthMessage({ type: 'error', text: `Failed to connect Google Calendar: ${message || 'Unknown error'}` });
    }

    // Optional: Clear query parameters from URL after reading them
    if (status) {
        navigate(location.pathname, { replace: true });
    }
  }, [location, navigate]);

  // Function to initiate Google Auth flow
  const handleConnectGoogle = async () => {
    setGoogleAuthMessage({ type: '', text: '' }); // Clear previous messages
    try {
        console.log('Attempting to get access token for Google Auth initiation...');
        const token = await getAccessTokenSilently();
        console.log('Access token obtained. Calling backend /initiate endpoint...');

        // Call the backend endpoint to get the Google Auth URL (Updated Path)
        const response = await axiosInstance.get('/google-auth/initiate', {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (response.data.success && response.data.authorizationUrl) {
            console.log('Backend returned authorization URL. Redirecting user to Google...');
            // Redirect the user to the URL provided by the backend
            window.location.href = response.data.authorizationUrl;
        } else {
            throw new Error(response.data.message || 'Backend did not return a valid authorization URL.');
        }
    } catch (error) {
        console.error('Failed to initiate Google Calendar connection:', error);
        const errorMsg = error.response?.data?.message || error.message || 'Could not start connection process.';
        setGoogleAuthMessage({ type: 'error', text: `Connection Error: ${errorMsg}` });
    }
  };

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
      {/* Display Google Auth Status Message */} 
      {googleAuthMessage.text && (
        <Alert severity={googleAuthMessage.type} sx={{ mt: 2, mb: 2 }}>
          {googleAuthMessage.text}
        </Alert>
      )}

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
              <Typography variant="body2" sx={{ mb: 2 }}>Status: {clinicInfo.verificationStatus}</Typography>
              {/* TODO: Add specific content based on verificationStatus */}
              {clinicInfo.verificationStatus === 'pending' && (
                <Alert severity="warning" sx={{ mt: 2 }}>Your clinic verification is pending review.</Alert>
              )}
              {/* TODO: Add content for 'verified' status */}
              {clinicInfo.verificationStatus === 'verified' && (
                <Box>
                  <Alert severity="success" sx={{ mt: 2, mb: 3 }}>Your clinic is verified.</Alert>
                  
                  {/* --- Google Calendar Integration --- */}
                  <Box sx={{ mb: 3, p: 2, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
                    <Typography variant="h6" gutterBottom>Integrations</Typography>
                    <Button 
                      variant="contained" 
                      color="primary"
                      onClick={handleConnectGoogle}
                      // TODO: Add logic to disable/change text if already connected
                    >
                      Connect Google Calendar
                    </Button>
                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                      Allow CareSync to create Google Meet links for appointments using your calendar.
                    </Typography>
                  </Box>
                  
                  {/* --- Clinic Management Sections --- */}
                  <Typography variant="h6" gutterBottom>Manage Your Clinic:</Typography>
                  <Box sx={{ display: 'flex', gap: 2, flexWrap: 'wrap' }}>
                    <Button 
                      variant="contained" 
                      onClick={() => navigate('/clinic/staff')} // TODO: Create this route
                    >
                      Manage Staff
                    </Button>
                    <Button 
                      variant="contained" 
                      onClick={() => navigate('/clinic/appointments')} // TODO: Create this route
                    >
                      View Appointments
                    </Button>
                    {/* Add more buttons here as needed */}
                  </Box>
                </Box>
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