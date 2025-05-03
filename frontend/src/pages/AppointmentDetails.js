import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Paper,
  Typography,
  Box,
  Grid,
  Button,
  Chip,
  Divider,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  CircularProgress,
  Alert,
  DialogContentText,
} from '@mui/material';
import {
  AccessTime,
  CalendarMonth,
  Person,
  Notes,
  Edit,
  Cancel,
  CheckCircle,
  ArrowBack,
  Assessment,
  ExpandLess,
  Schedule,
  Place,
  Info,
} from '@mui/icons-material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { API_BASE_URL } from '../config';
import AssessmentReport from '../components/assessment/AssessmentReport';
import axios from 'axios';
import { Link as RouterLink } from 'react-router-dom';
import { format, parseISO } from 'date-fns';
import { isValidDate, isValidTime, formatDate, formatDateAndTime } from '../utils/dateUtils';
import { safeObjectId } from '../utils/stringUtils';
import { appointmentService } from '../services/api';

const AppointmentDetails = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const queryParams = new URLSearchParams(location.search);
  const queryId = queryParams.get('id');
  
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [assessment, setAssessment] = useState(null);
  const [loadingAssessment, setLoadingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');
  const [showAssessment, setShowAssessment] = useState(false);
  const [timeslot, setTimeslot] = useState(null);
  const [loadingTimeslot, setLoadingTimeslot] = useState(false);
  
  const isDoctor = user?.role === 'doctor';
  const isPatient = user?.role === 'patient';

  // Calculate appointment duration in minutes
  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime || !isValidTime(startTime) || !isValidTime(endTime)) {
      return 'Unknown';
    }

    try {
      // Create base date objects for today with the given times
      const today = new Date();
      const year = today.getFullYear();
      const month = today.getMonth();
      const day = today.getDate();
      
      const [startHour, startMinute] = startTime.split(':').map(Number);
      const [endHour, endMinute] = endTime.split(':').map(Number);
      
      const startDate = new Date(year, month, day, startHour, startMinute);
      const endDate = new Date(year, month, day, endHour, endMinute);
      
      // Handle case where end time is on the next day
      if (endDate < startDate) {
        endDate.setDate(endDate.getDate() + 1);
      }
      
      const durationMinutes = Math.round((endDate - startDate) / (1000 * 60));
      
      if (durationMinutes < 60) {
        return `${durationMinutes} minutes`;
      } else {
        const hours = Math.floor(durationMinutes / 60);
        const minutes = durationMinutes % 60;
        return `${hours} hour${hours > 1 ? 's' : ''}${minutes > 0 ? ` ${minutes} min` : ''}`;
      }
    } catch (error) {
      console.error("Error calculating duration:", error);
      return 'Unknown';
    }
  };

  // Use our utility function in getAppointmentId
  const getAppointmentId = () => {    
    // Try to get ID from URL params first
    const urlId = safeObjectId(id);
    if (urlId) {
      console.log('Using ID from URL params:', urlId);
      return urlId;
    }
    
    // Next try query params
    const qId = safeObjectId(queryId);
    if (qId) {
      console.log('Using ID from query params:', qId);
      return qId;
    }
    
    // Then try session storage (get the most recent ID from the array)
    try {
      const recentlyViewed = JSON.parse(sessionStorage.getItem('recentlyViewedAppointments') || '[]');
      if (Array.isArray(recentlyViewed) && recentlyViewed.length > 0) {
        const firstId = safeObjectId(recentlyViewed[0]);
        if (firstId) {
          console.log('Using ID from sessionStorage recentlyViewedAppointments:', firstId);
          return firstId;
        }
      }
    } catch (e) {
      console.error('Error parsing sessionStorage:', e);
    }
    
    // Lastly try local storage
    const currentId = safeObjectId(localStorage.getItem('currentAppointmentId'));
    if (currentId) {
      console.log('Using ID from localStorage currentAppointmentId:', currentId);
      return currentId;
    }
    
    // Nothing valid found
    console.log('No valid appointment ID found in any source');
    return null;
  };

  useEffect(() => {
    const appointmentId = getAppointmentId();
    console.log('Initial appointment ID check:', appointmentId);
    
    if (!appointmentId) {
      setError('No valid appointment ID found. Please go back to the appointments page and try again.');
      setLoading(false);
      return;
    }
    
    // Clean the ID to ensure it's a valid string
    const cleanId = typeof appointmentId === 'object' 
      ? (appointmentId.toString ? appointmentId.toString() : String(appointmentId))
      : String(appointmentId).replace('[object%20Object]', '').replace('[object Object]', '');
      
    if (!cleanId || cleanId.trim() === '') {
      setError('Invalid appointment ID format. Please go back and try again.');
      setLoading(false);
      return;
    }
    
    console.log('Using cleaned appointment ID:', cleanId);
    fetchAppointment(cleanId);
  }, []);

  // Fetch assessment data for this appointment
  useEffect(() => {
    const appointmentId = getAppointmentId();
    
    if (!appointmentId) {
      console.log('No appointment ID available yet for assessment fetch');
      return;
    }

    // Clean the ID to ensure it's a valid string
    const cleanId = typeof appointmentId === 'object' 
      ? (appointmentId.toString ? appointmentId.toString() : String(appointmentId))
      : String(appointmentId).replace('[object%20Object]', '').replace('[object Object]', '');
      
    if (!cleanId || cleanId.trim() === '') {
      console.log('Invalid appointment ID format, skipping assessment fetch');
      setAssessmentError('Cannot load assessment: invalid appointment ID format');
      return;
    }
    
    const fetchAssessmentData = async () => {
      try {
        setLoadingAssessment(true);
        console.log('Fetching assessment with appointment ID:', cleanId);
        console.log(`Making assessment API request to: ${API_BASE_URL}/assessments/by-appointment/${cleanId}`);
        
        // If patient, only check if assessment exists without fetching full data
        if (isPatient) {
          const response = await fetch(`${API_BASE_URL}/assessments/exists/${cleanId}`, {
            headers: {
              'Authorization': `Bearer ${localStorage.getItem('token')}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (!response.ok) {
            const errorText = await response.text();
            console.error('Assessment exists API error:', response.status, errorText);
            throw new Error('Failed to check assessment status');
          }
          
          const data = await response.json();
          console.log('Assessment exists API response:', data);
          
          if (data.success && data.exists) {
            console.log('Assessment exists for this appointment');
            setAssessment({ exists: true }); // Just mark that it exists without loading details
          } else {
            console.log('No assessment found for this appointment');
            setAssessment(null);
          }
          return;
        }
        
        // For doctors, load the full assessment data
        const response = await fetch(`${API_BASE_URL}/assessments/by-appointment/${cleanId}`, {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (!response.ok) {
          const errorText = await response.text();
          console.error('Assessment API error:', response.status, errorText);
          throw new Error('Failed to load assessment data');
        }
        
        const data = await response.json();
        console.log('Assessment API response:', data);
        
        if (data.success && data.data) {
          console.log('Successfully retrieved assessment data');
          setAssessment(data.data);
          // If the user is a doctor, automatically display the assessment
          if (isDoctor) {
            setShowAssessment(true);
          }
        } else {
          console.log('No assessment data found for this appointment');
          setAssessment(null);
          setAssessmentError('No pre-visit assessment has been completed for this appointment.');
        }
      } catch (err) {
        console.error('Error fetching assessment:', err);
        setAssessmentError(`Failed to load assessment data: ${err.message}`);
      } finally {
        setLoadingAssessment(false);
      }
    };
    
    fetchAssessmentData();
  }, [isDoctor, isPatient]);

  // Fetch timeslot data when appointment data is available
  useEffect(() => {
    if (appointment && appointment.timeSlotId) {
      console.log('Found timeslot ID in appointment:', appointment.timeSlotId);
      fetchTimeslot(appointment.timeSlotId);
    } else {
      console.log('No timeSlotId found in appointment data:', appointment);
    }
  }, [appointment]);

  const fetchTimeslot = async (timeslotId) => {
    if (!timeslotId) {
      console.log('No timeslot ID available');
      return;
    }

    setLoadingTimeslot(true);
    console.log(`Attempting to fetch timeslot data with ID: ${timeslotId}`);
    
    try {
      // Use the appointments endpoint instead of availability
      const response = await axios.get(`${API_BASE_URL}/appointments/timeslot/${timeslotId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        }
      });
      
      console.log('Timeslot API response:', response.data);
      
      if (response.data && response.data.success && response.data.data) {
        let timeslotData = response.data.data;
        console.log('Successfully retrieved timeslot:', timeslotData);
        console.log('Timeslot date (raw):', timeslotData.date, 'type:', typeof timeslotData.date);
        
        // If date is an object, try to format it to a string before setting state
        if (typeof timeslotData.date === 'object' && timeslotData.date !== null) {
          console.log('Date is an object, attempting conversion');
          
          try {
            // If it's a MongoDB/BSON date object
            if (timeslotData.date._bsontype === 'Date') {
              console.log('MongoDB BSON date detected');
              timeslotData = {
                ...timeslotData,
                date: timeslotData.date.toISOString().split('T')[0] // Get YYYY-MM-DD part
              };
            } 
            // If it's a Date object
            else if (timeslotData.date instanceof Date || 
                    (typeof timeslotData.date.getMonth === 'function')) {
              console.log('JavaScript Date object detected');
              const jsDate = new Date(timeslotData.date);
              if (!isNaN(jsDate.getTime())) {
                const year = jsDate.getFullYear();
                const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                const day = String(jsDate.getDate()).padStart(2, '0');
                timeslotData = {
                  ...timeslotData,
                  date: `${year}-${month}-${day}`
                };
              }
            }
            // If it has a timestamp
            else if (timeslotData.date.$date) {
              console.log('Date with $date property detected');
              const jsDate = new Date(timeslotData.date.$date);
              if (!isNaN(jsDate.getTime())) {
                const year = jsDate.getFullYear();
                const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                const day = String(jsDate.getDate()).padStart(2, '0');
                timeslotData = {
                  ...timeslotData,
                  date: `${year}-${month}-${day}`
                };
              }
            }
            // Empty object or can't determine format
            else {
              console.log('Unknown date object format:', timeslotData.date);
              
              // Fallback to appointment date if available
              if (appointment && appointment.date) {
                console.log('Falling back to appointment date');
                if (typeof appointment.date === 'string') {
                  timeslotData.date = appointment.date;
                } else if (appointment.date instanceof Date) {
                  const jsDate = new Date(appointment.date);
                  if (!isNaN(jsDate.getTime())) {
                    const year = jsDate.getFullYear();
                    const month = String(jsDate.getMonth() + 1).padStart(2, '0');
                    const day = String(jsDate.getDate()).padStart(2, '0');
                    timeslotData.date = `${year}-${month}-${day}`;
                  }
                }
              } else {
                // No fallback available
                timeslotData.date = '';
              }
            }
          } catch (convErr) {
            console.error('Error converting date object:', convErr);
            // Leave as is, the formatDateFromISO function will handle it
          }
        }
        
        console.log('Final timeslot data to set in state:', timeslotData);
        setTimeslot(timeslotData);
      } else {
        console.error('API returned success:false or missing timeslot data');
        
        // If the new endpoint fails, try using appointment data as fallback
        if (appointment && appointment.date) {
          console.log('Using date directly from appointment:', appointment.date);
          const syntheticTimeslot = {
            date: appointment.date,
            startTime: appointment.startTime,
            endTime: appointment.endTime,
            _id: timeslotId
          };
          setTimeslot(syntheticTimeslot);
        }
      }
    } catch (err) {
      console.error('Error fetching timeslot:', err);
      
      // Fallback to appointment data
      if (appointment && appointment.date) {
        console.log('API call failed. Using date from appointment:', appointment.date);
        const syntheticTimeslot = {
          date: appointment.date,
          startTime: appointment.startTime,
          endTime: appointment.endTime,
          _id: timeslotId
        };
        setTimeslot(syntheticTimeslot);
      }
    } finally {
      setLoadingTimeslot(false);
    }
  };

  // Helper function to get a formatted date when date is missing but times are available
  const getDateFromTimesOrToday = () => {
    // If we have times but no date, assume it's for today
    if (appointment?.startTime && appointment?.endTime) {
      const today = new Date();
      return formatDate(today, 'MMMM dd, yyyy');
    }
    return 'Date not available';
  };

  // Helper function to format date from ISO string or various formats
  const formatDateFromISO = (dateInput) => {
    // Log the input for debugging purposes
    console.log('formatDateFromISO input:', dateInput, 'type:', typeof dateInput);
    
    if (!dateInput) {
      return getDateFromTimesOrToday();
    }
    
    try {
      // If it's a string, try to parse it as a date
      if (typeof dateInput === 'string') {
        const date = new Date(dateInput);
        if (!isNaN(date.getTime())) {
          return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          });
        }
      }
      
      // If it's already a Date object
      if (dateInput instanceof Date && !isNaN(dateInput.getTime())) {
        return dateInput.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      // For any other case, try to convert to a Date object
      const date = new Date(dateInput);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        });
      }
      
      return 'Date not available';
    } catch (error) {
      console.error('Error formatting date:', error);
      return 'Error formatting date';
    }
  };

  const getStatusChip = (status) => {
    const statusProps = {
      upcoming: { color: 'primary', icon: <AccessTime /> },
      completed: { color: 'success', icon: <CheckCircle /> },
      cancelled: { color: 'error', icon: <Cancel /> },
      scheduled: { color: 'primary', icon: <AccessTime /> },
      rescheduled: { color: 'warning', icon: <AccessTime /> },
    };

    const { color, icon } = statusProps[status] || statusProps.upcoming;

    return (
      <Chip
        icon={icon}
        label={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        color={color}
        sx={{ fontWeight: 'medium' }}
      />
    );
  };

  const fetchAssessment = async (assessmentId) => {
    try {
      const response = await axios.get(`${API_BASE_URL}/assessments/${assessmentId}`);
      return response.data.data;
    } catch (error) {
      console.error('Error fetching assessment:', error);
      return null;
    }
  };

  const handleCancel = async () => {
    try {
      if (!appointment) return;
      
      // Get appointment ID as string
      const appointmentId = safeObjectId(appointment._id);
      if (!appointmentId) {
        setError('Invalid appointment ID');
        return;
      }
      
      setLoading(true);
      await appointmentService.cancelAppointment(appointmentId, { reason: cancelReason });
      
      // Refresh appointment data
      const response = await appointmentService.getById(appointmentId);
      setAppointment(response.data.data);
      setOpenCancelDialog(false);
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      setError('Failed to cancel appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEditSubmit = async (updatedData) => {
    try {
      if (!appointment) return;
      
      // Get appointment ID as string
      const appointmentId = safeObjectId(appointment._id);
      if (!appointmentId) {
        setError('Invalid appointment ID');
        return;
      }
      
      setLoading(true);
      const response = await appointmentService.updateAppointment(appointmentId, updatedData);
      setAppointment(response.data.data);
      setOpenEditDialog(false);
    } catch (err) {
      console.error('Error updating appointment:', err);
      setError('Failed to update appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartAssessment = () => {
    if (!appointment) return;
    
    // Get appointment ID as string
    const appointmentId = safeObjectId(appointment._id);
    if (!appointmentId) {
      setError('Invalid appointment ID');
      return;
    }
    
    navigate(`/assessments/new?appointmentId=${appointmentId}`);
  };

  const toggleAssessmentView = () => {
    setShowAssessment(!showAssessment);
  };

  const fetchAppointment = async (appointmentId) => {
    try {
      setLoading(true);
      console.log('Fetching appointment data with ID:', appointmentId);
      
      // Check if this is a temporary ID that won't work with the backend
      if (appointmentId && appointmentId.startsWith('temp-')) {
        console.error('Temporary ID detected - this will not work with the backend:', appointmentId);
        throw new Error('Invalid appointment ID: The appointment may have been corrupted or not properly saved. Please return to the appointments list and try again.');
      }
      
      // Add validation check for valid MongoDB ObjectID format
      const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(appointmentId);
      if (!isValidObjectId) {
        console.error('Invalid MongoDB ObjectID format:', appointmentId);
        throw new Error("Invalid appointment ID format. Please return to the appointments list and select a valid appointment.");
      }
      
      console.log(`Making API request using appointmentService.getById`);
      const response = await appointmentService.getById(appointmentId);
      
      console.log('Appointment API response:', response.data);
      
      if (response.data && response.data.success && response.data.data) {
        console.log('Successfully retrieved appointment:', response.data.data._id);
        
        // Format the appointment date if it's still an object
        const appointmentData = response.data.data;
        
        if (appointmentData.date && typeof appointmentData.date === 'object') {
          console.log('Appointment date is an object, formatting manually:', appointmentData.date);
          
          if (Object.keys(appointmentData.date).length === 0) {
            // Empty object - convert to string
            appointmentData.date = '';
          } else {
            // Try to convert to ISO date string
            try {
              const date = new Date(appointmentData.date);
              if (!isNaN(date.getTime())) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                appointmentData.date = `${year}-${month}-${day}`;
                console.log('Converted appointment date to string:', appointmentData.date);
              }
            } catch (err) {
              console.error('Error formatting appointment date:', err);
              appointmentData.date = '';
            }
          }
        }
        
        setAppointment(appointmentData);
      } else {
        console.error('API returned success:false or missing data');
        setError('The appointment could not be found. It may have been deleted or you might not have permission to view it.');
      }
    } catch (err) {
      console.error('Error fetching appointment:', err);
      
      // Provide user-friendly error messages based on error type
      if (err.response) {
        // The request was made and the server responded with a status code outside of 2xx
        if (err.response.status === 404) {
          setError('Appointment not found. It may have been deleted or the ID is incorrect.');
        } else if (err.response.status === 403) {
          setError('You do not have permission to view this appointment.');
        } else {
          setError(`Server error: ${err.response.status}. Please try again later.`);
        }
      } else if (err.request) {
        // The request was made but no response was received
        setError('Network error. Please check your internet connection and try again.');
      } else {
        // Something happened in setting up the request
        setError(`Error: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  // This useEffect ensures the timeslot data is properly formatted
  // when it changes, particularly the date field
  useEffect(() => {
    if (timeslot && timeslot.date && typeof timeslot.date === 'object') {
      console.log('useEffect: Timeslot date is an object, reformatting:', timeslot.date);
      
      try {
        // Create a formatted date string
        const jsDate = new Date(timeslot.date);
        if (!isNaN(jsDate.getTime())) {
          const year = jsDate.getFullYear();
          const month = String(jsDate.getMonth() + 1).padStart(2, '0');
          const day = String(jsDate.getDate()).padStart(2, '0');
          const formattedDate = `${year}-${month}-${day}`;
          
          console.log('useEffect: Reformatted date string:', formattedDate);
          
          // Update the timeslot with the formatted date
          setTimeslot(prev => ({
            ...prev,
            date: formattedDate
          }));
        } else {
          console.log('useEffect: Date object is invalid, cannot format');
        }
      } catch (error) {
        console.error('useEffect: Error formatting timeslot date:', error);
      }
    }
  }, [timeslot?._id]); // Only run when the timeslot ID changes, not on every date change

  // Show loading state while fetching data
  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  // Show error state if there's an error
  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 4, backgroundColor: '#FFF4F4', borderLeft: '4px solid #F44336' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Unable to Load Appointment
          </Typography>
          <Typography gutterBottom>
            {error.message || "There was an error loading this appointment."}
          </Typography>
          <Typography variant="body2" color="text.secondary" paragraph>
            This may be due to an invalid appointment ID, network error, or permission issue.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/appointments')}
            startIcon={<ArrowBack />}
          >
            Return to Appointments
          </Button>
        </Paper>
      </Container>
    );
  }

  // If no appointment data is available
  if (!appointment) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Paper sx={{ p: 3, mb: 4, backgroundColor: '#FFF4F4', borderLeft: '4px solid #F44336' }}>
          <Typography variant="h5" color="error" gutterBottom>
            Appointment Not Found
          </Typography>
          <Typography gutterBottom>
            The appointment you're looking for could not be found.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            onClick={() => navigate('/appointments')}
            startIcon={<ArrowBack />}
          >
            Return to Appointments
          </Button>
        </Paper>
      </Container>
    );
  }

  return (
    <Container maxWidth="md" sx={{ py: 4 }}>
      <Button
        component={RouterLink}
        to="/appointments"
        startIcon={<ArrowBack />}
        sx={{ mb: 3 }}
      >
        Back to Appointments
      </Button>

      {/* Error state */}
      {error && (
        <Paper 
          elevation={3} 
          sx={{ p: 3, mb: 3, border: '1px solid #f44336', bgcolor: '#fff2f2' }}
        >
          <Typography variant="h6" color="error" gutterBottom>
            Error Loading Appointment
          </Typography>
          <Typography variant="body1">
            {error}
          </Typography>
          <Button 
            variant="contained" 
            color="primary" 
            sx={{ mt: 2 }}
            onClick={() => navigate('/appointments')}
          >
            Return to Appointments
          </Button>
        </Paper>
      )}

      {/* Loading state */}
      {loading && !error && (
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <CircularProgress />
        </Box>
      )}

      {/* Appointment content */}
      {!loading && appointment && !error && (
        <>
          <Box sx={{ mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
            {getStatusChip(appointment?.status)}
            <Typography variant="h5" fontWeight="medium">
              {appointment?.type} Appointment
            </Typography>
          </Box>

          <Grid container spacing={3}>
            {/* Main Details */}
            <Grid item xs={12} sm={8}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  Appointment Information
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Grid container spacing={2}>
                  {/* Date */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <CalendarMonth color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Date
                        </Typography>
                        <Typography>
                          {(() => {
                            // Directly use appointment date if available
                            if (appointment?.date) {
                              return formatDateFromISO(appointment.date);
                            }
                            
                            // Fallback to timeslot date
                            if (timeslot?.date) {
                              return formatDateFromISO(timeslot.date);
                            }
                            
                            return getDateFromTimesOrToday();
                          })()}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  {/* Time */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Schedule color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Time
                        </Typography>
                        <Typography>
                          {isValidTime(appointment?.startTime) && isValidTime(appointment?.endTime) 
                            ? `${appointment.startTime} - ${appointment.endTime}` 
                            : 'Time not specified'}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  {/* Duration */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <AccessTime color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Duration
                        </Typography>
                        <Typography>
                          {calculateDuration(appointment?.startTime, appointment?.endTime)}
                        </Typography>
                      </Box>
                    </Box>
                  </Grid>
                  
                  {/* Location */}
                  <Grid item xs={12} sm={6}>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Place color="primary" />
                      <Box>
                        <Typography variant="body2" color="text.secondary">
                          Location
                        </Typography>
                        <Typography>
                          {appointment?.location || (appointment?.isVirtual ? 'Virtual Meeting' : 'In-person')}
                        </Typography>
                        {appointment?.isVirtual && appointment?.videoConferenceLink && (
                          <Typography 
                            component="a" 
                            href={appointment.videoConferenceLink} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            color="primary"
                            sx={{ display: 'block', mt: 0.5 }}
                          >
                            Join Video Call
                          </Typography>
                        )}
                      </Box>
                    </Box>
                  </Grid>
                </Grid>
                
                <Divider sx={{ my: 2 }} />
                
                {/* Reason for visit */}
                <Box>
                  <Typography variant="body2" color="text.secondary" gutterBottom>
                    Reason for Visit
                  </Typography>
                  <Typography>
                    {appointment?.reasonForVisit || appointment?.notes || 'No reason specified'}
                  </Typography>
                </Box>

                {/* Actions */}
                <Box sx={{ display: 'flex', gap: 2, mt: 3 }}>
                  {appointment?.status === 'upcoming' && (
                    <>
                      {isDoctor && (
                        <Button
                          variant="contained"
                          startIcon={<Edit />}
                          onClick={() => setOpenEditDialog(true)}
                        >
                          Edit Appointment
                        </Button>
                      )}
                      <Button
                        variant="outlined"
                        color="error"
                        startIcon={<Cancel />}
                        onClick={() => setOpenCancelDialog(true)}
                      >
                        Cancel Appointment
                      </Button>
                      {!isDoctor && !assessment && (
                        <Button
                          variant="contained"
                          color="secondary"
                          startIcon={<Notes />}
                          onClick={handleStartAssessment}
                        >
                          Start AI Assessment
                        </Button>
                      )}
                    </>
                  )}
                </Box>
              </Paper>
            </Grid>

            {/* Participant Details */}
            <Grid item xs={12} sm={4}>
              <Paper sx={{ p: 3, mb: 3 }}>
                <Typography variant="h6" gutterBottom>
                  {isDoctor ? 'Patient Details' : 'Doctor Details'}
                </Typography>
                <Divider sx={{ mb: 2 }} />
                
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
                  <Person color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary" gutterBottom>
                      Name
                    </Typography>
                    <Typography>
                      {isDoctor && appointment.patient ? 
                        (appointment.patientUser ? 
                          `${appointment.patientUser.firstName} ${appointment.patientUser.lastName}` : 
                          (appointment.patient.name || 'Unknown'))
                        : 
                        (appointment.doctor ? 
                          (appointment.doctorUser ? 
                            `Dr. ${appointment.doctorUser.firstName} ${appointment.doctorUser.lastName}` : 
                            (appointment.doctor.name || 'Unknown'))
                          : 'Unknown')
                      }
                    </Typography>
                  </Box>
                </Box>
                
                {isDoctor && appointment.patientUser && (
                  <>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Email
                        </Typography>
                        <Typography>{appointment.patientUser.email || 'N/A'}</Typography>
                      </Box>
                    </Box>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                      <Box>
                        <Typography variant="body2" color="text.secondary" gutterBottom>
                          Phone
                        </Typography>
                        <Typography>{appointment.patientUser.phoneNumber || 'N/A'}</Typography>
                      </Box>
                    </Box>
                    {appointment.patient?.dateOfBirth && (
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Box>
                          <Typography variant="body2" color="text.secondary" gutterBottom>
                            Date of Birth
                          </Typography>
                          <Typography>
                            {isValidDate(appointment.patient.dateOfBirth) ? 
                              formatDate(appointment.patient.dateOfBirth, 'MMMM dd, yyyy') : 'N/A'}
                          </Typography>
                        </Box>
                      </Box>
                    )}
                  </>
                )}
              </Paper>
            </Grid>
          </Grid>

          {/* Assessment Section */}
          {assessment && isDoctor && (
            <Paper sx={{ p: 3, mt: 2 }}>
              <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                <Typography variant="h6">
                  Patient Pre-Visit Assessment
                </Typography>
                <Button
                  variant="outlined"
                  startIcon={showAssessment ? <ExpandLess /> : <Assessment />}
                  onClick={toggleAssessmentView}
                >
                  {showAssessment ? 'Hide Assessment' : 'View Assessment'}
                </Button>
              </Box>

              {showAssessment && (
                <AssessmentReport assessment={assessment} />
              )}
            </Paper>
          )}

          {/* No assessment info for doctors */}
          {!assessment && !loadingAssessment && isDoctor && (
            <Paper sx={{ p: 3, mt: 2, bgcolor: '#f8f8f8' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <Typography variant="h6">
                  No Pre-Visit Assessment Available
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                The patient has not completed a pre-visit assessment for this appointment.
              </Typography>
            </Paper>
          )}

          {/* Patient Assessment Completion Status */}
          {assessment && isPatient && (
            <Paper sx={{ p: 3, mt: 2, bgcolor: '#e8f5e9' }}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                <CheckCircle color="success" />
                <Typography variant="h6">
                  Pre-Visit Assessment Completed
                </Typography>
              </Box>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                Thank you for completing your pre-visit assessment. Your doctor will review it before your appointment.
              </Typography>
            </Paper>
          )}

          {/* Assessment loading state - only visible to doctors */}
          {loadingAssessment && isDoctor && (
            <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
              <CircularProgress size={24} sx={{ mr: 1 }} />
              <Typography>Loading assessment data...</Typography>
            </Box>
          )}

          {/* Assessment error - only visible to doctors */}
          {assessmentError && isDoctor && (
            <Paper sx={{ p: 2, mt: 3, bgcolor: '#fff2f2', borderLeft: '4px solid #f44336' }}>
              <Typography variant="body2" color="error">
                {assessmentError}
              </Typography>
            </Paper>
          )}

          {/* Dialogs */}
          <Dialog open={openCancelDialog} onClose={() => setOpenCancelDialog(false)}>
            <DialogTitle>Cancel Appointment</DialogTitle>
            <DialogContent>
              <DialogContentText gutterBottom>
                Are you sure you want to cancel this appointment?
              </DialogContentText>
              <TextField
                fullWidth
                label="Reason for cancellation"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                margin="dense"
                multiline
                rows={3}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setOpenCancelDialog(false)}>No, Keep It</Button>
              <Button color="error" onClick={handleCancel}>Yes, Cancel It</Button>
            </DialogActions>
          </Dialog>
        </>
      )}
    </Container>
  );
};

export default AppointmentDetails; 