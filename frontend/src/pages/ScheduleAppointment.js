import React, { useState, useEffect, useRef } from 'react';
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
import SymptomInput from '../components/assessment/SymptomInput';
import QuestionForm from '../components/assessment/QuestionForm';

const steps = [
  'Select Appointment Type',
  'Choose Doctor',
  'Select Date & Time',
  'Preliminary Symptoms',
  'AI Assessment Questionnaire',
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
    severity: 'mild',
    additionalNotes: '',
  });
  const [error, setError] = useState('');
  
  // New state for AI assessment
  const [assessmentId, setAssessmentId] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState([]);
  const [assessmentReport, setAssessmentReport] = useState(null);
  
  // Timer state
  const [assessmentStartTime, setAssessmentStartTime] = useState(null);
  const [timeRemaining, setTimeRemaining] = useState(10 * 60); // 10 minutes in seconds
  const [showTimeWarning, setShowTimeWarning] = useState(false);
  const [showTimeExpired, setShowTimeExpired] = useState(false);
  const [showFinalPrompt, setShowFinalPrompt] = useState(false);
  const [preferToDiscussWithDoctor, setPreferToDiscussWithDoctor] = useState(false);
  const timerRef = useRef(null);

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

  // Start timer when entering the AI assessment step
  useEffect(() => {
    if (activeStep === 4) { // AI Assessment step
      // Initialize timer on step entry
      if (!assessmentStartTime) {
        setAssessmentStartTime(Date.now());
      }
      
      // Clear any existing timer
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      
      // Set up the timer to update every second
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - (assessmentStartTime || Date.now())) / 1000);
        const remaining = Math.max(0, 10 * 60 - elapsed); // 10 minutes in seconds
        
        setTimeRemaining(remaining);
        console.log('Timer update: ', remaining);
        
        // Warning at 9:45 (15 seconds remaining)
        if (remaining <= 15 && remaining > 0 && !showTimeWarning) {
          setShowTimeWarning(true);
        }
        
        // First timeout at 10:00 (0 seconds remaining)
        if (remaining === 0 && !showTimeExpired) {
          setShowTimeExpired(true);
          // Don't clear the interval yet, we still need to track for the 10:30 mark
        }
        
        // Final prompt at 10:30 (30 seconds after initial timeout)
        if (elapsed >= 10 * 60 + 30 && !showFinalPrompt) {
          setShowFinalPrompt(true);
          clearInterval(timerRef.current);
          // Auto-save assessment progress here
          handleAutoSaveAssessment();
        }
      }, 1000);
    } else {
      // Clear timer when leaving the AI assessment step
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
    
    // Cleanup on component unmount
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [activeStep, assessmentStartTime]); // Don't include state vars that change every tick

  // Format timer for display (MM:SS)
  const formatTime = (timeInSeconds) => {
    const minutes = Math.floor(timeInSeconds / 60);
    const seconds = timeInSeconds % 60;
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };
  
  // Handle auto-save of assessment when timer expires
  const handleAutoSaveAssessment = () => {
    // Logic to save current assessment progress
    console.log('Auto-saving assessment progress...');
    // If there are partial answers, save them
    if (answers.length > 0) {
      // We would typically call an API here
      console.log('Saving partial answers:', answers);
    }
  };
  
  // Handle "Prefer to discuss with doctor" option
  const handlePreferToDiscuss = () => {
    setPreferToDiscussWithDoctor(true);
    setShowTimeExpired(false);
    setShowFinalPrompt(false);
    
    // Skip to confirmation step
    setActiveStep(5); // Assuming 5 is the Confirm Details step
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
        if (!assessment.symptoms) {
          setError('Please describe your symptoms');
          return false;
        }
        break;
      // AI Questionnaire step validation
      case 4:
        // We can validate this step differently - either all questions answered or 'preferToDiscussWithDoctor' selected
        if (!preferToDiscussWithDoctor && answers.length < questions.length) {
          setError('Please answer all questions or select "Prefer to discuss with doctor"');
          return false;
        }
        break;
      default:
        break;
    }
    return true;
  };

  // Define the handler for assessment input changes
  const handleAssessmentChange = (event) => {
    const { name, value } = event.target;
    setAssessment(prev => ({ ...prev, [name]: value }));
  };

  // Start the AI assessment after entering basic symptoms
  const handleStartAIAssessment = async () => {
    if (!assessment.symptoms) {
      setError('Please enter at least one symptom before continuing.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Reset timer state when starting a new assessment
      setAssessmentStartTime(null);
      setTimeRemaining(10 * 60);
      setShowTimeWarning(false);
      setShowTimeExpired(false);
      setShowFinalPrompt(false);
      
      // Make API call to start assessment and get questions
      // This would be similar to what's in Assessment.js
      // For now, simulate with dummy data
      setTimeout(() => {
        // More comprehensive medical assessment questions that adapt to the symptoms
        const symptomText = assessment.symptoms.toLowerCase();
        
        // Build a more comprehensive set of questions based on symptoms
        const generalQuestions = [
          { 
            questionId: 'q1', 
            question: 'When did your symptoms first begin?', 
            answerType: 'text',
            required: true 
          },
          { 
            questionId: 'q2', 
            question: 'Have you taken any medication for these symptoms? If yes, please specify.',
            answerType: 'text',
            required: true
          },
          { 
            questionId: 'q3', 
            question: 'Do you have any known allergies or chronic medical conditions?',
            answerType: 'text',
            required: true
          },
          { 
            questionId: 'q4', 
            question: 'On a scale of 1-10, how would you rate your overall discomfort?',
            answerType: 'scale',
            required: true
          },
          { 
            questionId: 'q5', 
            question: 'Have you experienced similar symptoms in the past?',
            answerType: 'boolean',
            required: true
          }
        ];
        
        // Add symptom-specific questions based on keywords
        const specificQuestions = [];
        
        if (symptomText.includes('headache') || symptomText.includes('head pain') || 
            symptomText.includes('migraine')) {
          specificQuestions.push(
            { 
              questionId: 'head1', 
              question: 'Is your headache on one side or both sides of your head?',
              answerType: 'text',
              required: true
            },
            { 
              questionId: 'head2', 
              question: 'Does light or sound sensitivity accompany your headache?',
              answerType: 'boolean',
              required: true
            },
            { 
              questionId: 'head3', 
              question: 'Have you experienced nausea or vomiting with your headache?',
              answerType: 'boolean',
              required: true
            }
          );
        }
        
        if (symptomText.includes('fever') || symptomText.includes('temperature')) {
          specificQuestions.push(
            { 
              questionId: 'fever1', 
              question: 'What is your current temperature, if known?',
              answerType: 'text',
              required: false
            },
            { 
              questionId: 'fever2', 
              question: 'Are you experiencing chills or sweating?',
              answerType: 'boolean',
              required: true
            },
            { 
              questionId: 'fever3', 
              question: 'Have you been in contact with anyone who has been sick recently?',
              answerType: 'boolean',
              required: true
            }
          );
        }
        
        if (symptomText.includes('pain') || symptomText.includes('ache')) {
          specificQuestions.push(
            { 
              questionId: 'pain1', 
              question: 'Does anything make the pain better or worse?',
              answerType: 'text',
              required: true
            },
            { 
              questionId: 'pain2', 
              question: 'Is the pain constant or does it come and go?',
              answerType: 'text',
              required: true
            },
            { 
              questionId: 'pain3', 
              question: 'On a scale of 1-10, how severe is your pain?',
              answerType: 'scale',
              required: true
            }
          );
        }
        
        if (symptomText.includes('cough') || symptomText.includes('cold') || 
            symptomText.includes('congestion') || symptomText.includes('sore throat')) {
          specificQuestions.push(
            { 
              questionId: 'resp1', 
              question: 'Are you producing any phlegm or mucus? If yes, what color?',
              answerType: 'text',
              required: true
            },
            { 
              questionId: 'resp2', 
              question: 'Are you experiencing shortness of breath?',
              answerType: 'boolean',
              required: true
            },
            { 
              questionId: 'resp3', 
              question: 'Have you had a COVID-19 test recently? If yes, what was the result?',
              answerType: 'text',
              required: true
            }
          );
        }
        
        if (symptomText.includes('stomach') || symptomText.includes('nausea') || 
            symptomText.includes('vomit') || symptomText.includes('diarrhea')) {
          specificQuestions.push(
            { 
              questionId: 'gi1', 
              question: 'Have you experienced any changes in your appetite?',
              answerType: 'boolean',
              required: true
            },
            { 
              questionId: 'gi2', 
              question: 'When was the last time you had a bowel movement? Was it normal?',
              answerType: 'text',
              required: true
            },
            { 
              questionId: 'gi3', 
              question: 'Have you consumed any unusual foods in the past 48 hours?',
              answerType: 'boolean',
              required: true
            }
          );
        }
        
        // Ensure we have at least 8-10 questions by adding general ones if needed
        const allQuestions = [
          ...generalQuestions,
          ...specificQuestions,
          { 
            questionId: 'final1', 
            question: 'Is there anything else you would like to share with your doctor?',
            answerType: 'text',
            required: false
          }
        ];
        
        console.log('Generated questions based on symptoms:', allQuestions);
        
        setQuestions(allQuestions);
        setAssessmentId('dummy-assessment-id');
        setActiveStep(4); // Move to AI questionnaire step
        setLoading(false);
      }, 1500);
      
      // In actual implementation:
      // const response = await assessmentService.startAssessment(patientId, appointmentId, symptoms);
      // setQuestions(response.data.data.questions);
      // setAssessmentId(response.data.data.assessmentId);
      // setActiveStep(4);
      
    } catch (err) {
      console.error('Error starting assessment:', err);
      setError('Failed to start assessment. Please try again.');
      setLoading(false);
    }
  };
  
  // Handle answers from the QuestionForm component
  const handleQuestionSubmit = async (submittedAnswers) => {
    try {
      setLoading(true);
      setError('');
      
      console.log('Received answers from QuestionForm:', submittedAnswers);
      
      // Save the answers to state
      setAnswers(submittedAnswers);
      
      // Make API call to submit answers (similar to Assessment.js)
      // For now, simulate with dummy data
      setTimeout(() => {
        setAssessmentReport({
          severity: 'low',
          aiGeneratedReport: 'Based on your symptoms, you may have a common cold.',
          symptoms: [assessment.symptoms],
          responses: submittedAnswers,
        });
        
        setActiveStep(5); // Move to confirmation step
        setLoading(false);
      }, 1500);
      
      // In actual implementation:
      // const response = await assessmentService.submitAnswers(assessmentId, submittedAnswers);
      // setAssessmentReport(response.data.data);
      // setActiveStep(5);
      
    } catch (err) {
      console.error('Error submitting answers:', err);
      setError('Failed to submit your answers. Please try again.');
      setLoading(false);
    }
  };

  /**
   * Prepare assessment with questions and answers for backend submission
   * This ensures all responses have both questionId and question
   */
  const prepareAssessmentData = () => {
    console.log('Preparing assessment data with:', { 
      questions, 
      answers, 
      assessment
    });
    
    const formattedAssessment = {...assessment};
    
    // If we completed the AI assessment questionnaire
    if (questions && questions.length > 0) {
      console.log(`Found ${questions.length} questions to process`);
      
      // Include the questions in the assessment for reference
      formattedAssessment.generatedQuestions = questions;
      
      // Format responses to include both questionId, question text, and answer
      if (answers && answers.length > 0) {
        console.log(`Found ${answers.length} answers to process`);
        
        // If we have an array of answer objects from QuestionForm submission
        formattedAssessment.responses = answers.map(answerObj => {
          return {
            questionId: answerObj.questionId,
            question: questions.find(q => q.questionId === answerObj.questionId)?.question || `Question ${answerObj.questionId}`,
            answer: answerObj.answer
          };
        });
      } else {
        // No answers found in the expected format
        console.log('No answers found in expected format, generating empty responses array');
        formattedAssessment.responses = [];
      }
    } else {
      console.log('No questions found, cannot generate properly formatted responses');
      formattedAssessment.responses = [];
    }
    
    console.log('Formatted assessment:', formattedAssessment);
    return formattedAssessment;
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
      
      if (!patientId) {
        throw new Error('Failed to extract valid patient ID');
      }
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

      const formattedAssessment = prepareAssessmentData();
      
      console.log('Questions before submission:', questions);
      console.log('Answers before submission:', answers);
      
      const appointmentData = {
        patientId: patientId,
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
        // Include the assessment data properly structured for the backend
        assessment: {
          symptoms: assessment.symptoms,
          generatedQuestions: formattedAssessment.generatedQuestions || questions || [],
          responses: formattedAssessment.responses || [],
          severity: mapSeverity(assessment.severity)
        }
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
      
      // Restore previous success navigation (e.g., to dashboard)
      setLoading(false);
      navigate('/dashboard', { state: { message: 'Appointment scheduled successfully!' } });
      
      // Remove redirection to assessment page
      // const newAppointmentId = extractObjectId(appointmentResult.data);
      // if (!newAppointmentId) {
      //     console.error('Failed to extract new appointment ID from response:', appointmentResult.data);
      //     throw new Error('Could not determine the new appointment ID.');
      // }
      // navigate(`/assessment/${newAppointmentId}`); 

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
            <Typography variant="h6" gutterBottom>Tell us about your symptoms</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
              Please provide a brief description of your symptoms. This will help us prepare for your appointment.
            </Typography>
            
            <TextField
              fullWidth
              required
              label="What are your symptoms?"
              name="symptoms"
              value={assessment.symptoms}
              onChange={handleAssessmentChange}
              multiline
              rows={3}
              sx={{ mb: 2 }}
            />
            
            <TextField
              fullWidth
              label="How long have you been experiencing these symptoms?"
              name="duration"
              value={assessment.duration}
              onChange={handleAssessmentChange}
              sx={{ mb: 2 }}
            />
            
            <FormControl component="fieldset" sx={{ mb: 2 }}>
              <FormLabel component="legend">Severity of Symptoms</FormLabel>
              <RadioGroup
                row
                name="severity"
                value={assessment.severity}
                onChange={handleAssessmentChange}
              >
                <FormControlLabel value="mild" control={<Radio />} label="Mild" />
                <FormControlLabel value="moderate" control={<Radio />} label="Moderate" />
                <FormControlLabel value="severe" control={<Radio />} label="Severe" />
              </RadioGroup>
            </FormControl>
            
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 2 }}>
              <Button
                variant="outlined"
                onClick={() => setActiveStep(prevStep => prevStep + 1)}
                color="secondary"
              >
                Skip Assessment
              </Button>
              <Button
                variant="contained"
                onClick={handleStartAIAssessment}
                disabled={loading || !assessment.symptoms}
              >
                {loading ? <CircularProgress size={24} /> : 'Continue to Assessment'}
              </Button>
            </Box>
          </Box>
        );

      case 4:
        return (
          <Box sx={{ mt: 3 }}>
            <Typography variant="h6" gutterBottom>AI Assessment Questionnaire</Typography>
            
            {/* Timer Display */}
            <Box sx={{ mb: 2 }}>
              <Typography variant="subtitle2">
                Time Remaining: {formatTime(timeRemaining)}
              </Typography>
              <LinearProgress 
                variant="determinate" 
                value={(timeRemaining / (10 * 60)) * 100} 
                color={timeRemaining < 60 ? "error" : "primary"}
                sx={{ mt: 1 }}
              />
            </Box>
            
            {loading ? (
              <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', my: 4 }}>
                <CircularProgress />
                <Typography sx={{ mt: 2 }}>Loading questions...</Typography>
              </Box>
            ) : (
              <QuestionForm
                questions={questions}
                onSubmit={handleQuestionSubmit}
                onSkip={handlePreferToDiscuss}
                isLoading={loading}
              />
            )}
            
            {/* Time Warning Dialog (15 seconds remaining) */}
            <Snackbar
              open={showTimeWarning}
              message="15 seconds remaining to complete assessment"
              severity="warning"
              autoHideDuration={5000}
              onClose={() => setShowTimeWarning(false)}
            />
            
            {/* Time Expired Dialog (10:00) */}
            <Dialog
              open={showTimeExpired && !showFinalPrompt}
              onClose={() => setShowTimeExpired(false)}
            >
              <DialogTitle>Time's Up!</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Your assessment time has expired. Would you like to quickly complete the 
                  remaining questions, or would you prefer to discuss your symptoms directly with the doctor?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handlePreferToDiscuss} color="secondary">
                  Prefer to Discuss with Doctor
                </Button>
                <Button onClick={() => setShowTimeExpired(false)} color="primary" autoFocus>
                  Complete Remaining Questions
                </Button>
              </DialogActions>
            </Dialog>
            
            {/* Final Prompt Dialog (10:30) */}
            <Dialog
              open={showFinalPrompt}
              onClose={() => setShowFinalPrompt(false)}
            >
              <DialogTitle>Assessment Auto-Saved</DialogTitle>
              <DialogContent>
                <DialogContentText>
                  Your assessment progress has been auto-saved. Would you like to continue answering the 
                  remaining questions, or would you prefer to discuss your symptoms directly with the doctor?
                </DialogContentText>
              </DialogContent>
              <DialogActions>
                <Button onClick={handlePreferToDiscuss} color="secondary">
                  Prefer to Discuss with Doctor
                </Button>
                <Button onClick={() => setShowFinalPrompt(false)} color="primary" autoFocus>
                  Continue Assessment
                </Button>
              </DialogActions>
            </Dialog>
          </Box>
        );

      case 5:
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
                
                {/* AI Assessment Summary */}
                {!preferToDiscussWithDoctor && assessmentReport && (
                  <Grid item xs={12}>
                    <Typography>
                      <strong>Assessment Completed:</strong> Yes
                    </Typography>
                    <Typography color="text.secondary">
                      {preferToDiscussWithDoctor 
                        ? 'You chose to discuss your symptoms directly with the doctor.'
                        : 'Your assessment has been completed and will be shared with your doctor.'}
                    </Typography>
                  </Grid>
                )}
                
                {preferToDiscussWithDoctor && (
                  <Grid item xs={12}>
                    <Typography>
                      <strong>Assessment Status:</strong> Will discuss with doctor
                    </Typography>
                    <Typography color="text.secondary">
                      You've chosen to discuss your symptoms directly with the doctor.
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
          {activeStep > 0 && activeStep !== 4 && ( // Can't go back from AI questionnaire once started
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
            activeStep !== 3 && activeStep !== 4 && ( // Hide for symptom input and AI questionnaire (they have their own buttons)
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