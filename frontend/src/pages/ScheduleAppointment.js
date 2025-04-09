import React, { useState } from 'react';
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
  CardActions,
  TextField,
  Alert,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';

const steps = [
  'Select Appointment Type',
  'Choose Doctor',
  'Select Date & Time',
  'Preliminary Assessment',
  'Confirm Details',
];

// Mock data - replace with API calls
const appointmentTypes = [
  { id: 'in-person', label: 'In-Person Visit', description: 'Face-to-face consultation at the clinic' },
  { id: 'virtual', label: 'Virtual Consultation', description: 'Online video consultation' },
];

const mockDoctors = [
  {
    id: 1,
    name: 'Dr. Sarah Wilson',
    specialty: 'General Physician',
    availability: '9 AM - 5 PM',
    image: 'https://via.placeholder.com/150',
  },
  {
    id: 2,
    name: 'Dr. Michael Chen',
    specialty: 'Cardiologist',
    availability: '10 AM - 6 PM',
    image: 'https://via.placeholder.com/150',
  },
];

const timeSlots = [
  '09:00 AM', '09:30 AM', '10:00 AM', '10:30 AM',
  '11:00 AM', '11:30 AM', '02:00 PM', '02:30 PM',
  '03:00 PM', '03:30 PM', '04:00 PM', '04:30 PM',
];

const ScheduleAppointment = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [appointmentType, setAppointmentType] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTime, setSelectedTime] = useState('');
  const [assessment, setAssessment] = useState({
    symptoms: '',
    duration: '',
    severity: '',
    additionalNotes: '',
  });
  const [error, setError] = useState('');

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
        if (!selectedDate || !selectedTime) {
          setError('Please select both date and time');
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
      // API call to create appointment
      console.log('Submitting appointment:', {
        type: appointmentType,
        doctorId: selectedDoctor?.id,
        date: selectedDate,
        time: selectedTime,
        assessment,
      });
      
      // Mock success - replace with actual API call
      navigate('/dashboard', {
        state: { message: 'Appointment scheduled successfully!' }
      });
    } catch (error) {
      setError('Failed to schedule appointment. Please try again.');
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
            <Grid container spacing={3}>
              <Grid item xs={12}>
                <Button
                  fullWidth
                  variant={!selectedDoctor ? 'contained' : 'outlined'}
                  onClick={() => setSelectedDoctor(null)}
                >
                  Any Available Doctor
                </Button>
              </Grid>
              {mockDoctors.map((doctor) => (
                <Grid item xs={12} sm={6} key={doctor.id}>
                  <Card
                    sx={{
                      cursor: 'pointer',
                      border: selectedDoctor?.id === doctor.id ? 2 : 0,
                      borderColor: 'primary.main',
                    }}
                    onClick={() => setSelectedDoctor(doctor)}
                  >
                    <CardContent>
                      <Typography variant="h6">{doctor.name}</Typography>
                      <Typography color="text.secondary">{doctor.specialty}</Typography>
                      <Typography variant="body2">
                        Available: {doctor.availability}
                      </Typography>
                    </CardContent>
                  </Card>
                </Grid>
              ))}
            </Grid>
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
                <Grid container spacing={1}>
                  {timeSlots.map((time) => (
                    <Grid item xs={6} sm={3} key={time}>
                      <Button
                        fullWidth
                        variant={selectedTime === time ? 'contained' : 'outlined'}
                        onClick={() => setSelectedTime(time)}
                      >
                        {time}
                      </Button>
                    </Grid>
                  ))}
                </Grid>
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
                    <strong>Doctor:</strong> {selectedDoctor ? selectedDoctor.name : 'Any Available Doctor'}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Date & Time:</strong>{' '}
                    {selectedDate && `${format(selectedDate, 'MMMM d, yyyy')} at ${selectedTime}`}
                  </Typography>
                </Grid>
                <Grid item xs={12}>
                  <Typography>
                    <strong>Primary Symptoms:</strong> {assessment.symptoms}
                  </Typography>
                </Grid>
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
            <Button onClick={handleBack} sx={{ mr: 1 }}>
              Back
            </Button>
          )}
          {activeStep === steps.length - 1 ? (
            <Button variant="contained" onClick={handleSubmit}>
              Schedule Appointment
            </Button>
          ) : (
            <Button variant="contained" onClick={handleNext}>
              Next
            </Button>
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default ScheduleAppointment; 