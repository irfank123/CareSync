import React, { useState } from 'react';
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
import { format } from 'date-fns';

const Appointments = () => {
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [view, setView] = useState('list'); // 'list' or 'calendar'
  const [filter, setFilter] = useState('all');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [openDialog, setOpenDialog] = useState(false);

  // Temporary mock data
  const appointments = [
    {
      id: 1,
      doctor: 'Dr. Sarah Wilson',
      patient: 'John Doe',
      date: '2024-04-15',
      time: '10:00 AM',
      status: 'upcoming',
      type: 'General Checkup',
      notes: 'Regular health checkup',
    },
    {
      id: 2,
      doctor: 'Dr. Michael Chen',
      patient: 'Jane Smith',
      date: '2024-04-10',
      time: '02:30 PM',
      status: 'completed',
      type: 'Follow-up',
      notes: 'Post-treatment follow-up',
    },
    {
      id: 3,
      doctor: 'Dr. Sarah Wilson',
      patient: 'Alice Johnson',
      date: '2024-04-16',
      time: '11:30 AM',
      status: 'cancelled',
      type: 'Consultation',
      notes: 'Initial consultation',
    },
  ];

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
    const statusProps = {
      upcoming: { color: 'primary', icon: <AccessTime sx={{ fontSize: 16 }} /> },
      completed: { color: 'success', icon: <CheckCircle sx={{ fontSize: 16 }} /> },
      cancelled: { color: 'error', icon: <Cancel sx={{ fontSize: 16 }} /> },
    };

    const { color, icon } = statusProps[status] || statusProps.upcoming;

    return (
      <Chip
        icon={icon}
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={color}
        size="small"
      />
    );
  };

  const filteredAppointments = appointments.filter(appointment => {
    if (filter === 'all') return true;
    return appointment.status === filter;
  });

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
              {filteredAppointments.map((appointment) => (
                <TableRow key={appointment.id}>
                  <TableCell>
                    {isDoctor ? appointment.patient : appointment.doctor}
                  </TableCell>
                  <TableCell>{appointment.date}</TableCell>
                  <TableCell>{appointment.time}</TableCell>
                  <TableCell>{appointment.type}</TableCell>
                  <TableCell>{getStatusChip(appointment.status)}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', gap: 1 }}>
                      <Button
                        size="small"
                        variant="outlined"
                        component={RouterLink}
                        to={`/appointments/${appointment.id}`}
                      >
                        View
                      </Button>
                      {appointment.status === 'upcoming' && (
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
              ))}
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
                renderInput={(params) => <TextField {...params} fullWidth />}
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
          <Button variant="contained" onClick={handleCloseDialog}>
            Book Appointment
          </Button>
        </DialogActions>
      </Dialog>
    </Container>
  );
};

export default Appointments; 