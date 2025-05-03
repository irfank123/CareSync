import React from 'react';
import PropTypes from 'prop-types';
import {
  Box,
  Typography,
  Paper,
  Divider,
  List,
  ListItem,
  ListItemText,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Chip,
  Grid,
} from '@mui/material';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { formatDate } from '../../utils/dateUtils';

const AssessmentReport = ({ assessment }) => {
  // Helper function to render any question/answer pair
  const renderQuestionAnswer = (question, answer, index) => {
    if (!question || !answer) return null;
    
    return (
      <ListItem key={index} sx={{ flexDirection: 'column', alignItems: 'flex-start', mb: 2 }}>
        <ListItemText 
          primary={question} 
          primaryTypographyProps={{ fontWeight: 'bold' }}
        />
        <ListItemText 
          primary={answer} 
          primaryTypographyProps={{ color: 'text.secondary' }}
        />
      </ListItem>
    );
  };

  // Format symptom data to handle both string and object formats
  const renderSymptom = (symptom, index) => {
    // Handle if symptom is a string (old format)
    if (typeof symptom === 'string') {
      return (
        <Chip 
          key={`string-symptom-${index}`}
          label={symptom}
          sx={{ m: 0.5 }}
          color="primary"
          variant="outlined"
        />
      );
    }
    
    // Handle if symptom is an object (new format)
    if (typeof symptom === 'object' && symptom !== null) {
      const severityColor = 
        symptom.severity >= 7 ? 'error' :
        symptom.severity >= 4 ? 'warning' : 'success';
        
      return (
        <Chip 
          key={`object-symptom-${index}`}
          label={`${symptom.name || 'Unknown'} (${symptom.severity || 'N/A'}/10)`}
          sx={{ m: 0.5 }}
          color={severityColor}
        />
      );
    }
    
    // Fallback for invalid data
    return null;
  };

  // Render all assessment questions and responses
  const renderAssessmentQuestionsAndResponses = () => {
    if (!assessment.generatedQuestions || !assessment.responses || 
        !Array.isArray(assessment.generatedQuestions) || !Array.isArray(assessment.responses)) {
      return <Typography>No assessment questions or responses available</Typography>;
    }

    return assessment.generatedQuestions.map((questionObj, index) => {
      // Find the matching response for this question
      const responseObj = assessment.responses.find(r => 
        r.questionId === questionObj.questionId
      ) || assessment.responses[index];
      
      if (!questionObj || !responseObj) return null;

      const question = questionObj.question;
      
      // Handle different answer types
      let answer = responseObj.answer || 'No answer provided';
      
      if (questionObj.answerType === 'boolean' && (answer === 'true' || answer === 'false')) {
        answer = answer === 'true' ? 'Yes' : 'No';
      } else if (questionObj.answerType === 'scale') {
        answer = `${answer}/10`;
      }

      return renderQuestionAnswer(
        question,
        answer,
        `assessment-qa-${index}`
      );
    });
  };

  // Find key patient responses for quick summary
  const getKeySummaryPoints = () => {
    const summaryPoints = [];
    
    // Check if we have responses
    if (assessment.generatedQuestions && assessment.responses && 
        Array.isArray(assessment.generatedQuestions) && Array.isArray(assessment.responses)) {
      
      // Look for temperature information
      const temperatureQ = assessment.generatedQuestions.findIndex(q => 
        q.question && q.question.toLowerCase().includes('temperature'));
      
      if (temperatureQ >= 0) {
        const tempResponse = assessment.responses.find(r => 
          r.questionId === assessment.generatedQuestions[temperatureQ].questionId
        ) || assessment.responses[temperatureQ];
        
        if (tempResponse && tempResponse.answer) {
          summaryPoints.push(`Temperature: ${tempResponse.answer}`);
        }
      }
      
      // Look for pain level
      const painQ = assessment.generatedQuestions.findIndex(q => 
        q.question && q.question.toLowerCase().includes('pain') && 
        q.question.toLowerCase().includes('scale'));
      
      if (painQ >= 0) {
        const painResponse = assessment.responses.find(r => 
          r.questionId === assessment.generatedQuestions[painQ].questionId
        ) || assessment.responses[painQ];
        
        if (painResponse && painResponse.answer) {
          summaryPoints.push(`Pain Level: ${painResponse.answer}/10`);
        }
      }
      
      // Look for medication information
      const medQ = assessment.generatedQuestions.findIndex(q => 
        q.question && q.question.toLowerCase().includes('medication'));
      
      if (medQ >= 0) {
        const medResponse = assessment.responses.find(r => 
          r.questionId === assessment.generatedQuestions[medQ].questionId
        ) || assessment.responses[medQ];
        
        if (medResponse && medResponse.answer) {
          const answer = medResponse.answer;
          if (answer && answer.toLowerCase() !== 'no' && answer.toLowerCase() !== 'none') {
            summaryPoints.push(`Medications: ${answer}`);
          }
        }
      }
      
      // Check for overall discomfort/symptom duration
      const discomfortQ = assessment.generatedQuestions.findIndex(q => 
        q.question && q.question.toLowerCase().includes('discomfort') &&
        q.question.toLowerCase().includes('scale'));
      
      if (discomfortQ >= 0) {
        const discomfortResponse = assessment.responses.find(r => 
          r.questionId === assessment.generatedQuestions[discomfortQ].questionId
        ) || assessment.responses[discomfortQ];
        
        if (discomfortResponse && discomfortResponse.answer) {
          summaryPoints.push(`Overall Discomfort: ${discomfortResponse.answer}/10`);
        }
      }
      
      // Check if symptoms have occurred previously
      const previousQ = assessment.generatedQuestions.findIndex(q => 
        q.question && q.question.toLowerCase().includes('similar symptoms') &&
        q.question.toLowerCase().includes('past'));
      
      if (previousQ >= 0) {
        const previousResponse = assessment.responses.find(r => 
          r.questionId === assessment.generatedQuestions[previousQ].questionId
        ) || assessment.responses[previousQ];
        
        if (previousResponse && previousResponse.answer === 'true') {
          summaryPoints.push('Patient has experienced similar symptoms before');
        }
      }
    }
    
    // Add overall severity
    if (assessment.severity) {
      summaryPoints.push(`Overall Severity: ${assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)}`);
    }
    
    return summaryPoints;
  };

  const summaryPoints = getKeySummaryPoints();

  return (
    <Paper elevation={3} sx={{ p: 3, mt: 2 }}>
      <Box mb={3}>
        <Typography variant="h5" gutterBottom component="div">
          Patient Assessment
        </Typography>
        <Typography variant="subtitle1" color="text.secondary">
          Completed on {formatDate(assessment.completionDate || assessment.createdAt)}
        </Typography>
        
        {/* Assessment severity indicator */}
        {assessment.severity && (
          <Box mt={1} mb={2}>
            <Chip 
              label={`Severity: ${assessment.severity.charAt(0).toUpperCase() + assessment.severity.slice(1)}`}
              color={
                assessment.severity === 'high' ? 'error' : 
                assessment.severity === 'medium' ? 'warning' : 'success'
              }
              sx={{ mr: 1 }}
            />
          </Box>
        )}
        
        {/* Quick summary of key points */}
        {summaryPoints.length > 0 && (
          <Box mt={2} mb={2} p={2} bgcolor="#f5f5f5" borderRadius={1}>
            <Typography variant="subtitle2" gutterBottom fontWeight="bold">
              Quick Summary
            </Typography>
            <List dense disablePadding>
              {summaryPoints.map((point, idx) => (
                <ListItem key={`summary-${idx}`} disablePadding sx={{ mb: 0.5 }}>
                  <Typography variant="body2">• {point}</Typography>
                </ListItem>
              ))}
            </List>
          </Box>
        )}
      </Box>

      <Divider sx={{ mb: 3 }} />

      {/* Chief Complaint */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Chief Complaint</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            {assessment.chiefComplaint || assessment.symptoms && assessment.symptoms.join(', ') || 'No chief complaint recorded'}
          </Typography>
        </AccordionDetails>
      </Accordion>

      {/* Symptoms Questions */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Symptoms</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {assessment.symptoms && Array.isArray(assessment.symptoms) && assessment.symptoms.length > 0 ? (
            <Box display="flex" flexWrap="wrap" gap={1}>
              {assessment.symptoms.map((symptom, index) => renderSymptom(symptom, index))}
            </Box>
          ) : (
            <Typography>No symptoms recorded</Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Assessment Questions and Responses */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Assessment Questions</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <List disablePadding>
            {renderAssessmentQuestionsAndResponses()}
          </List>
        </AccordionDetails>
      </Accordion>

      {/* Additional Notes */}
      <Accordion>
        <AccordionSummary expandIcon={<ExpandMoreIcon />}>
          <Typography variant="h6">Additional Notes</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Typography>
            {assessment.notes || 'No additional notes'}
          </Typography>
        </AccordionDetails>
      </Accordion>
    </Paper>
  );
};

AssessmentReport.propTypes = {
  assessment: PropTypes.shape({
    _id: PropTypes.string,
    appointmentId: PropTypes.string,
    patientId: PropTypes.string,
    chiefComplaint: PropTypes.string,
    severity: PropTypes.string,
    status: PropTypes.string,
    createdAt: PropTypes.string,
    updatedAt: PropTypes.string,
    completionDate: PropTypes.string,
    notes: PropTypes.string,
    symptoms: PropTypes.oneOfType([
      PropTypes.arrayOf(PropTypes.string),
      PropTypes.arrayOf(
        PropTypes.shape({
          name: PropTypes.string,
          severity: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
          duration: PropTypes.string
        })
      )
    ]),
    generatedQuestions: PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.string,
        questionId: PropTypes.string,
        question: PropTypes.string,
        answerType: PropTypes.string,
        options: PropTypes.array
      })
    ),
    responses: PropTypes.arrayOf(
      PropTypes.shape({
        _id: PropTypes.string,
        questionId: PropTypes.string,
        answer: PropTypes.oneOfType([
          PropTypes.string,
          PropTypes.number,
          PropTypes.bool
        ])
      })
    )
  }).isRequired
};

export default AssessmentReport; 