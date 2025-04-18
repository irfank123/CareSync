import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  CircularProgress,
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { API_BASE_URL } from '../config';
import { extractObjectId } from '../utils/objectIdHelper';

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
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);
  const [appointmentType, setAppointmentType] = useState('');
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState(null);
  const [availableTimeSlots, setAvailableTimeSlots] = useState([]);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [assessment, setAssessment] = useState({
    symptoms: '',
    duration: '',
    severity: '',
    additionalNotes: '',
  });
  const [error, setError] = useState('');

  // Helper function to get doctor name
  const getDoctorName = (doctor) => {
    if (!doctor) return 'Unknown';
    
    if (doctor.firstName || doctor.lastName) {
      return `${doctor.firstName || ''} ${doctor.lastName || ''}`.trim();
    }
    
    if (doctor.doctorUser) {
      return `${doctor.doctorUser.firstName || ''} ${doctor.doctorUser.lastName || ''}`.trim();
    }
    
    if (doctor.user) {
      return `${doctor.user.firstName || ''} ${doctor.user.lastName || ''}`.trim();
    }
    
    return 'Unknown';
  };

  // Get auth token for API requests
  const getAuthHeaders = () => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    };
  };

  // Fetch doctors when component mounts
  useEffect(() => {
    const fetchDoctors = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE_URL}/doctors`, {
          headers: getAuthHeaders(),
        });

        if (!response.ok) {
          throw new Error('Failed to fetch doctors');
        }

        const data = await response.json();
        console.log('Fetched doctors data:', data.data);
        
        // Process doctors to ensure they have name information
        const processedDoctors = data.data.map(doctor => {
          if (doctor.user) {
            // If doctor has a nested user object, add firstName/lastName directly to doctor
            return {
              ...doctor,
              firstName: doctor.user.firstName,
              lastName: doctor.user.lastName
            };
          }
          return doctor;
        });
        
        setDoctors(processedDoctors || []);
      } catch (err) {
        console.error('Error fetching doctors:', err);
        setError('Failed to load doctors. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchDoctors();
  }, []);

  // Fetch available timeslots when doctor and date are selected
  useEffect(() => {
    const fetchTimeSlots = async () => {
      if (!selectedDoctor || !selectedDate) return;

      try {
        setLoading(true);
        const formattedDate = format(selectedDate, 'yyyy-MM-dd');
        
        console.log('Selected doctor:', selectedDoctor);
        
        // Use the rawId we stored during doctor selection
        let doctorId = selectedDoctor.rawId;
        
        // Additional safety check - ensure we have a string
        if (doctorId && typeof doctorId !== 'string') {
          console.warn('Doctor ID is not a string:', doctorId);
          
          // Try to get a valid string ID
          if (selectedDoctor.licenseNumber) {
            doctorId = selectedDoctor.licenseNumber;
            console.log('Using license number as fallback ID:', doctorId);
          } else {
            throw new Error('Could not get a valid string doctor ID');
          }
        }
        
        if (!doctorId) {
          throw new Error('Invalid doctor ID');
        }
        
        console.log('Using doctor ID:', doctorId);
        
        const response = await fetch(
          `${API_BASE_URL}/availability/doctor/${doctorId}/slots/available?startDate=${formattedDate}&endDate=${formattedDate}`,
          {
            headers: getAuthHeaders(),
          }
        );

        if (!response.ok) {
          throw new Error('Failed to fetch available time slots');
        }

        const data = await response.json();
        setAvailableTimeSlots(data.data || []);
      } catch (err) {
        console.error('Error fetching time slots:', err);
        setError('Failed to load available time slots. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (selectedDoctor && selectedDate) {
      fetchTimeSlots();
    }
  }, [selectedDoctor, selectedDate]);

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
      
      // First, get patient ID for current user
      const patientResponse = await fetch(`${API_BASE_URL}/patients/me`, {
        headers: getAuthHeaders(),
      });
      
      if (!patientResponse.ok) {
        throw new Error('Failed to retrieve patient information');
      }
      
      const patientData = await patientResponse.json();
      console.log('Raw patientData.data:', patientData.data);
      console.log('Raw patientData.data._id type:', typeof patientData.data?._id);
      if (patientData.data?._id && typeof patientData.data._id === 'object') {
        console.log('Raw patientData.data._id keys:', Object.keys(patientData.data._id));
        console.log('Raw patientData.data._id JSON:', JSON.stringify(patientData.data._id));
      }

      // Correctly extract patientId from the response data
      const patientId = extractObjectId(patientData.data);
      
      if (!patientId) {
        throw new Error('Failed to extract valid patient ID');
      }
      console.log('Extracted patientId:', patientId);
      
      // Extract ObjectIds using stored rawId
      let doctorId = selectedDoctor.rawId;
      let timeSlotId = selectedTimeSlot.rawId;
      
      // Ensure IDs are strings
      if (doctorId && typeof doctorId !== 'string') {
        console.warn('Doctor ID is not a string:', doctorId);
        if (selectedDoctor.licenseNumber) {
          doctorId = selectedDoctor.licenseNumber;
          console.log('Converting doctor ID to string using license number:', doctorId);
        } else {
          throw new Error('Invalid doctor ID format - not a string');
        }
      }
      
      if (timeSlotId && typeof timeSlotId !== 'string') {
        console.warn('Time slot ID is not a string:', timeSlotId);
        const slotDate = format(new Date(selectedTimeSlot.date), 'yyyy-MM-dd');
        timeSlotId = `${slotDate}-${selectedTimeSlot.startTime}-${selectedTimeSlot.endTime}`;
        console.log('Converting time slot ID to string using date and time:', timeSlotId);
      }
      
      if (!doctorId || !timeSlotId) {
        throw new Error('Invalid doctor or time slot ID');
      }
      
      console.log('Using doctorId:', doctorId);
      console.log('Using timeSlotId:', timeSlotId);
      
      // Prepare appointment data
      const mapSeverity = (frontendSeverity) => {
        switch(frontendSeverity?.toLowerCase()) {
          case 'mild': return 'low';
          case 'moderate': return 'medium';
          case 'severe': return 'high';
          default: return 'low'; // Default to low if unset or unrecognized
        }
      };

      const appointmentData = {
        patientId: patientId,
        doctorId: doctorId,
        timeSlotId: timeSlotId,
        type: appointmentType,
        isVirtual: appointmentType === 'virtual',
        reasonForVisit: assessment.symptoms,
        assessment: {
          symptoms: assessment.symptoms,
          // Map the frontend severity to the backend enum value
          severity: mapSeverity(assessment.severity),
          responses: [
            { question: 'Duration of symptoms', answer: assessment.duration },
            { question: 'Additional notes', answer: assessment.additionalNotes }
          ]
        }
      };
      
      console.log('Submitting appointment:', appointmentData);
      
      // Make API call to create appointment
      const response = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(appointmentData),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('Error response:', errorData);
        throw new Error(errorData.message || 'Failed to schedule appointment');
      }
      
      // Navigate to dashboard with success message
      navigate('/dashboard', {
        state: { message: 'Appointment scheduled successfully!' }
      });
    } catch (err) {
      console.error('Error scheduling appointment:', err);
      setError(`Failed to schedule appointment: ${err.message}`);
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
              <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                <CircularProgress />
              </Box>
            ) : (
              <Grid container spacing={3}>
                {doctors.length === 0 ? (
                  <Grid item xs={12}>
                    <Typography color="text.secondary" align="center">
                      No doctors available at this time.
                    </Typography>
                  </Grid>
                ) : (
                  doctors.map((doctor, index) => (
                    <Grid item xs={12} sm={6} key={index}>
                      <Card
                        sx={{
                          cursor: 'pointer',
                          border: selectedDoctor?._id === doctor._id ? 2 : 0,
                          borderColor: 'primary.main',
                        }}
                        onClick={() => {
                          console.log('Raw doctor object:', doctor);
                          console.log('Raw _id type:', typeof doctor._id);
                          console.log('Raw _id keys:', doctor._id ? Object.keys(doctor._id) : 'No _id');
                          
                          if (doctor._id && typeof doctor._id === 'object') {
                            console.log('_id object contents:', JSON.stringify(doctor._id));
                          }
                          
                          // For doctors, immediately use license number if available
                          let objectId = null;
                          if (doctor._id && doctor._id.buffer) {
                            console.log('Detected Buffer _id, using licenseNumber directly');
                            objectId = doctor.licenseNumber;
                          } else {
                            // Extract the proper MongoDB ObjectId using utility
                            objectId = extractObjectId(doctor);
                          }
                          
                          console.log('Extracted ObjectId:', objectId);
                          
                          // Set the doctor with the proper ID format
                          setSelectedDoctor({
                            ...doctor,
                            rawId: objectId
                          });
                        }}
                      >
                        <CardContent>
                          <Typography variant="h6">
                            Dr. {getDoctorName(doctor)}
                          </Typography>
                          <Typography color="text.secondary">
                            {doctor.specialties && doctor.specialties.join(', ')}
                          </Typography>
                          <Typography variant="body2">
                            Fee: ${doctor.appointmentFee}
                          </Typography>
                          {doctor.acceptingNewPatients ? (
                            <Typography variant="body2" color="success.main">
                              Accepting new patients
                            </Typography>
                          ) : (
                            <Typography variant="body2" color="error.main">
                              Not accepting new patients
                            </Typography>
                          )}
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
                    onChange={(newDate) => {
                      setSelectedDate(newDate);
                      setSelectedTimeSlot(null); // Reset selected time slot when date changes
                    }}
                    renderInput={(params) => <TextField {...params} fullWidth />}
                    minDate={new Date()}
                  />
                </LocalizationProvider>
              </Grid>
              <Grid item xs={12}>
                <Typography variant="subtitle1" gutterBottom>
                  Available Time Slots
                </Typography>
                {loading ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', p: 3 }}>
                    <CircularProgress />
                  </Box>
                ) : availableTimeSlots.length === 0 ? (
                  <Typography color="text.secondary" align="center">
                    No available time slots for this date. Please select another date.
                  </Typography>
                ) : (
                  <Grid container spacing={1}>
                    {availableTimeSlots.map((slot, index) => (
                      <Grid item xs={6} sm={3} key={index}>
                        <Button
                          fullWidth
                          variant={selectedTimeSlot?._id === slot._id ? 'contained' : 'outlined'}
                          onClick={() => {
                            console.log('Raw slot object:', slot);
                            console.log('Raw slot _id type:', typeof slot._id);
                            console.log('Raw slot _id keys:', slot._id ? Object.keys(slot._id) : 'No _id');
                            
                            if (slot._id && typeof slot._id === 'object') {
                              console.log('Slot _id object contents:', JSON.stringify(slot._id));
                            }
                            
                            // For time slots with Buffer IDs, generate a reliable ID
                            let objectId = null;
                            if (slot._id && slot._id.buffer) {
                              // Generate a reliable ID for the time slot
                              const slotDate = format(new Date(slot.date), 'yyyy-MM-dd');
                              objectId = `${slotDate}-${slot.startTime}-${slot.endTime}`;
                              console.log('Detected Buffer _id, using generated time slot ID:', objectId);
                            } else {
                              // Extract the proper MongoDB ObjectId using utility
                              objectId = extractObjectId(slot);
                            }
                            
                            // If we still couldn't get a valid ID, generate a fallback
                            if (!objectId) {
                              // Generate a reliable ID for the time slot
                              const slotDate = format(new Date(slot.date), 'yyyy-MM-dd');
                              objectId = `${slotDate}-${slot.startTime}-${slot.endTime}`;
                              console.log('Using generated fallback slot ID:', objectId);
                            }
                            
                            console.log('Extracted time slot ObjectId:', objectId);
                            
                            // Set the time slot with the proper ID format
                            setSelectedTimeSlot({
                              ...slot,
                              rawId: objectId
                            });
                          }}
                        >
                          {slot.startTime} - {slot.endTime}
                        </Button>
                      </Grid>
                    ))}
                  </Grid>
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
                    <strong>Doctor:</strong> {selectedDoctor && `Dr. ${getDoctorName(selectedDoctor)}`}
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
            <Button 
              variant="contained" 
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? <CircularProgress size={24} /> : 'Schedule Appointment'}
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