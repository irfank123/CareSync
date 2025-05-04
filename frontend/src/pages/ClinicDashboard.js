import React, { useEffect, useState } from 'react';
import { Container, Typography, Paper, Box, Button, CircularProgress, Alert, Snackbar, Grid } from '@mui/material';
import { useLocation, useNavigate } from 'react-router-dom';
import { useClinicAuth } from '../context/ClinicAuthContext';
import CreateClinicForm from '../components/clinic/CreateClinicForm';
import Cookies from 'js-cookie';
import { axiosInstance } from '../services/api';
import { toast } from 'react-toastify';

const ClinicDashboard = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const googleAuthSuccess = queryParams.get('google_auth_success') === 'true';
  const googleAuthError = queryParams.get('google_auth_error');

  const [isConnectingGoogle, setIsConnectingGoogle] = useState(false);
  const [showDebugging, setShowDebugging] = useState(false);
  
  const { 
    clinicUser, 
    clinicInfo, 
    loading, 
    logoutClinic, 
    isClinicAuthenticated, 
    authError,
    fetchClinicProfile
  } = useClinicAuth();

  // Get auth status from URL if it exists
  const urlParams = new URLSearchParams(window.location.search);
  const authStatus = urlParams.get('auth');
  
  // Log current state for debugging
  useEffect(() => {
    console.log('[ClinicDashboard] Component mounted with state:', {
      isClinicAuthenticated,
      loading,
      userEmail: clinicUser?.email,
      hasClinic: !!clinicInfo,
      authStatus
    });
    
    // Toggle debugging display with 5 clicks on the dashboard title
    const counter = { clicks: 0, timer: null };
    const handleTitleClick = () => {
      counter.clicks++;
      clearTimeout(counter.timer);
      counter.timer = setTimeout(() => { counter.clicks = 0; }, 3000);
      
      if (counter.clicks >= 5) {
        setShowDebugging(prev => !prev);
        counter.clicks = 0;
      }
    };
    
    const title = document.querySelector('h1');
    if (title) {
      title.addEventListener('click', handleTitleClick);
      return () => title.removeEventListener('click', handleTitleClick);
    }
  }, [isClinicAuthenticated, loading, clinicUser, clinicInfo, authStatus]);

  useEffect(() => {
    if (googleAuthSuccess) {
      toast.success('Google Account connected successfully!');
      navigate(location.pathname, { replace: true });
    }
    if (googleAuthError) {
      toast.error(`Google connection failed: ${googleAuthError}`);
      navigate(location.pathname, { replace: true });
    }
  }, [googleAuthSuccess, googleAuthError, location.pathname, navigate]);

  const [cookieDebug, setCookieDebug] = useState('');
  
  const handleConnectGoogle = async () => {
    setIsConnectingGoogle(true);
    try {
      console.log('Requesting Google Auth URL from backend...');
      const response = await axiosInstance.get('/google/auth/url');
      
      if (response.data.success && response.data.url) {
        console.log('Received Google Auth URL, redirecting...');
        window.location.href = response.data.url;
      } else {
        console.error('Failed to get Google Auth URL:', response.data);
        toast.error(response.data.message || 'Failed to start Google connection process.');
        setIsConnectingGoogle(false);
      }
    } catch (error) {
      console.error('Error initiating Google connection:', error);
      toast.error(error.response?.data?.message || 'An error occurred while connecting to Google.');
      setIsConnectingGoogle(false);
    }
  };

  if (loading) {
    return (
      <Container>
        <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '50vh' }}>
          <CircularProgress size={60} />
          <Typography variant="h5" sx={{ mt: 3 }}>
            Loading Clinic Dashboard...
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ mt: 1 }}>
            {authStatus === 'success' || authStatus === 'code_reuse' 
              ? 'Processing your authentication...' 
              : 'Verifying your session...'}
          </Typography>
        </Box>
      </Container>
    );
  }

  if (!isClinicAuthenticated) {
    return (
      <Container component="main" maxWidth="sm">
        <Alert severity="error" sx={{ mt: 4 }}>
          You are not authorized to view this page. Please log in.
          {authError && <Typography sx={{ mt: 1 }}>Error: {authError}</Typography>}
          {cookieDebug && <Typography variant="caption" sx={{ mt: 1, display: 'block' }}>Debug: {cookieDebug}</Typography>}
        </Alert>
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

          {!clinicInfo ? (
            <CreateClinicForm />
          ) : (
            <Box sx={{ mt: 2 }}>
              <Typography variant="h6">Clinic: {clinicInfo.name}</Typography>
              <Typography variant="body2">Status: {clinicInfo.verificationStatus}</Typography>
              {clinicInfo.verificationStatus === 'pending' && (
                <Alert severity="warning" sx={{ mt: 2 }}>Your clinic verification is pending review.</Alert>
              )}
              {clinicInfo.verificationStatus === 'verified' && (
                <Alert severity="success" sx={{ mt: 2 }}>Your clinic is verified. You can now access full features.</Alert>
              )}
              {clinicInfo.verificationStatus === 'rejected' && (
                 <Alert severity="error" sx={{ mt: 2 }}>Clinic verification was rejected. Please contact support.</Alert>
              )}
              
              <Box sx={{ border: '1px solid lightgray', p: 2, mt: 3, borderRadius: 1 }}>
                  <Typography variant="subtitle1" gutterBottom>Google Integration</Typography>
                  <Typography variant="body2" sx={{ mb: 1 }}>
                      Connect your clinic's Google Account to enable Google Meet link generation for appointments.
                  </Typography>
                  <Button 
                      variant="contained" 
                      onClick={handleConnectGoogle}
                      disabled={isConnectingGoogle}
                      startIcon={isConnectingGoogle ? <CircularProgress size={20} /> : null}
                  >
                      {isConnectingGoogle ? 'Connecting...' : 'Connect Google Account'}
                  </Button>
              </Box>
            </Box>
          )}
          
          <Button 
            variant="outlined" 
            onClick={logoutClinic} 
            sx={{ mt: 3 }}
          >
            Logout Clinic User
          </Button>

          {showDebugging && (
            <Paper sx={{ p: 2, mb: 3, bgcolor: '#f5f5f5', mt: 3 }}>
              <Typography variant="h6">Debug Information</Typography>
              <Typography variant="body2" component="pre" sx={{ overflow: 'auto' }}>
                {JSON.stringify({
                  isAuthenticated: isClinicAuthenticated,
                  loading,
                  user: clinicUser ? { email: clinicUser.email, role: clinicUser.role } : null,
                  clinic: clinicInfo ? { name: clinicInfo.name, id: clinicInfo._id } : null,
                  authStatus,
                  location: window.location.pathname + window.location.search,
                  timestamp: new Date().toISOString()
                }, null, 2)}
              </Typography>
            </Paper>
          )}

        </Paper>
      </Box>
    </Container>
  );
};

export default ClinicDashboard; 