import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Container,
  Typography,
  Box,
  Stepper,
  Step,
  StepLabel,
  Button,
  Paper,
  CircularProgress,
  Alert,
  Divider,
  AppBar,
  Toolbar,
  IconButton
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import assessmentService from '../services/assessmentService';
import SymptomInput from '../components/assessment/SymptomInput';
import QuestionForm from '../components/assessment/QuestionForm';
import AssessmentReport from '../components/assessment/AssessmentReport';

// Steps in the assessment process
const steps = ['Report Symptoms', 'Answer Questions', 'Review Assessment'];

/**
 * Main assessment page component
 */
const Assessment = () => {
  // Get patient ID and appointment ID from URL params
  const { patientId, appointmentId } = useParams();
  const navigate = useNavigate();

  // Component state
  const [activeStep, setActiveStep] = useState(0);
  const [symptoms, setSymptoms] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);

  // Load existing assessment for this appointment if it exists
  useEffect(() => {
    if (appointmentId) {
      const fetchAssessment = async () => {
        try {
          setLoading(true);
          setError('');
          const response = await assessmentService.getAssessmentByAppointment(appointmentId);
          
          if (response.data) {
            setAssessment(response.data);
            
            // If assessment is already in progress or completed, set symptoms
            if (response.data.symptoms && response.data.symptoms.length > 0) {
              setSymptoms(response.data.symptoms);
              
              // If assessment has responses, move to appropriate step
              if (response.data.status === 'completed') {
                setActiveStep(2); // Move to final step
              } else if (response.data.responses && response.data.responses.length > 0) {
                setActiveStep(1); // Move to questions step
                // Also fetch questions
                const questionsResponse = await assessmentService.getQuestions(patientId, response.data._id);
                setQuestions(questionsResponse.data);
              }
            }
          }
        } catch (error) {
          console.error('Error fetching assessment:', error);
          // Don't show error if assessment just doesn't exist yet
          if (error.response) {
            if (error.response.status === 404) {
              // Assessment not found is normal for a new assessment
              setNotFound(true);
            } else if (error.response.status === 400 && error.response.data?.message === 'Invalid appointment ID') {
              setError('The appointment ID is invalid. Please go back and try again or contact support.');
            } else {
              setError('Failed to load assessment data. Please try again.');
            }
          } else {
            setError('Network error. Please check your connection and try again.');
          }
        } finally {
          setLoading(false);
        }
      };

      fetchAssessment();
    }
  }, [appointmentId, patientId]);

  /**
   * Handle next step button click
   */
  const handleNext = async () => {
    setError('');
    
    if (activeStep === 0) {
      // Validate symptoms
      if (symptoms.length === 0) {
        setError('Please enter at least one symptom before continuing.');
        return;
      }
      
      try {
        setLoading(true);
        
        // Start or update assessment
        let assessmentData;
        
        if (assessment && assessment._id) {
          // Update existing assessment (this is a simplified approach)
          // In a real app, you might need a specific endpoint to update symptoms
          assessmentData = assessment;
        } else {
          // Start new assessment
          try {
            const response = await assessmentService.startAssessment(patientId, appointmentId, symptoms);
            assessmentData = response.data;
            setAssessment(assessmentData);
          } catch (error) {
            console.error('Error starting assessment:', error);
            if (error.response) {
              if (error.response.status === 400 && error.response.data?.message === 'Invalid appointment ID') {
                setError('The appointment ID is invalid. This may be a system error - please contact support.');
                return;
              } else {
                setError(error.response.data?.message || 'Failed to start assessment');
                return;
              }
            } else {
              setError('Network error. Please check your connection and try again.');
              return;
            }
          }
        }
        
        // Fetch questions based on symptoms
        try {
          const questionsResponse = await assessmentService.getQuestions(patientId, assessmentData._id);
          setQuestions(questionsResponse.data);
          
          // Move to next step
          setActiveStep(1);
        } catch (error) {
          console.error('Error fetching questions:', error);
          setError('Failed to load questions. Please try again.');
        }
      } catch (error) {
        console.error('General error:', error);
        setError('An unexpected error occurred. Please try again.');
      } finally {
        setLoading(false);
      }
    } else if (activeStep === 1) {
      // Next action handled by QuestionForm component
    } else {
      // Final step - no next action
    }
  };

  /**
   * Handle back button click
   */
  const handleBack = () => {
    setActiveStep((prevStep) => prevStep - 1);
  };

  /**
   * Handle form responses submission
   * @param {Array} responses - Array of responses from QuestionForm
   */
  const handleResponsesSubmit = async (responses) => {
    try {
      setLoading(true);
      setError('');
      
      // Save responses
      await assessmentService.saveResponses(patientId, assessment._id, responses);
      
      // Complete the assessment to generate report
      const completeResponse = await assessmentService.completeAssessment(patientId, assessment._id);
      
      // Update assessment with completed data
      setAssessment(completeResponse.data);
      
      // Move to next step
      setActiveStep(2);
    } catch (error) {
      console.error('Error submitting responses:', error);
      
      if (error.response) {
        setError(error.response.data?.message || 'Failed to submit your responses. Please try again.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle skip assessment
   */
  const handleSkipAssessment = async () => {
    if (!assessment || !assessment._id) {
      navigate(-1); // Just go back if no assessment started
      return;
    }
    
    try {
      setLoading(true);
      await assessmentService.skipAssessment(
        patientId, 
        assessment._id, 
        'Patient chose to skip the assessment'
      );
      navigate(`/appointments/${appointmentId}`);
    } catch (error) {
      console.error('Error skipping assessment:', error);
      
      if (error.response) {
        setError(error.response.data?.message || 'Failed to skip assessment. Please try again.');
      } else {
        setError('Network error. Please check your connection and try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  /**
   * Render content based on current step
   */
  const renderStepContent = () => {
    switch (activeStep) {
      case 0:
        return (
          <SymptomInput 
            symptoms={symptoms} 
            setSymptoms={setSymptoms} 
          />
        );
      case 1:
        return (
          <QuestionForm 
            questions={questions} 
            onSubmit={handleResponsesSubmit} 
            loading={loading}
          />
        );
      case 2:
        return (
          <AssessmentReport assessment={assessment} />
        );
      default:
        return 'Unknown step';
    }
  };

  return (
    <Box sx={{ flexGrow: 1 }}>
      <AppBar position="static" color="default" elevation={0}>
        <Toolbar>
          <IconButton
            edge="start"
            color="inherit"
            onClick={() => navigate(-1)}
            aria-label="back"
          >
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" sx={{ flexGrow: 1 }}>
            Pre-Appointment Assessment
          </Typography>
          {activeStep < 2 && (
            <Button color="inherit" onClick={handleSkipAssessment}>
              Skip Assessment
            </Button>
          )}
        </Toolbar>
      </AppBar>

      <Container maxWidth="md" sx={{ mt: 4, mb: 8 }}>
        {error && error.includes('invalid') ? (
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" gutterBottom align="center" color="error">
              Error
            </Typography>
            <Alert severity="error" sx={{ mb: 3 }}>
              {error}
            </Alert>
            <Box sx={{ display: 'flex', justifyContent: 'center', mt: 3 }}>
              <Button
                variant="contained"
                color="primary"
                onClick={() => navigate(-1)}
              >
                Return to Previous Page
              </Button>
            </Box>
          </Paper>
        ) : (
          <Paper elevation={3} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h5" gutterBottom align="center">
              AI-Powered Health Assessment
            </Typography>
            <Typography variant="body1" align="center" color="text.secondary" sx={{ mb: 3 }}>
              This assessment helps your doctor understand your symptoms before your appointment.
            </Typography>
            
            <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
              {steps.map((label) => (
                <Step key={label}>
                  <StepLabel>{label}</StepLabel>
                </Step>
              ))}
            </Stepper>
            
            {error && (
              <Alert severity="error" sx={{ mb: 3 }}>
                {error}
              </Alert>
            )}
            
            {loading && activeStep !== 1 ? (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4, mb: 4 }}>
                <CircularProgress />
              </Box>
            ) : (
              renderStepContent()
            )}
            
            {activeStep === 0 && (
              <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 3 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={handleNext}
                  disabled={loading || symptoms.length === 0}
                >
                  Next
                </Button>
              </Box>
            )}
            
            {activeStep === 2 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Button
                  variant="contained"
                  color="primary"
                  onClick={() => navigate(`/appointments/${appointmentId}`)}
                >
                  Return to Appointment
                </Button>
              </Box>
            )}
          </Paper>
        )}
        
        {activeStep === 0 && !error.includes('invalid') && (
          <Alert severity="info">
            Start by entering the symptoms you're experiencing. Be as specific as possible to help our AI generate relevant questions.
          </Alert>
        )}
      </Container>
    </Box>
  );
};

export default Assessment; 