import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Grid,
  Paper,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
  CircularProgress,
  Alert,
} from '@mui/material';
import { useNavigate, useLocation } from 'react-router-dom';
import { format } from 'date-fns';
import { appointmentService } from '../services/api';

const PatientDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [upcomingAppointments, setUpcomingAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(location.state?.message || null);

  // Fetch upcoming appointments when component mounts
  useEffect(() => {
    const fetchUpcomingAppointments = async () => {
      try {
        setLoading(true);
        const response = await appointmentService.getUpcomingAppointments();
        setUpcomingAppointments(response.data.data || []);
      } catch (err) {
        console.error('Error fetching appointments:', err);
        setError('Failed to load appointments. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchUpcomingAppointments();
    
    // Clear success message after 5 seconds
    if (successMessage) {
      const timer = setTimeout(() => {
        setSuccessMessage(null);
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [successMessage]);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Patient Dashboard
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Welcome, {user?.firstName} {user?.lastName}
      </Typography>
      
      {successMessage && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {successMessage}
        </Alert>
      )}
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Upcoming Appointments
            </Typography>
            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : upcomingAppointments.length === 0 ? (
              <Typography color="text.secondary" sx={{ my: 2 }}>
                No upcoming appointments scheduled.
              </Typography>
            ) : (
              <List>
                {upcomingAppointments.slice(0, 3).map((appointment) => (
                  <Box key={appointment._id}>
                    <ListItem>
                      <ListItemText
                        primary={appointment.doctorName || `Dr. ${appointment.doctorUser?.firstName || 'Unknown'} ${appointment.doctorUser?.lastName || 'Doctor'}`}
                        secondary={
                          <>
                            <Typography component="span" variant="body2" color="text.primary">
                              {format(new Date(appointment.date), 'MMMM d, yyyy')} at {appointment.startTime}
                            </Typography>
                            <Typography variant="body2">
                              Type: {appointment.type === 'virtual' ? 'Virtual Consultation' : 'In-Person Visit'}
                            </Typography>
                            <Typography variant="body2">
                              Status: {appointment.status}
                            </Typography>
                          </>
                        }
                      />
                    </ListItem>
                    <Divider />
                  </Box>
                ))}
              </List>
            )}
            <Button
              variant="contained"
              onClick={() => navigate('/appointments')}
              sx={{ mt: 2 }}
            >
              View All Appointments
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Schedule New Appointment
            </Typography>
            <Typography variant="body2" paragraph>
              Book an appointment with a doctor of your choice. Choose from virtual consultations or in-person visits.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/appointments/schedule')}
              sx={{ mt: 2 }}
            >
              Schedule Appointment
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Medical Records
            </Typography>
            <Typography variant="body2" paragraph>
              Access your medical history, test results, prescriptions, and other health information.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/medical-records')}
              sx={{ mt: 2 }}
            >
              View Records
            </Button>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Profile Settings
            </Typography>
            <Typography variant="body2" paragraph>
              Update your personal information, contact details, insurance information, and preferences.
            </Typography>
            <Button
              variant="contained"
              onClick={() => navigate('/profile')}
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

export default PatientDashboard; 