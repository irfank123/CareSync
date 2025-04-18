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
  Alert,
  Select,
  MenuItem,
  Slider,
  Switch
} from '@mui/material';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';

/**
 * Component for displaying and answering AI-generated assessment questions.
 * Handles different answer types and navigation between questions.
 */
const QuestionForm = ({ questions, onSubmit, onSkip, isLoading }) => {
  const [currentStep, setCurrentStep] = useState(0);
  // Store answers keyed by questionId
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});

  // Basic check for questions array
  if (!Array.isArray(questions) || questions.length === 0) {
    return (
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No questions to display.
        </Typography>
         {/* Provide a way to skip if questions fail to load */} 
         <Button onClick={onSkip} sx={{ mt: 2 }} color="secondary">Skip Assessment</Button>
      </Box>
    );
  }

  const currentQuestion = questions[currentStep];

  /**
   * Handle answer change for various input types.
   */
  const handleAnswerChange = (questionId, value) => {
    setAnswers(prev => ({
      ...prev,
      [questionId]: value
    }));

    // Clear error for this question upon interaction
    if (errors[questionId]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[questionId];
        return newErrors;
      });
    }
  };

  /**
   * Validate the answer for the current question.
   * For now, just checks if an answer exists.
   */
  const validateCurrentAnswer = () => {
    const questionId = currentQuestion.questionId;
    if (answers[questionId] === undefined || answers[questionId] === null || answers[questionId] === '') {
       setErrors(prev => ({ ...prev, [questionId]: 'Please provide an answer.' }));
      return false;
    }
    return true;
  };

  /**
   * Move to the next question or submit if on the last question.
   */
  const handleNext = () => {
    if (!validateCurrentAnswer()) return;

    if (currentStep < questions.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      // Prepare answers in the format expected by the service
      const formattedAnswers = Object.entries(answers).map(([questionId, answer]) => ({
        questionId,
        answer
      }));
      onSubmit(formattedAnswers); // Call the onSubmit prop passed from parent
    }
  };

  /**
   * Move to the previous question.
   */
  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  /**
   * Render the appropriate input based on question's answerType.
   */
  const renderQuestionInput = () => {
    if (!currentQuestion) return null; // Should not happen if questions array is valid
    
    const { questionId, question, answerType, options } = currentQuestion;
    const currentAnswer = answers[questionId] ?? ''; // Default to empty string or suitable default
    const hasError = !!errors[questionId];

    switch (answerType) {
      case 'boolean':
        return (
          <FormControl component="fieldset" required error={hasError} sx={{ mt: 2 }}>
            <FormLabel component="legend">Select one:</FormLabel>
            <RadioGroup
              row
              value={currentAnswer === true ? 'true' : currentAnswer === false ? 'false' : ''} // Handle boolean state
              onChange={(e) => handleAnswerChange(questionId, e.target.value === 'true')}
            >
              <FormControlLabel value="true" control={<Radio />} label="Yes" />
              <FormControlLabel value="false" control={<Radio />} label="No" />
              {/* Maybe add Uncertain/Don't Know option? */}
            </RadioGroup>
            {hasError && <Typography color="error" variant="caption">{errors[questionId]}</Typography>}
          </FormControl>
        );

      case 'scale': // Example using Slider
        return (
          <Box sx={{ mt: 3 }}>
            <FormLabel component="legend" error={hasError}>On a scale of 1 to 10:</FormLabel>
            <Slider
              value={typeof currentAnswer === 'number' ? currentAnswer : 0} // Slider needs number
              onChange={(e, newValue) => handleAnswerChange(questionId, newValue)}
              aria-labelledby="scale-slider"
              valueLabelDisplay="auto"
              step={1}
              marks
              min={1}
              max={10}
              sx={{ width: '90%', mx: 'auto', display: 'block' }}
            />
             {hasError && <Typography color="error" variant="caption">{errors[questionId]}</Typography>}
          </Box>
        );

      case 'select':
        return (
          <FormControl fullWidth required error={hasError} sx={{ mt: 2 }}>
            <FormLabel component="legend" sx={{ mb: 1 }}>Select from options:</FormLabel>
            <Select
              value={currentAnswer}
              onChange={(e) => handleAnswerChange(questionId, e.target.value)}
              displayEmpty
            >
              <MenuItem value="" disabled><em>Please select...</em></MenuItem>
              {(options || []).map((option, index) => (
                <MenuItem key={index} value={option}>{option}</MenuItem>
              ))}
            </Select>
             {hasError && <Typography color="error" variant="caption">{errors[questionId]}</Typography>}
          </FormControl>
        );
        
       case 'number':
         return (
           <TextField
            fullWidth
            type="number"
            label="Your Answer (Number)"
            variant="outlined"
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(questionId, e.target.value === '' ? '' : Number(e.target.value))}
            required
            error={hasError}
            helperText={errors[questionId]}
            sx={{ mt: 2 }}
            inputProps={{ step: "any" }} // Allow decimals if needed
          />
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
            value={currentAnswer}
            onChange={(e) => handleAnswerChange(questionId, e.target.value)}
            required
            error={hasError}
            helperText={errors[questionId]}
            sx={{ mt: 2 }}
          />
        );
    }
  };

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      {/* Stepper showing question progress */}
      <Stepper activeStep={currentStep} alternativeLabel sx={{ mb: 4 }}>
        {questions.map((q, index) => (
          <Step key={q.questionId || index}> 
            <StepLabel>Q {index + 1}</StepLabel>
          </Step>
        ))}
      </Stepper>

      <Paper elevation={2} sx={{ p: { xs: 2, md: 3 }, mb: 4 }}>
        <Typography variant="h6" gutterBottom component="div">
          {/* Use question text from the object */} 
          {currentQuestion?.question || 'Loading question...'}
        </Typography>
        
        <Divider sx={{ my: 2 }} />
        
        {renderQuestionInput()}
        
        {/* Navigation Buttons */} 
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', sm: 'row' }, justifyContent: 'space-between', mt: 4 }}>
          <Button
            variant="outlined"
            onClick={handleBack}
            disabled={currentStep === 0 || isLoading}
            startIcon={<ArrowBackIcon />}
            sx={{ mb: { xs: 1, sm: 0 } }}
          >
            Back
          </Button>
          
          <Button
            variant="contained"
            color="primary"
            onClick={handleNext}
            disabled={isLoading}
            endIcon={currentStep === questions.length - 1 ? null : <ArrowForwardIcon />}
            sx={{ mb: { xs: 1, sm: 0 } }}
          >
            {isLoading ? (
              <CircularProgress size={24} color="inherit" />
            ) : currentStep === questions.length - 1 ? (
              'Submit Answers'
            ) : (
              'Next Question'
            )}
          </Button>
        </Box>
      </Paper>

      {/* Keep Skip button separate or integrate near navigation */}
      <Box sx={{ display: 'flex', justifyContent: 'center', mt: 2 }}>
           <Button 
              onClick={onSkip} 
              disabled={isLoading}
              color="secondary"
            >
              Skip Assessment & Proceed
            </Button>
      </Box>
      
    </Box>
  );
};

export default QuestionForm; 