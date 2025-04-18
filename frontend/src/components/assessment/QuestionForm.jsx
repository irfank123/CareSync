import React, { useState } from 'react';
import {
  Box,
  Typography,
  TextField,
  Button,
  Radio,
  RadioGroup,
  FormControlLabel,
  FormControl,
  FormLabel,
  CircularProgress,
  Stepper,
  Step,
  StepLabel,
  Paper,
  Divider,
  Alert
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * Component for displaying and answering assessment questions
 */
const QuestionForm = ({ questions, onSubmit, loading }) => {
  const [currentStep, setCurrentStep] = useState(0);
  const [responses, setResponses] = useState({});
  const [errors, setErrors] = useState({});

  // If no questions, display message
  if (!questions || questions.length === 0) {
    return (
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No questions available. Please enter your symptoms first.
        </Typography>
      </Box>
    );
  }

  const currentQuestion = questions[currentStep];

  /**
   * Handle response change
   * @param {string} questionId - ID of the question
   * @param {string} value - Answer value
   */
  const handleResponseChange = (questionId, value) => {
    setResponses({
      ...responses,
      [questionId]: value
    });

    // Clear error for this question
    if (errors[questionId]) {
      const newErrors = { ...errors };
      delete newErrors[questionId];
      setErrors(newErrors);
    }
  };

  /**
   * Move to the next question
   */
  const handleNext = () => {
    const questionId = currentQuestion.id;
    
    // Validate response
    if (!responses[questionId]) {
      setErrors({
        ...errors,
        [questionId]: 'Please provide an answer'
      });
      return;
    }

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Submit all responses
      const formattedResponses = Object.keys(responses).map(questionId => {
        const question = questions.find(q => q.id === questionId);
        return {
          questionId,
          question: question.text,
          answer: responses[questionId],
          answerType: question.answerType || 'text'
        };
      });

      onSubmit(formattedResponses);
    }
  };

  /**
   * Move to the previous question
   */
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Render the appropriate input based on question type
   */
  const renderQuestionInput = () => {
    const questionId = currentQuestion.id;
    const questionType = currentQuestion.type || 'text';
    const required = true;

    switch (questionType) {
      case 'boolean':
        return (
          <FormControl component="fieldset" required={required} error={!!errors[questionId]}>
            <FormLabel component="legend">Your Answer</FormLabel>
            <RadioGroup
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
            >
              <FormControlLabel value="yes" control={<Radio />} label="Yes" />
              <FormControlLabel value="no" control={<Radio />} label="No" />
              <FormControlLabel value="uncertain" control={<Radio />} label="Uncertain" />
            </RadioGroup>
            {errors[questionId] && (
              <Typography color="error" variant="caption">
                {errors[questionId]}
              </Typography>
            )}
          </FormControl>
        );
      
      case 'scale':
        const options = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
        return (
          <FormControl component="fieldset" required={required} error={!!errors[questionId]}>
            <FormLabel component="legend">Rate from 1-10</FormLabel>
            <RadioGroup
              row
              value={responses[questionId] || ''}
              onChange={(e) => handleResponseChange(questionId, e.target.value)}
            >
              {options.map(option => (
                <FormControlLabel 
                  key={option} 
                  value={option.toString()} 
                  control={<Radio />} 
                  label={option} 
                />
              ))}
            </RadioGroup>
            {errors[questionId] && (
              <Typography color="error" variant="caption">
                {errors[questionId]}
              </Typography>
            )}
          </FormControl>
        );
      
      case 'text':
      default:
        return (
          <TextField
            fullWidth
            multiline
            rows={3}
            label="Your Answer"
            variant="outlined"
            value={responses[questionId] || ''}
            onChange={(e) => handleResponseChange(questionId, e.target.value)}
            required={required}
            error={!!errors[questionId]}
            helperText={errors[questionId]}
            sx={{ mt: 2 }}
          />
        );
    }
  };

  return (
    <Box sx={{ width: '100%', mt: 4 }}>
      <Stepper activeStep={currentStep} alternativeLabel sx={{ mb: 4 }}>
        {questions.map((question, index) => (
          <Step key={index}>
            <StepLabel>Question {index + 1}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
        <Typography variant="h6" gutterBottom>
          {currentQuestion.text}
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {renderQuestionInput()}
        
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={currentStep === 0 || loading}
            startIcon={<ArrowBackIcon />}
          >
            Back
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={loading}
            endIcon={currentStep === questions.length - 1 ? null : <ArrowForwardIcon />}
          >
            {loading ? (
              <CircularProgress size={24} color="inherit" />
            ) : currentStep === questions.length - 1 ? (
              'Submit'
            ) : (
              'Next'
            )}
          </Button>
        </Box>
      </Paper>

      <Box sx={{ mt: 2, mb: 4 }}>
        <Alert severity="info">
          Answer all questions honestly for the most accurate assessment. Your responses help the AI provide better recommendations for your healthcare provider.
        </Alert>
      </Box>
    </Box>
  );
};

export default QuestionForm; 