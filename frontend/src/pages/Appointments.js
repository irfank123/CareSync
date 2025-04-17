import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
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
} from '@mui/material';
import { Link as RouterLink } from 'react-router-dom';
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
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const Appointments = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openDialog, setOpenDialog] = useState(false);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [appointmentToCancel, setAppointmentToCancel] = useState(null);

  const fetchAppointments = async () => {
    setLoading(true);
    setError(null);
    try {
      let url = `${API_URL}/appointments`;
      
      // Add query parameters
      const params = new URLSearchParams();
      
      if (filter !== 'all') {
        params.append('status', filter);
      }
      
      if (selectedDate) {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        params.append('date', formattedDate);
      }
      
      // Append the params to the URL if any exist
      if (params.toString()) {
        url += `?${params.toString()}`;
      }
      
      const response = await axios.get(url, getAuthHeaders());
      
      if (response.data && response.data.data) {
        setAppointments(response.data.data);
      } else {
        setAppointments([]);
      }
    } catch (err) {
      console.error('Error fetching appointments:', err);
      setError('Failed to fetch appointments. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [filter, selectedDate, user]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const handleViewChange = (event, newValue) => {
    setView(newValue);
  };

  const handleFilterChange = (event) => {
    setFilter(event.target.value);
  };

  const handleDateChange = (newDate) => {
    setSelectedDate(newDate);
  };

  const handleOpenDialog = () => {
    setOpenDialog(true);
  };

  const handleCloseDialog = () => {
    setOpenDialog(false);
  };

  const handleOpenCancelDialog = (appointment) => {
    setAppointmentToCancel(appointment);
    setOpenCancelDialog(true);
  };

  const handleCloseCancelDialog = () => {
    setAppointmentToCancel(null);
    setCancelReason('');
    setOpenCancelDialog(false);
  };

  const handleCancelAppointment = async () => {
    if (!appointmentToCancel) return;
    
    setLoading(true);
    try {
      const response = await axios.put(
        `${API_URL}/appointments/${appointmentToCancel._id}`, 
        { 
          status: 'cancelled',
          cancelReason
        },
        getAuthHeaders()
      );
      
      if (response.data && response.data.success) {
        toast.success('Appointment cancelled successfully');
        fetchAppointments(); // Refresh the list
      } else {
        throw new Error('Failed to cancel appointment');
      }
    } catch (err) {
      console.error('Error cancelling appointment:', err);
      toast.error('Failed to cancel appointment. Please try again.');
    } finally {
      setLoading(false);
      handleCloseCancelDialog();
    }
  };

  const getStatusChip = (status) => {
    const statusProps = {
      scheduled: { color: 'primary', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      completed: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      cancelled: { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
      'checked-in': { color: 'info', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      'in-progress': { color: 'warning', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      'no-show': { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
    };

    const { color, icon } = statusProps[status] || statusProps.scheduled;

    return (
      <Chip
        icon={icon}
        label={status.charAt(0).toUpperCase() + status.slice(1).replace(/-/g, ' ')}
        color={color}
        size="small"
      />
    );
  };

  const formatAppointmentDate = (date) => {
    try {
      return format(new Date(date), 'MMM dd, yyyy');
    } catch (error) {
      console.error('Date formatting error:', error);
      return date;
    }
  };

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
            component={RouterLink}
            to="/appointments/schedule"
          >
            Book New Appointment
          </Button>
        )}
      </Box>

      {error && (
        <Alert severity="error" sx={{ mb: 3 }}>
          {error}
        </Alert>
      )}

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
            <MenuItem value="scheduled">Upcoming</MenuItem>
            <MenuItem value="completed">Completed</MenuItem>
            <MenuItem value="cancelled">Cancelled</MenuItem>
            <MenuItem value="checked-in">Checked In</MenuItem>
            <MenuItem value="in-progress">In Progress</MenuItem>
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6} md={4}>
          <LocalizationProvider dateAdapter={AdapterDateFns}>
            <DatePicker
              label="Filter by Date"
              value={selectedDate}
              onChange={handleDateChange}
              renderInput={(params) => <TextField {...params} fullWidth />}
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

      {/* Loading indicator */}
      {loading && (
        <Box display="flex" justifyContent="center" my={4}>
          <CircularProgress />
        </Box>
      )}

      {/* Appointments List View */}
      {view === 'list' && !loading && (
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
              {appointments.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} align="center">
                    No appointments found
                  </TableCell>
                </TableRow>
              ) : (
                appointments.map((appointment) => (
                  <TableRow key={appointment._id}>
                    <TableCell>
                      {isDoctor 
                        ? `${appointment.patient?.user?.firstName || ''} ${appointment.patient?.user?.lastName || ''}`
                        : `Dr. ${appointment.doctor?.user?.firstName || ''} ${appointment.doctor?.user?.lastName || ''}`
                      }
                    </TableCell>
                    <TableCell>{formatAppointmentDate(appointment.date)}</TableCell>
                    <TableCell>{`${appointment.startTime} - ${appointment.endTime}`}</TableCell>
                    <TableCell>{appointment.type}</TableCell>
                    <TableCell>{getStatusChip(appointment.status)}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', gap: 1 }}>
                        <Button
                          size="small"
                          variant="outlined"
                          component={RouterLink}
                          to={`/appointments/${appointment._id}`}
                        >
                          View
                        </Button>
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
                              onClick={() => handleOpenCancelDialog(appointment)}
                            >
                              <Cancel />
                            </IconButton>
                          </>
                        )}
                      </Box>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Calendar View - Placeholder for now */}
      {view === 'calendar' && !loading && (
        <Paper sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="h6" color="text.secondary">
            Calendar view coming soon...
          </Typography>
        </Paper>
      )}

      {/* Cancel Appointment Dialog */}
      <Dialog open={openCancelDialog} onClose={handleCloseCancelDialog}>
        <DialogTitle>Cancel Appointment</DialogTitle>
        <DialogContent>
          <Box sx={{ pt: 2 }}>
            <Typography gutterBottom>
              Are you sure you want to cancel this appointment?
            </Typography>
            <TextField
              fullWidth
              label="Reason for Cancellation"
              multiline
              rows={4}
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              sx={{ mt: 2 }}
            />
          </Box>
        </DialogContent>
        <DialogActions>
          <Button onClick={handleCloseCancelDialog}>Keep Appointment</Button>
          <Button 
            variant="contained" 
            color="error" 
            onClick={handleCancelAppointment}
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : 'Cancel Appointment'}
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Appointments;