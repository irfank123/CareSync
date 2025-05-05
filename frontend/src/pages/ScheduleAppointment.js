import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  TextField,
  Alert,
  CircularProgress,
  LinearProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogContentText,
  DialogActions,
  Snackbar
} from '@mui/material';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { LocalizationProvider, DatePicker } from '@mui/x-date-pickers';
import { format } from 'date-fns';
import { API_BASE_URL } from '../config';
import { extractObjectId } from '../utils/objectIdHelper';
import QuestionForm from '../components/assessment/QuestionForm';
import { assessmentService } from '../services/api'; // Import assessment service

const steps = [
  'Select Appointment Type',
  'Choose Doctor',
  'Select Date & Time',
  'Reason for Visit',
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
    additionalNotes: '',
  });
  const [error, setError] = useState('');
  const [patientId, setPatientId] = useState(null); // Add state for patientId

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

  // Fetch patient ID when component mounts
  useEffect(() => {
    const fetchPatientId = async () => {
      try {
        const patientResponse = await fetch(`${API_BASE_URL}/patients/me`, {
          headers: getAuthHeaders(),
        });
        if (!patientResponse.ok) {
          throw new Error('Failed to retrieve patient information for assessment');
        }
        const patientData = await patientResponse.json();
        const extractedId = extractObjectId(patientData.data);
        if (!extractedId) {
           throw new Error('Failed to extract valid patient ID for assessment');
        }
        console.log('[ScheduleAppointment] Fetched patientId:', extractedId);
        setPatientId(extractedId);
      } catch (err) {
        console.error('Error fetching patient ID:', err);
        setError('Could not load necessary patient information. Please refresh.');
      }
    };
    
    if (user) { // Only fetch if user is logged in
      fetchPatientId();
    }
  }, [user]);

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
        // Optional: Add validation for the new 'Reason for Visit' step if needed
        // if (!assessment.symptoms && !assessment.additionalNotes) {
        //   setError('Please provide a reason or notes');
        //   return false;
        // }
        break;
      case 4:
        if (!assessment.symptoms) {
          setError('Please describe your symptoms');
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };

  // Basic handler for symptom/notes input changes
  const handleAssessmentInputChange = (event) => {
    const { name, value } = event.target;
    setAssessment(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // First, get patient ID for current user
      const patientResponse = await fetch(`${API_BASE_URL}/patients/me`, {
        headers: getAuthHeaders(),
      });
      
      if (!patientResponse.ok) {
        throw new Error('Failed to retrieve patient information');
      }
      
      const patientData = await patientResponse.json();
      console.log('Patient data retrieved:', patientData);
      
      // Extract patientId from the response data
      const patientId = extractObjectId(patientData.data);
      
      // It's okay if patientId is null here, it's fetched separately
      // if (!patientId) {
      //   throw new Error('Failed to extract valid patient ID');
      // }
      console.log('Using patientId:', patientId);
      
      // Extract the required IDs (accounting for different object formats)
      let doctorId = selectedDoctor?.rawId || (typeof selectedDoctor?._id === 'string' ? selectedDoctor._id : null);
      let timeSlotId = selectedTimeSlot?._id || null;
      
      // Convert to string if required
      if (doctorId && typeof doctorId === 'object') {
        doctorId = extractObjectId(doctorId);
      }
      
      if (timeSlotId && typeof timeSlotId === 'object') {
        timeSlotId = extractObjectId(timeSlotId);
      }
      
      // Construct timeSlotId from date and time if it wasn't properly extracted
      if (!timeSlotId && selectedTimeSlot) {
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

      // Remove assessment-specific data preparation
      
      const appointmentData = {
        patientId: patientId, // Use the fetched patientId state
        doctorId: doctorId,
        timeSlotId: timeSlotId,
        date: format(selectedDate, 'yyyy-MM-dd'),
        startTime: selectedTimeSlot.startTime,
        endTime: selectedTimeSlot.endTime,
        type: appointmentType,
        status: 'scheduled', // Default status
        reasonForVisit: assessment.symptoms, // Use primary symptom as reason
        additionalNotes: assessment.additionalNotes,
        isVirtual: appointmentType === 'virtual',
        // Remove assessment object and preliminaryAssessmentId
      };
      
      console.log('Final appointment data to submit:', appointmentData);
      
      // Make API call to create appointment
      const appointmentResponse = await fetch(`${API_BASE_URL}/appointments`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(appointmentData),
      });

      const appointmentResult = await appointmentResponse.json();
      console.log('Appointment creation response:', appointmentResult);

      if (!appointmentResponse.ok || !appointmentResult.success) {
        throw new Error(appointmentResult.message || 'Failed to schedule appointment');
      }
      
      // Extract the actual ID string from the returned data object
      const newAppointmentId = appointmentResult.data?._id;
      if (!newAppointmentId) {
          console.error('Failed to extract new appointment ID from response:', appointmentResult.data);
          setError('Appointment booked, but failed to get ID for assessment step.');
      }
      
      // Navigate to the assessment page with the new appointment ID
      // We also pass patientId which should be available in state
      console.log(`Navigating to assessment for appointment ${newAppointmentId}, patient ${patientId}`);
      navigate(`/assessment/new?appointmentId=${newAppointmentId}&patientId=${patientId}`);

    } catch (err) {
      console.error('Error submitting appointment:', err);
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
            <Typography variant="h6" gutterBottom>Reason for Visit (Optional)</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a brief description of your symptoms or the reason for your visit. You can add more detail in the assessment step after booking.
            </Typography>
            
            <TextField
              fullWidth
              label="Primary Symptoms / Reason for Visit"
              name="symptoms"
              value={assessment.symptoms}
              onChange={handleAssessmentInputChange}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="Additional Notes (Optional)"
              name="additionalNotes"
              value={assessment.additionalNotes}
              onChange={handleAssessmentInputChange}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />
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
                    <strong>Primary Symptoms:</strong> {assessment.symptoms || 'Not specified'}
                  </Typography>
                </Grid>
                <Grid item xs={12}> 
                  <Typography>
                    <strong>Additional Notes:</strong> {assessment.additionalNotes || 'None'}
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
            activeStep < steps.length - 1 && (
              <Button variant="contained" onClick={handleNext}>
                Next
              </Button>
            )
          )}
        </Box>
      </Paper>
    </Container>
  );
};

export default ScheduleAppointment; 