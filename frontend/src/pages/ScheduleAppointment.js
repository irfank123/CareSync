import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Container,
  Paper,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  FormControl,
  FormLabel,
  RadioGroup,
  FormControlLabel,
  Radio,
  Grid,
  Card,
  CardContent,
  Typography as MuiTypography,
  TextField,
  Alert,
  CircularProgress,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-toastify';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

const steps = [
  'Select Appointment Type',
  'Choose Doctor',
  'Select Date & Time',
  'Preliminary Assessment',
  'Confirm Details',
];

const appointmentTypes = [
  { id: 'in-person', label: 'In-Person Visit', description: 'Face-to-face consultation at the clinic' },
  { id: 'virtual', label: 'Virtual Consultation', description: 'Online video consultation' },
];

const ScheduleAppointment = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeStep, setActiveStep] = useState(0);
  const [appointmentType, setAppointmentType] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [timeSlots, setTimeSlots] = useState([]);
  const [assessment, setAssessment] = useState({
    symptoms: '',
    duration: '',
    severity: '',
    additionalNotes: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingTimeSlots, setLoadingTimeSlots] = useState(false);

  // Fetch doctors when component mounts
  useEffect(() => {
    const fetchDoctors = async () => {
      setLoading(true);
      try {
        const response = await axios.get(`${API_URL}/doctors`);
        if (response.data && response.data.data) {
          setDoctors(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Failed to load doctors. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  // Fetch available time slots when doctor and date are selected
  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!selectedDoctor || !selectedDate) return;
      
      setLoadingTimeSlots(true);
      setTimeSlots([]);
      try {
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        const response = await axios.get(
          `${API_URL}/availability/doctor/${selectedDoctor._id}/slots/available?date=${formattedDate}`
        );
        
        if (response.data && response.data.data) {
          setTimeSlots(response.data.data);
        }
      } catch (err) {
        console.error('Error fetching time slots:', err);
        setError('Failed to load available time slots. Please try again later.');
      } finally {
        setLoadingTimeSlots(false);
      }
    };

    if (selectedDoctor && selectedDate) {
      fetchTimeSlots();
    }
  }, [selectedDoctor, selectedDate]);

  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    };
  };

  const handleNext = () => {
    if (validateCurrentStep()) {
      setActiveStep((prevStep) => prevStep + 1);
      setError('');
    }
  };

  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
    setError('');
  };

  const validateCurrentStep = () => {
    switch (activeStep) {
      case 0:
        if (!appointmentType) {
          setError('Please select an appointment type');
          return false;
        }
        break;
      case 1:
        if (!selectedDoctor) {
          setError('Please select a doctor');
          return false;
        }
        break;
      case 2:
        if (!selectedDate || !selectedTimeSlot) {
          setError('Please select both date and time slot');
          return false;
        }
        break;
      case 3:
        if (!assessment.symptoms || !assessment.duration) {
          setError('Please fill in required assessment fields');
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      
      // Get patient ID from user object
      let patientId;
      if (user.role === 'patient' && user.roleData && user.roleData._id) {
        patientId = user.roleData._id;
      } else {
        // Fetch patient profile if not available in user object
        const patientResponse = await axios.get(`${API_URL}/patients/me`, getAuthHeaders());
        patientId = patientResponse.data.data._id;
      }
      
      // Prepare appointment data
      const appointmentData = {
        patientId,
        doctorId: selectedDoctor._id,
        timeSlotId: selectedTimeSlot._id,
        type: appointmentType,
        isVirtual: appointmentType === 'virtual',
        reasonForVisit: assessment.symptoms,
        notes: `Duration: ${assessment.duration}, Severity: ${assessment.severity || 'Not specified'}, Additional notes: ${assessment.additionalNotes || 'None'}`
      };
      
      console.log('Submitting appointment:', appointmentData);
      
      // Create appointment via API
      const response = await axios.post(
        `${API_URL}/appointments`, 
        appointmentData, 
        getAuthHeaders()
      );
      
      if (response.data && response.data.success) {
        toast.success('Appointment scheduled successfully!');
        navigate('/appointments');
      } else {
        throw new Error('Failed to create appointment');
      }
    } catch (error) {
      console.error('Create appointment error:', error);
      setError('Failed to schedule appointment. Please try again.');
      toast.error('Failed to schedule appointment. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const renderStepContent = (step) => {
    switch (step) {
      case 0:
        return (
          <Box sx={{ mt: 3 }}>
            <FormControl component="fieldset">
              <FormLabel component="legend">Select Appointment Type</FormLabel>
              <RadioGroup
                value={appointmentType}
                onChange={(e) => setAppointmentType(e.target.value)}
              >
                {appointmentTypes.map((type) => (
                  <FormControlLabel
                    key={type.id}
                    value={type.id}
                    control={<Radio />}
                    label={
                      <Box>
                        <Typography variant="subtitle1">{type.label}</Typography>
                        <Typography variant="body2" color="text.secondary">
                          {type.description}
                        </Typography>
                      </Box>
                    }
                  />
                ))}
              </RadioGroup>
            </FormControl>
          </Box>
        );

      case 1:
        return (
          <Box sx={{ mt: 3 }}>
            {loading ? (
              <Box display="flex" justifyContent="center" mt={3}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                {doctors.length === 0 ? (
                  <Grid item xs={12}>
                    <Alert severity="info">No doctors available at the moment.</Alert>
                  </Grid>
                ) : (
                  doctors.map((doctor) => (
                    <Grid item xs={12} sm={6} key={doctor._id}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: selectedDoctor?._id === doctor._id ? 2 : 0,
                          borderColor: 'primary.main',
                          height: '100%',
                        }}
                        onClick={() => setSelectedDoctor(doctor)}
                      >
                        <CardContent>
                          <Typography variant="h6">Dr. {doctor.user?.firstName} {doctor.user?.lastName}</Typography>
                          <Typography color="text.secondary">
                            {doctor.specialties?.join(', ')}
                          </Typography>
                          <Typography variant="body2">
                            {doctor.acceptingNewPatients ? 'Accepting new patients' : 'Not accepting new patients'}
                          </Typography>
                        </CardContent>
                      </Card>
                    </Grid>
                  ))
                )}
              </Grid>
            )}
          </Box>
        );

      case 2:
        return (
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12} sm={6}>
                <LocalizationProvider dateAdapter={AdapterDateFns}>
                  <DatePicker
                    label="Select Date"
                    value={selectedDate}
                    onChange={setSelectedDate}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                    minDate={new Date()}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Available Time Slots
                </Typography>
                {loadingTimeSlots ? (
                  <Box display="flex" justifyContent="center" mt={3}>
                    <CircularProgress />
                  </Box>
                ) : (
                  timeSlots.length === 0 ? (
                    <Alert severity="info">
                      {selectedDate ? 'No available time slots for the selected date.' : 'Please select a date to see available time slots.'}
                    </Alert>
                  ) : (
                    <Grid container spacing={1}>
                      {timeSlots.map((slot) => (
                        <Grid item xs={6} sm={3} key={slot._id}>
                          <Button
                            fullWidth
                            variant={selectedTimeSlot?._id === slot._id ? 'contained' : 'outlined'}
                            onClick={() => setSelectedTimeSlot(slot)}
                          >
                            {slot.startTime} - {slot.endTime}
                          </Button>
                        </Grid>
                      ))}
                    </Grid>
                  )
                )}
              </Grid>
            </Grid>
          </Box>
        );

      case 3:
        return (
          <Box sx={{ mt: 3 }}>
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="What are your symptoms?"
                  multiline
                  rows={3}
                  value={assessment.symptoms}
                  onChange={(e) => setAssessment({ ...assessment, symptoms: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="How long have you been experiencing these symptoms?"
                  value={assessment.duration}
                  onChange={(e) => setAssessment({ ...assessment, duration: e.target.value })}
                  required
                />
              </Grid>
              <Grid item xs={12}>
                <FormControl component="fieldset">
                  <FormLabel>Severity of Symptoms</FormLabel>
                  <RadioGroup
                    value={assessment.severity}
                    onChange={(e) => setAssessment({ ...assessment, severity: e.target.value })}
                  >
                    <FormControlLabel value="mild" control={<Radio />} label="Mild" />
                    <FormControlLabel value="moderate" control={<Radio />} label="Moderate" />
                    <FormControlLabel value="severe" control={<Radio />} label="Severe" />
                  </RadioGroup>
                </FormControl>
              </Grid>
              <Grid item xs={12}>
                <TextField
                  fullWidth
                  label="Additional Notes"
                  multiline
                  rows={3}
                  value={assessment.additionalNotes}
                  onChange={(e) => setAssessment({ ...assessment, additionalNotes: e.target.value })}
                />
              </Grid>
            </Grid>
          </Box>
        );

      case 4:
        return (
          <Box sx={{ mt: 3 }}>
            <Paper sx={{ p: 3 }}>
              <Typography variant="h6" gutterBottom>
                Appointment Summary
              </Typography>
              <Grid container spacing={2}>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Type:</strong> {appointmentType === 'virtual' ? 'Virtual Consultation' : 'In-Person Visit'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Doctor:</strong> Dr. {selectedDoctor?.user?.firstName} {selectedDoctor?.user?.lastName}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Specialties:</strong> {selectedDoctor?.specialties?.join(', ')}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Date & Time:</strong>{' '}
                    {selectedDate && selectedTimeSlot && 
                      `${format(selectedDate, 'MMMM d, yyyy')} at ${selectedTimeSlot.startTime} - ${selectedTimeSlot.endTime}`}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Primary Symptoms:</strong> {assessment.symptoms}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Duration:</strong> {assessment.duration}
                  </Typography>
                </Grid>
                {assessment.severity && (
                  <Grid item xs={12}>
                    <Typography>
                      <strong>Severity:</strong> {assessment.severity}
                    </Typography>
                  </Grid>
                )}
                {assessment.additionalNotes && (
                  <Grid item xs={12}>
                    <Typography>
                      <strong>Additional Notes:</strong> {assessment.additionalNotes}
                    </Typography>
                  </Grid>
                )}
              </Grid>
            </Paper>
          </Box>
        );

      default:
        return null;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <Paper sx={{ p: 3 }}>
        <Typography variant="h4" gutterBottom>
          Schedule Appointment
        </Typography>

        <Stepper activeStep={activeStep} sx={{ mb: 4 }}>
          {steps.map((label) => (
            <Step key={label}>
              <StepLabel>{label}</StepLabel>
            </Step>
          ))}
        </Stepper>

        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}

        {renderStepContent(activeStep)}

        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
          {activeStep > 0 && (
            <Button onClick={handleBack} sx={{ mr: 1 }} disabled={loading}>
              Back
            </Button>
          )}
          {activeStep === steps.length - 1 ? (
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Schedule Appointment'}
            </Button>
          ) : (
            <Button 
              variant="contained" 
              onClick={handleNext}
              disabled={loading}
            >
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default ScheduleAppointment;