import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Alert,
  CircularProgress,
  Menu,
  MenuItem,
  DialogContentText,
  Chip,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { DateCalendar } from '@mui/x-date-pickers/DateCalendar';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { addMinutes, format, parse } from 'date-fns';
import { API_BASE_URL } from '../config';

const ManageAvailability = () => {
  const { user } = useAuth();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [timeSlots, setTimeSlots] = useState([]);
  const [newSlot, setNewSlot] = useState({ start: null, end: null });
  const [openDialog, setOpenDialog] = useState(false);
  const [generateConfirmOpen, setGenerateConfirmOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [anchorEl, setAnchorEl] = useState(null);
  const [doctorId, setDoctorId] = useState(null);
  const latestFetchRequestTime = React.useRef(null); // Ref to track latest fetch

  // Get auth token from localStorage
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch doctor ID associated with the current user
  useEffect(() => {
    const fetchDoctorId = async () => {
      if (!user?._id) return;
      
      try {
        console.log('Fetching doctor ID for user:', user._id);
        const doctorEndpoint = `${API_BASE_URL}/doctors/user/${user._id}`;
        console.log('Doctor profile request URL:', doctorEndpoint);
        
        const response = await fetch(doctorEndpoint, {
          headers: getAuthHeaders(),
        });
        
        console.log('Doctor profile response status:', response.status);
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          console.error('Doctor profile error data:', errorData);
          throw new Error(errorData?.message || 'Failed to fetch doctor profile');
        }
        
        const data = await response.json();
        console.log('Doctor profile response data:', data);
        
        if (data.data) {
          setDoctorId(data.data._id);
          console.log('Doctor ID fetched:', data.data._id);
        } else {
          setError('No doctor profile found for this user');
          console.error('No doctor data in response');
        }
      } catch (err) {
        setError(err.message || 'Failed to fetch doctor profile');
        console.error('Fetch doctor profile error:', err);
      }
    };

    if (user?._id) {
      fetchDoctorId();
    }
  }, [user?._id]);

  // Fetch existing availability for the selected date
  const fetchAvailability = async (forceRefresh = false) => {
    if (!doctorId) return;
    
    const currentFetchTime = Date.now();
    latestFetchRequestTime.current = currentFetchTime;
    
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      
      const formattedDate = format(selectedDate, 'yyyy-MM-dd');
      const cacheBuster = forceRefresh ? `&_=${Date.now()}` : ''; // Use standard cache busting query param
      const url = `${API_BASE_URL}/availability/doctor/${doctorId}/slots?startDate=${formattedDate}&endDate=${formattedDate}${cacheBuster}`;
      
      console.log('GET Request - Fetch Availability:', { url });

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          ...getAuthHeaders(),
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        },
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to parse error response' }));
        throw new Error(errorData?.message || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Only update state if this is the latest fetch request
      if (latestFetchRequestTime.current === currentFetchTime) {
        console.log('Time slots response data (latest):', data);
        setTimeSlots(data.data || []);
      } else {
        console.log('Skipping state update for stale fetch request.');
      }
    } catch (err) {
      console.error('Fetch availability error:', err);
      // Only update error state if this is the latest fetch request
      if (latestFetchRequestTime.current === currentFetchTime) {
        setError(err.message || 'Failed to fetch availability');
        setTimeSlots([]); // Clear slots on error
      }
    } finally {
      // Only turn off loading if this is the latest request completing
      if (latestFetchRequestTime.current === currentFetchTime) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    if (doctorId) {
      fetchAvailability(true); // Initial fetch should be fresh
      
      // Polling is commented out for now
      // const intervalId = setInterval(() => {
      //   console.log('Polling for updates...');
      //   fetchAvailability(true);
      // }, 30000); 
      // 
      // return () => clearInterval(intervalId); 
    }
  }, [selectedDate, doctorId]);

  const handleAddSlot = () => {
    if (!doctorId) {
      setError('No doctor profile found. Cannot add time slots.');
      return;
    }
    setError(null);
    setSuccess(null);
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
    setNewSlot({ start: null, end: null });
  };

  const handleSaveSlot = async () => {
    if (!newSlot.start || !newSlot.end) {
      setError('Please select both start and end times');
      return;
    }

    // Validate that end time is after start time
    if (newSlot.end <= newSlot.start) {
      setError('End time must be after start time');
      return;
    }

    if (!doctorId) {
      setError('Doctor ID not available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const requestBody = {
        doctorId: doctorId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: format(newSlot.start, 'HH:mm'),
        endTime: format(newSlot.end, 'HH:mm'),
      };

      console.log('POST Request - Create Time Slot:', {
        endpoint: `${API_BASE_URL}/availability/slots`,
        method: 'POST',
        headers: getAuthHeaders(),
        body: requestBody
      });

      const response = await fetch(`${API_BASE_URL}/availability/slots`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to save time slot');
      }

      // Force refresh the data from the server
      await fetchAvailability(true);
      
      setSuccess('Time slot added successfully');
      handleCloseDialog();
    } catch (err) {
      setError(err.message || 'Failed to save time slot');
      console.error('Save slot error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSlot = async (slotId) => {
    try {
      setLoading(true);
      setError(null);
      console.log('DELETE Request - Delete Time Slot:', {
        endpoint: `${API_BASE_URL}/availability/slots/${slotId}`,
        method: 'DELETE',
        headers: getAuthHeaders()
      });

      const response = await fetch(`${API_BASE_URL}/availability/slots/${slotId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to delete time slot');
      }

      // Force refresh the data from the server
      await fetchAvailability(true);
      
      setSuccess('Time slot deleted successfully');
    } catch (err) {
      setError(err.message || 'Failed to delete time slot');
      console.error('Delete slot error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleMenuOpen = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
  };

  const handleGenerateConfirmOpen = () => {
    setError(null);
    setSuccess(null);
    setGenerateConfirmOpen(true);
    handleMenuClose();
  };

  const handleGenerateConfirmClose = () => {
    setGenerateConfirmOpen(false);
  };

  const handleGenerateSlots = async () => {
    if (!doctorId) {
      setError('Doctor ID not available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const requestBody = {
        startDate: format(selectedDate, 'yyyy-MM-dd'),
        endDate: format(selectedDate, 'yyyy-MM-dd'),
      };

      console.log('POST Request - Generate Slots:', {
        endpoint: `${API_BASE_URL}/availability/doctor/${doctorId}/generate`,
        method: 'POST',
        headers: getAuthHeaders(),
        body: requestBody
      });

      const response = await fetch(`${API_BASE_URL}/availability/doctor/${doctorId}/generate`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || 'Failed to generate time slots');
      }

      const data = await response.json();
      
      // Force refresh to ensure we get the latest data from the server
      await fetchAvailability(true);
      
      setGenerateConfirmOpen(false);
      setSuccess(`Successfully generated ${data.count} time slots`);
    } catch (err) {
      setError(err.message || 'Failed to generate time slots');
      console.error('Generate slots error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleCalendarAction = async (action) => {
    if (!doctorId) {
      setError('Doctor ID not available');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      const requestBody = {
        date: format(selectedDate, 'yyyy-MM-dd'),
      };

      console.log(`POST Request - ${action.charAt(0).toUpperCase() + action.slice(1)} Google Calendar:`, {
        endpoint: `${API_BASE_URL}/availability/doctor/${doctorId}/${action}/google`,
        method: 'POST',
        headers: getAuthHeaders(),
        body: requestBody
      });

      const response = await fetch(`${API_BASE_URL}/availability/doctor/${doctorId}/${action}/google`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => null);
        throw new Error(errorData?.message || `Failed to ${action} with Google Calendar`);
      }

      if (action === 'import' || action === 'sync') {
        const data = await response.json();
        setTimeSlots(data.data || []);
      }
      setSuccess(`Successfully ${action}ed with Google Calendar`);
    } catch (err) {
      setError(err.message || `Failed to ${action} with Google Calendar`);
      console.error(`${action} Google Calendar error:`, err);
    } finally {
      setLoading(false);
      handleMenuClose();
    }
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Manage Availability
      </Typography>
      <Typography variant="subtitle1" color="text.secondary" gutterBottom>
        Set your available time slots for appointments
      </Typography>

      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}

      {success && (
        <Alert severity="success" sx={{ mb: 2 }}>
          {success}
        </Alert>
      )}

      <Grid container spacing={3}>
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DateCalendar
                value={selectedDate}
                onChange={(newDate) => {
                  setSelectedDate(newDate);
                  setError(null);
                  setSuccess(null);
                }}
              />
            </LocalizationProvider>
          </Paper>
        </Grid>

        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 3 }}>
              <Typography variant="h6">
                Available Time Slots for {format(selectedDate, 'MMMM d, yyyy')}
              </Typography>
              <Box>
                <Button
                  variant="contained"
                  onClick={handleAddSlot}
                  disabled={loading}
                  sx={{ mr: 1 }}
                >
                  Add Time Slot
                </Button>
                <Button
                  variant="outlined"
                  onClick={handleMenuOpen}
                  disabled={loading}
                >
                  More Actions
                </Button>
                <Menu
                  anchorEl={anchorEl}
                  open={Boolean(anchorEl)}
                  onClose={handleMenuClose}
                >
                  <MenuItem onClick={handleGenerateConfirmOpen}>Generate Slots</MenuItem>
                  <MenuItem onClick={() => handleGoogleCalendarAction('import')}>
                    Import from Google Calendar
                  </MenuItem>
                  <MenuItem onClick={() => handleGoogleCalendarAction('export')}>
                    Export to Google Calendar
                  </MenuItem>
                  <MenuItem onClick={() => handleGoogleCalendarAction('sync')}>
                    Sync with Google Calendar
                  </MenuItem>
                </Menu>
              </Box>
            </Box>

            {loading ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : timeSlots.length === 0 ? (
              <Typography color="text.secondary" align="center">
                No time slots available for this date
              </Typography>
            ) : (
              <Grid container spacing={2}>
                {timeSlots.map((slot) => {
                  // Convert slot ID to string to use as key
                  const slotIdStr = typeof slot._id === 'object' && slot._id !== null 
                    ? (slot._id.toString ? slot._id.toString() : String(slot._id)) 
                    : String(slot._id);
                    
                  return (
                    <Grid item xs={12} sm={6} md={4} key={slotIdStr}>
                      <Paper sx={{ p: 2, position: 'relative' }}>
                        <Typography variant="subtitle1">
                          {format(parse(slot.startTime, 'HH:mm', new Date()), 'h:mm a')} -{' '}
                          {format(parse(slot.endTime, 'HH:mm', new Date()), 'h:mm a')}
                        </Typography>
                        <Box sx={{ mt: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <Chip 
                            size="small"
                            label={slot.status.charAt(0).toUpperCase() + slot.status.slice(1)}
                            color={slot.status === 'available' ? 'success' : slot.status === 'booked' ? 'primary' : 'default'}
                          />
                          <Button
                            size="small"
                            color="error"
                            onClick={() => handleDeleteSlot(slot._id)}
                            sx={{ position: 'absolute', top: 8, right: 8 }}
                            disabled={slot.status === 'booked'}
                            title={slot.status === 'booked' ? "Cannot delete booked slots" : "Delete this slot"}
                          >
                            Delete
                          </Button>
                        </Box>
                      </Paper>
                    </Grid>
                  );
                })}
              </Grid>
            )}
          </Paper>
        </Grid>
      </Grid>

      <Dialog open={openDialog} onClose={handleCloseDialog}>
        <DialogTitle>Add New Time Slot</DialogTitle>
        <DialogContent>
          <Box sx={{ mt: 2 }}>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <TimePicker
                label="Start Time"
                value={newSlot.start}
                onChange={(newValue) => setNewSlot({ ...newSlot, start: newValue })}
                sx={{ mr: 2 }}
                disabled={loading}
                slotProps={{
                  textField: {
                    helperText: "Select a time that doesn't overlap with existing slots",
                  }
                }}
              />
              <TimePicker
                label="End Time"
                value={newSlot.end}
                onChange={(newValue) => setNewSlot({ ...newSlot, end: newValue })}
                disabled={loading}
                slotProps={{
                  textField: {
                    helperText: "Must be after start time and not overlap with existing slots",
                  }
                }}
              />
            </LocalizationProvider>
          </Box>
          {error && (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          )}
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                Creating time slot...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog} disabled={loading}>Cancel</Button>
          <Button 
            onClick={handleSaveSlot} 
            variant="contained" 
            disabled={loading || !newSlot.start || !newSlot.end}
          >
            {loading ? (
              <>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={generateConfirmOpen}
        onClose={handleGenerateConfirmClose}
      >
        <DialogTitle>Generate Time Slots</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will generate 20-minute appointment slots for {format(selectedDate, 'MMMM d, yyyy')} with the following schedule:
          </DialogContentText>
          <Box sx={{ mt: 2, mb: 2 }}>
            <ul>
              <li>Morning: 9:00 AM - 12:00 PM</li>
              <li>Lunch Break: 12:00 PM - 1:00 PM</li>
              <li>Afternoon: 1:00 PM - 5:00 PM</li>
            </ul>
          </Box>
          <DialogContentText>
            Any existing overlapping slots will be preserved.
          </DialogContentText>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
              <CircularProgress size={24} />
              <Typography variant="body2" color="text.secondary" sx={{ ml: 2 }}>
                Generating time slots...
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={handleGenerateConfirmClose} disabled={loading}>Cancel</Button>
          <Button onClick={handleGenerateSlots} color="primary" disabled={loading}>
            {loading ? (
              <>
                <CircularProgress size={16} color="inherit" sx={{ mr: 1 }} />
                Generating...
              </>
            ) : (
              'Generate Slots'
            )}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default ManageAvailability;