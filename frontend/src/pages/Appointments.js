import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tabs,
  Tab,
  Chip,
  IconButton,
  TextField,
  MenuItem,
  Grid,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  FormControl,
  InputLabel,
  Select,
  CircularProgress,
  Alert,
  Snackbar,
} from '@mui/material';
import { Link as RouterLink, useNavigate, useLocation } from 'react-router-dom';
import {
  CalendarMonth,
  List as ListIcon,
  Edit,
  Cancel,
  CheckCircle,
  AccessTime,
} from '@mui/icons-material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { appointmentService, patientService, doctorService } from '../services/api';
import { safeObjectId } from '../utils/stringUtils';

const Appointments = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(null);
  const [openDialog, setOpenDialog] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [userId, setUserId] = useState(null);
  const [snackbarMessage, setSnackbarMessage] = useState('');
  const [snackbarSeverity, setSnackbarSeverity] = useState('success');
  const [snackbarOpen, setSnackbarOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Helper function to validate dates
  const isValidDate = (date) => {
    return date instanceof Date && !isNaN(date);
  };

  // Fetch user ID based on role
  useEffect(() => {
    const fetchUserId = async () => {
      try {
        if (user?.role === 'doctor') {
          const response = await doctorService.getByUserId(user.id);
          console.log('Doctor response:', response);
          // Extract the doctor ID from the response
          setUserId(response?.data?.data?._id);
        }
        // We don't need to fetch patient ID anymore since we use the /me endpoint
      } catch (err) {
        console.error('Error fetching user record:', err);
        setError('Failed to load user data');
      }
    };

    if (user?.id && user?.role === 'doctor') {
      fetchUserId();
    }
  }, [user]);

  // Fetch appointments function wrapped in useCallback
  const fetchAppointments = useCallback(async () => {
    try {
      setLoading(true);
      setError(null); // Clear previous errors
      let response;

      // Determine the correct service call based on user role
      if (user?.role === 'doctor' && userId) {
        // Fetch all appointments for this doctor (assuming getDoctorAppointments handles pagination/filtering if needed)
        response = await appointmentService.getDoctorAppointments(userId); 
      } else if (user?.role === 'patient') {
        // Use the /me endpoint for patients
        response = await appointmentService.getMyAppointments(); 
      } else if (user?.role === 'admin' || user?.role === 'staff') {
        // Admin or staff - get all appointments (ensure this supports pagination/filtering or adjust as needed)
        response = await appointmentService.getAll(); 
      } else {
         console.log("User role not determined or doctor ID missing, skipping fetch.");
         setLoading(false);
         return; // Exit if user role isn't clear or doctor ID is missing
      }

      if (response?.data?.data) { // Check if response and data exists
        const { data, totalPages: pages, currentPage: page } = response.data;
        console.log("Fetched appointments:", data); // Log fetched data
        setAppointments(data || []);
        setTotalPages(pages || 1);
        setCurrentPage(page || 1);
      } else {
         console.log("No appointment data received or empty response.");
         setAppointments([]); // Set to empty array if no data
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError(err.message || 'Failed to load appointments'); // Set more specific error
      setAppointments([]); // Clear appointments on error
    } finally {
      setLoading(false);
    }
  }, [user?.role, userId]);

  // Initial fetch on component mount or when user/role changes
  useEffect(() => {
    // Only fetch if the user role is determined (and doctorId if applicable)
    if (user?.role && (user.role !== 'doctor' || userId)) {
        console.log(`Initial fetch triggered. Role: ${user.role}, DoctorId: ${userId}`);
        fetchAppointments();
    } else {
        console.log("Skipping initial fetch: User role or doctor ID not ready.");
        // If loading isn't stopped elsewhere when skipping, stop it here.
        if(loading) setLoading(false); 
    }
  }, [fetchAppointments, user?.role, userId]); // Now depends on the memoized fetch function

  // Effect to check for refresh flag from navigation state
  useEffect(() => {
    if (location.state?.needsRefresh) {
      console.log("Detected 'needsRefresh' state, triggering appointments fetch.");
      fetchAppointments();
      // Clear the state to prevent re-fetching on subsequent renders/navigation
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, fetchAppointments, navigate]);

  const handleViewChange = (event, newValue) => {
    setView(newValue);
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const getStatusChip = (status) => {
    const statusMapping = {
      'scheduled': 'upcoming',
      'checked-in': 'in-progress',
      'in-progress': 'in-progress',
      'completed': 'completed',
      'cancelled': 'cancelled',
      'no-show': 'cancelled'
    };
    
    const mappedStatus = statusMapping[status] || status;
    
    const statusProps = {
      'upcoming': { color: 'primary', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      'in-progress': { color: 'warning', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      'completed': { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      'cancelled': { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
    };

    const { color, icon } = statusProps[mappedStatus] || statusProps.upcoming;

    return (
      <Chip
        icon={icon}
        label={status.charAt(0).toUpperCase() + status.slice(1).replace('-', ' ')}
        color={color}
        size="small"
      />
    );
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (filter === 'all') return true;
    
    // Map the filter values to appointment status values
    const statusMapping = {
      'upcoming': ['scheduled', 'checked-in'],
      'completed': ['completed'],
      'cancelled': ['cancelled', 'no-show']
    };
    
    return statusMapping[filter]?.includes(appointment.status);
  });

  const handleViewClick = (appointmentId) => {
    console.log('Storing appointment ID:', appointmentId);
    // Check if it's a temporary ID
    if (appointmentId && typeof appointmentId === 'string' && appointmentId.startsWith('temp-')) {
      // Show error message
      setSnackbarMessage("Cannot view details for this appointment - invalid ID format.");
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Check if it's a valid MongoDB ObjectID
    const isValidObjectId = /^[0-9a-fA-F]{24}$/.test(appointmentId);
    if (!isValidObjectId) {
      // Show error message
      setSnackbarMessage("Cannot view details: The appointment ID is not in a valid format.");
      setSnackbarSeverity('error');
      setSnackbarOpen(true);
      return;
    }
    
    // Valid ID, navigate to appointment details
    navigate(`/appointments/${appointmentId}`);
  };

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      {/* Header */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 4 }}>
        <Typography variant="h4" component="h1">
          {isDoctor ? 'Appointments Schedule' : 'My Appointments'}
        </Typography>
        {!isDoctor && (
          <Button
            variant="contained"
            color="primary"
            startIcon={<CalendarMonth />}
            onClick={handleOpenDialog}
          >
            Book New Appointment
          </Button>
        )}
      </Box>
      
      {/* Snackbar for showing error messages */}
      <Snackbar
        open={snackbarOpen}
        autoHideDuration={6000}
        onClose={() => setSnackbarOpen(false)}
        anchorOrigin={{ vertical: 'top', horizontal: 'center' }}
      >
        <Alert 
          onClose={() => setSnackbarOpen(false)} 
          severity={snackbarSeverity}
          sx={{ width: '100%' }}
        >
          {snackbarMessage}
        </Alert>
      </Snackbar>
      
      {/* Filters and View Toggle */}
      <Grid container spacing={2} sx={{ mb: 3 }}>
        <Grid item xs={12} sm={6} md={4}>
          <TextField
            select
            fullWidth
            label="Filter by Status"
            value={filter}
            onChange={handleFilterChange}
          >
            <MenuItem value="all">All Appointments</MenuItem>
            <MenuItem value="upcoming">Upcoming</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Filter by Date"
              value={selectedDate}
              onChange={(newValue) => setSelectedDate(newValue)}
              slotProps={{ textField: { fullWidth: true } }}
            />
          </LocalizationProvider>
        </Grid>
        <Grid item xs={12} md={4}>
          <Tabs
            value={view}
            onChange={handleViewChange}
            sx={{ borderBottom: 1, borderColor: 'divider' }}
          >
            <Tab
              icon={<ListIcon />}
              label="List"
              value="list"
            />
            <Tab
              icon={<CalendarMonth />}
              label="Calendar"
              value="calendar"
            />
          </Tabs>
        </Grid>
      </Grid>

      {/* Appointments List View */}
      {view === 'list' && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{isDoctor ? 'Patient' : 'Doctor'}</TableCell>
                <TableCell>Date</TableCell>
                <TableCell>Time</TableCell>
                <TableCell>Type</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {filteredAppointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">No appointments found</TableCell>
                </TableRow>
              ) : (
                filteredAppointments.map((appointment, index) => {
                  // Convert the appointment._id to a string for use as a key using our utility
                  const appointmentIdStr = safeObjectId(appointment._id);
                  
                  return (
                    <TableRow key={appointmentIdStr || `appointment-${index}`}>
                      <TableCell>
                        {isDoctor 
                          ? `${appointment.patientName || `${appointment.patientUser?.firstName || 'Unknown'} ${appointment.patientUser?.lastName || 'Patient'}`}` 
                          : appointment.doctorName || `Dr. ${appointment.doctorUser?.firstName || 'Unknown'} ${appointment.doctorUser?.lastName || 'Doctor'}`}
                      </TableCell>
                      <TableCell>
                        {appointment.date ? new Date(appointment.date).toLocaleDateString() : 'No date'}
                      </TableCell>
                      <TableCell>{appointment.startTime}</TableCell>
                      <TableCell>{appointment.type}</TableCell>
                      <TableCell>{getStatusChip(appointment.status)}</TableCell>
                      <TableCell>
                        <Box sx={{ display: 'flex', gap: 1 }}>
                          {appointmentIdStr ? (
                            <Button
                              size="small"
                              variant="outlined"
                              component={RouterLink}
                              to={`/appointments/${appointmentIdStr}`}
                              onClick={() => handleViewClick(appointmentIdStr)}
                            >
                              View
                            </Button>
                          ) : (
                            <Button size="small" variant="outlined" disabled>
                              View
                            </Button>
                          )}
                          {appointment.status === 'scheduled' && (
                            <>
                              {isDoctor && (
                                <IconButton
                                  size="small"
                                  color="primary"
                                  onClick={() => {}}
                                >
                                  <Edit />
                                </IconButton>
                              )}
                              <IconButton
                                size="small"
                                color="error"
                                onClick={() => {}}
                              >
                                <Cancel />
                              </IconButton>
                            </>
                          )}
                        </Box>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Calendar View - Placeholder for now */}
      {view === 'calendar' && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Calendar view coming soon...
          </Typography>
        </Paper>
      )}

      {/* Book Appointment Dialog */}
      <Dialog open={openDialog} onClose={handleCloseDialog} maxWidth="sm" fullWidth>
        <DialogTitle>Book New Appointment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
            <FormControl fullWidth>
              <InputLabel>Doctor</InputLabel>
              <Select label="Doctor">
                <MenuItem value="dr-wilson">Dr. Sarah Wilson</MenuItem>
                <MenuItem value="dr-chen">Dr. Michael Chen</MenuItem>
              </Select>
            </FormControl>
            <FormControl fullWidth>
              <InputLabel>Appointment Type</InputLabel>
              <Select label="Appointment Type">
                <MenuItem value="checkup">General Checkup</MenuItem>
                <MenuItem value="consultation">Consultation</MenuItem>
                <MenuItem value="follow-up">Follow-up</MenuItem>
              </Select>
            </FormControl>
            <LocalizationProvider dateAdapter={AdapterDateFns}>
              <DatePicker
                label="Date"
                value={selectedDate}
                onChange={(newValue) => setSelectedDate(newValue)}
                slotProps={{ textField: { fullWidth: true } }}
              />
            </LocalizationProvider>
            <TextField
              fullWidth
              label="Notes"
              multiline
              rows={4}
              placeholder="Add any notes or specific concerns..."
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseDialog}>Cancel</Button>
          <Button variant="contained" color="primary">
            Book Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Appointments; 