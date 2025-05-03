import React, { useState } from 'react';
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
const steps = ['Report Symptoms', 'Answer Questions', 'Assessment Submitted'];

/**
 * Main assessment page component for the AI-driven workflow
 */
const Assessment = () => {
  const { appointmentId } = useParams(); // We primarily need appointmentId
  const navigate = useNavigate();

  // Component state
  const [activeStep, setActiveStep] = useState(0);
  const [symptoms, setSymptoms] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [assessmentId, setAssessmentId] = useState(null); // Store ID after starting
  const [completedAssessment, setCompletedAssessment] = useState(null); // Store final data
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // No useEffect needed to load existing assessment in this flow

  /**
   * Handle next step button click (from SymptomInput)
   */
  const handleStartAssessment = async () => {
    setError('');
    if (symptoms.length === 0) {
      setError('Please enter at least one symptom before continuing.');
      return;
    }

    try {
      setLoading(true);
      // Call the new startAssessment service method
      const response = await assessmentService.startAssessment(appointmentId, symptoms);
      
      // Check if response and data exist and contain expected fields
      if (response && response.data && response.data.data) {
        const { assessmentId: newAssessmentId, questions: generatedQuestions } = response.data.data;
        
        if (!newAssessmentId || !Array.isArray(generatedQuestions)) {
           console.error('Invalid data structure from startAssessment:', response.data.data);
           throw new Error('Received invalid data after starting assessment.');
        }

        setAssessmentId(newAssessmentId);
        setQuestions(generatedQuestions);
        setActiveStep(1); // Move to question step
      } else {
          console.error('Invalid response structure from startAssessment:', response);
          throw new Error('Received invalid response structure after starting assessment.');
      }

    } catch (err) {
      console.error('Error starting assessment:', err);
      const errorMsg = err.response?.data?.message || err.message || 'Failed to start assessment. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Handle back button click
   */
  const handleBack = () => {
    // Only allow back from Question step to Symptom step
    if (activeStep === 1) {
       setActiveStep((prevStep) => prevStep - 1);
       setError(''); // Clear errors when going back
    }
  };

  /**
   * Handle form responses submission from QuestionForm
   * @param {Array} answers - Array of { questionId: string, answer: any }
   */
  const handleQuestionSubmit = async (answers) => {
    if (!assessmentId) {
      setError('Assessment ID is missing. Cannot submit answers.');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      
      // Call the new submitAnswers service method
      const response = await assessmentService.submitAnswers(assessmentId, answers);

      if (response && response.data && response.data.data) {
        setCompletedAssessment(response.data.data); // Store the final assessment data
        setActiveStep(2); // Move to final step
      } else {
         console.error('Invalid response structure from submitAnswers:', response);
         throw new Error('Received invalid response structure after submitting answers.');
      }

    } catch (err) {
      console.error('Error submitting answers:', err);
       const errorMsg = err.response?.data?.message || err.message || 'Failed to submit your answers. Please try again.';
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  // Skip assessment logic might need adjustment based on UX requirements
  // For now, it could navigate back or to the appointment details.
  const handleSkip = () => {
    console.log("Assessment skipped by user.");
    // Optionally call skipAssessment service endpoint if backend logic requires it
    // await assessmentService.skipAssessment(assessmentId, 'User skipped', req.user?._id);
    
    // Ensure appointmentId is a string before navigating
    const safeAppointmentId = typeof appointmentId === 'object' && appointmentId !== null 
      ? (appointmentId.toString ? appointmentId.toString() : String(appointmentId)) 
      : String(appointmentId);
      
    navigate(`/appointments/${safeAppointmentId}`); // Navigate to appointment details
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
            // We don't need onSubmit here, use the main Next button
          />
        );
      case 1:
        return (
          <QuestionForm 
            questions={questions} 
            onSubmit={handleQuestionSubmit} 
            onSkip={handleSkip} // Add skip handler
            isLoading={loading} // Pass loading state
          />
        );
      case 2:
        return (
           <Box sx={{ textAlign: 'center', mt: 4 }}>
              <Typography variant="h5" gutterBottom>Assessment Submitted!</Typography>
              <Typography sx={{ mb: 2 }}>
                Thank you for completing the preliminary assessment. Your doctor will review this information.
              </Typography>
              {/* Optionally show a brief summary or the report here */} 
              {/* {completedAssessment && <AssessmentReport assessment={completedAssessment} />} */}
              <Button 
                  variant="contained" 
                  onClick={() => {
                    // Ensure appointmentId is a string before navigating
                    const safeAppointmentId = typeof appointmentId === 'object' && appointmentId !== null 
                      ? (appointmentId.toString ? appointmentId.toString() : String(appointmentId)) 
                      : String(appointmentId);
                      
                    navigate(`/appointments/${safeAppointmentId}`); // Navigate back to appointment details
                  }}
              >
                  View Appointment Details
              </Button>
            </Box>
        );
      default:
        return <Typography>Unknown step</Typography>;
    }
  };

  return (
    <Container maxWidth="md" sx={{ mt: 4, mb: 4 }}>
      <AppBar position="static" color="transparent" elevation={0} sx={{ mb: 2 }}>
        <Toolbar>
          <IconButton edge="start" color="inherit" onClick={() => navigate(-1)} aria-label="back">
            <ArrowBackIcon />
          </IconButton>
          <Typography variant="h6" component="div" sx={{ flexGrow: 1 }}>
            Preliminary Assessment
          </Typography>
        </Toolbar>
      </AppBar>

      <Paper sx={{ p: { xs: 2, md: 3 } }}>
        <Typography variant="h4" gutterBottom align="center">
          {steps[activeStep]}
        </Typography>

        <Stepper activeStep={activeStep} alternativeLabel sx={{ mb: 4 }}>
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

        {loading && activeStep < 2 && (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 3 }}>
            <CircularProgress />
          </Box>
        )}

        {!loading && renderStepContent()}

        {/* Navigation Buttons - Adjusted Logic */}
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', mt: 4 }}>
          <Button
            color="inherit"
            disabled={activeStep === 0 || activeStep === 2 || loading} // Disable back on first/last step or loading
            onClick={handleBack}
            sx={{ mr: { sm: 1 }, mb: { xs: 1, sm: 0 } }}
          >
            Back
          </Button>
          
          {/* Show Skip button only on Question step */} 
          {activeStep === 1 && (
              <Button 
                  onClick={handleSkip}
                  disabled={loading}
                  color="secondary"
                  sx={{ mr: { sm: 1 }, mb: { xs: 1, sm: 0 } }}
              >
                Skip Assessment
              </Button>
          )}

          {/* Show Next button only on Symptom step */} 
          {activeStep === 0 && (
            <Button
              variant="contained"
              onClick={handleStartAssessment}
              disabled={loading || symptoms.length === 0}
            >
              Next
            </Button>
          )}
          
          {/* Submit button is within QuestionForm for Step 1 */} 
          {/* Completion step has its own button */} 
        </Box>
      </Paper>
    </Container>
  );
};

export default Assessment; 