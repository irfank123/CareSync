import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
} from '@mui/icons-material';

const AppointmentDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isDoctor = user?.role === 'doctor';
  const [openCancelDialog, setOpenCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [openEditDialog, setOpenEditDialog] = useState(false);

  // Mock data - replace with API call
  const appointment = {
    id: 1,
    doctor: {
      id: 'dr-wilson',
      name: 'Dr. Sarah Wilson',
      specialty: 'General Physician',
      email: 'dr.wilson@caresync.com',
    },
    patient: {
      id: 'patient-1',
      name: 'John Doe',
      email: 'john.doe@example.com',
      phone: '+1 234 567 8900',
    },
    date: '2024-04-15',
    time: '10:00 AM',
    status: 'upcoming',
    type: 'General Checkup',
    notes: 'Regular health checkup',
    location: 'Room 102, Main Building',
    duration: '30 minutes',
    createdAt: '2024-03-10',
  };

  const getStatusChip = (status) => {
    const statusProps = {
      upcoming: { color: 'primary', icon: <AccessTime /> },
      completed: { color: 'success', icon: <CheckCircle /> },
      cancelled: { color: 'error', icon: <Cancel /> },
    };

    const { color, icon } = statusProps[status] || statusProps.upcoming;

    return (
      <Chip
        icon={icon}
        label={status.charAt(0).toUpperCase() + status.slice(1)}
        color={color}
      />
    );
  };

  const handleCancel = () => {
    // API call to cancel appointment
    console.log('Cancelling appointment with reason:', cancelReason);
    setOpenCancelDialog(false);
    // After successful cancellation, update the appointment status
  };

  const handleEdit = () => {
    // API call to update appointment
    console.log('Editing appointment');
    setOpenEditDialog(false);
    // After successful edit, update the appointment details
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ mb: 4, display: 'flex', alignItems: 'center', gap: 2 }}>
        <Button
          startIcon={<ArrowBack />}
          onClick={() => navigate('/appointments')}
        >
          Back to Appointments
        </Button>
        {getStatusChip(appointment.status)}
      </Box>

      <Grid container spacing={3}>
        {/* Main Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, mb: 3 }}>
            <Typography variant="h5" gutterBottom>
              {appointment.type}
            </Typography>
            <Grid container spacing={2} sx={{ mt: 2 }}>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <CalendarMonth color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Date & Time
                    </Typography>
                    <Typography>
                      {appointment.date} at {appointment.time}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
              <Grid item xs={12} sm={6}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 2 }}>
                  <AccessTime color="primary" />
                  <Box>
                    <Typography variant="body2" color="text.secondary">
                      Duration
                    </Typography>
                    <Typography>{appointment.duration}</Typography>
                  </Box>
                </Box>
              </Grid>
            </Grid>
            <Divider sx={{ my: 2 }} />
            <Box sx={{ mb: 2 }}>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Location
              </Typography>
              <Typography>{appointment.location}</Typography>
            </Box>
            <Box>
              <Typography variant="body2" color="text.secondary" gutterBottom>
                Notes
              </Typography>
              <Typography>{appointment.notes}</Typography>
            </Box>
          </Paper>

          {/* Actions */}
          {appointment.status === 'upcoming' && (
            <Box sx={{ display: 'flex', gap: 2 }}>
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
            </Box>
          )}
        </Grid>

        {/* Participant Details */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              {isDoctor ? 'Patient Details' : 'Doctor Details'}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 3 }}>
              <Person color="primary" />
              <Box>
                <Typography>
                  {isDoctor ? appointment.patient.name : appointment.doctor.name}
                </Typography>
                <Typography variant="body2" color="text.secondary">
                  {isDoctor ? appointment.patient.email : appointment.doctor.specialty}
                </Typography>
              </Box>
            </Box>
            {isDoctor && (
              <Box>
                <Typography variant="body2" color="text.secondary" gutterBottom>
                  Contact
                </Typography>
                <Typography>{appointment.patient.phone}</Typography>
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Cancel Dialog */}
      <Dialog open={openCancelDialog} onClose={() => setOpenCancelDialog(false)} maxWidth="sm" fullWidth>
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
          <Button onClick={() => setOpenCancelDialog(false)}>Keep Appointment</Button>
          <Button variant="contained" color="error" onClick={handleCancel}>
            Cancel Appointment
          </Button>
        </DialogActions>
      </Dialog>

      {/* Edit Dialog */}
      {isDoctor && (
        <Dialog open={openEditDialog} onClose={() => setOpenEditDialog(false)} maxWidth="sm" fullWidth>
          <DialogTitle>Edit Appointment</DialogTitle>
          <DialogContent>
            <Box sx={{ pt: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
              <TextField
                fullWidth
                label="Notes"
                multiline
                rows={4}
                defaultValue={appointment.notes}
              />
              <TextField
                fullWidth
                label="Location"
                defaultValue={appointment.location}
              />
              <TextField
                fullWidth
                label="Duration"
                defaultValue={appointment.duration}
              />
            </Box>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setOpenEditDialog(false)}>Cancel</Button>
            <Button variant="contained" onClick={handleEdit}>
              Save Changes
            </Button>
          </DialogActions>
        </Dialog>
      )}
    </Container>
  );
};

export default AppointmentDetails; 