import React from 'react';
import {
  Box,
  Typography,
  Paper,
  Divider,
  Chip,
  List,
  ListItem,
  ListItemText,
  Avatar,
  Grid,
  Card,
  CardContent,
  Alert
} from '@mui/material';
import ReportIcon from '@mui/icons-material/Assessment';
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import HelpIcon from '@mui/icons-material/Help';
import WarningIcon from '@mui/icons-material/Warning';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';

/**
 * Component to display the AI-generated assessment report
 */
const AssessmentReport = ({ assessment }) => {
  if (!assessment) {
    return (
      <Box sx={{ my: 4, textAlign: 'center' }}>
        <Typography variant="h6" color="text.secondary">
          No assessment data available.
        </Typography>
      </Box>
    );
  }

  // Parse the AI report (assuming it's JSON or convert from string)
  let reportData = {};
  let parseError = false;

  try {
    if (typeof assessment.aiGeneratedReport === 'string') {
      // Try to parse if it's a JSON string
      reportData = JSON.parse(assessment.aiGeneratedReport);
    } else if (typeof assessment.aiGeneratedReport === 'object') {
      // Use directly if it's already an object
      reportData = assessment.aiGeneratedReport;
    }
  } catch (error) {
    console.error('Error parsing report:', error);
    parseError = true;
  }

  // Helper to determine severity color
  const getSeverityColor = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return 'error';
      case 'medium':
        return 'warning';
      case 'low':
        return 'success';
      default:
        return 'info';
    }
  };

  // Helper to determine severity icon
  const getSeverityIcon = (severity) => {
    switch (severity?.toLowerCase()) {
      case 'high':
        return <WarningIcon color="error" />;
      case 'medium':
        return <WarningIcon color="warning" />;
      case 'low':
        return <CheckCircleIcon color="success" />;
      default:
        return <HelpIcon color="info" />;
    }
  };

  return (
    <Box sx={{ mt: 4 }}>
      <Typography variant="h5" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
        <ReportIcon sx={{ mr: 1 }} />
        AI Assessment Report
      </Typography>

      {/* Display Severity Chip prominently */}
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2, mt: 1 }}>
          <Typography variant="subtitle1" sx={{ mr: 1 }}>
             Overall Severity:
          </Typography>
          <Chip
            icon={getSeverityIcon(assessment.severity)}
            label={assessment.severity || 'Not assessed'}
            color={getSeverityColor(assessment.severity)}
            variant="outlined"
            size="small"
          />
        </Box>

      {/* Display AI Generated Report Text */}
      <Paper elevation={2} sx={{ p: 3, my: 3 }}>
         <Typography variant="h6" gutterBottom>AI Analysis</Typography>
         <Divider sx={{ mb: 2 }}/>
         {parseError ? (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {/* Show raw string if parsing failed */} 
              {assessment.aiGeneratedReport || 'Report data could not be processed.'}
            </Typography>
         ) : (
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {/* Use parsed report data if available, otherwise fallback */} 
              {reportData.report || reportData.analysis || assessment.aiGeneratedReport || 'No detailed analysis available.'}
            </Typography>
         )}
      </Paper>

      {/* Key Points / Recommendations (if available in parsed report) */}
      {reportData.keyPoints || reportData.recommendedFollowUp ? (
         <Card variant="outlined" sx={{ mb: 3 }}>
          <CardContent>
             {reportData.keyPoints && (
               <Box mb={2}>
                  <Typography variant="subtitle1" gutterBottom>Key Points:</Typography>
                  <List dense>
                    {reportData.keyPoints.map((point, index) => (
                      <ListItem key={index} sx={{ py: 0 }}>
                          <ListItemText primary={`• ${point}`} />
                      </ListItem>
                    ))}
                  </List>
               </Box>
             )}
             {reportData.recommendedFollowUp && (
               <Box>
                  <Typography variant="subtitle1" gutterBottom>Recommended Follow-Up:</Typography>
                  <Typography variant="body2" color="text.secondary">{reportData.recommendedFollowUp}</Typography>
               </Box>
             )}
          </CardContent>
        </Card>
      ) : null}

      {/* Reported Symptoms */}
      <Box sx={{ mt: 4 }}>
        <Typography variant="h6" gutterBottom>
          Reported Symptoms
        </Typography>
        <Paper variant="outlined" sx={{ p: 2 }}>
          {assessment.symptoms && assessment.symptoms.length > 0 ? (
            <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}>
              {assessment.symptoms.map((symptom, index) => (
                <Chip key={index} label={symptom} color="primary" variant="outlined" />
              ))}
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No symptoms reported.
            </Typography>
          )}
        </Paper>
      </Box>

      {/* Generated Questions and Patient Answers */}
      {assessment.responses && assessment.responses.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Assessment Q&A
          </Typography>
          <List>
            {assessment.responses.map((response, index) => {
              const answerText = response.answer !== null && response.answer !== undefined ? 
                                  (typeof response.answer === 'boolean' ? (response.answer ? 'Yes' : 'No') : String(response.answer)) 
                                  : '-';

              return (
                <Paper key={response.questionId || index} variant="outlined" sx={{ mb: 2, p: 2 }}>
                  <Typography variant="subtitle1" gutterBottom>
                    Q: {response.question}
                  </Typography>
                  <Typography variant="body1" color="text.secondary">
                    A: {answerText}
                  </Typography>
                </Paper>
              );
            })}
          </List>
        </Box>
      )}

       <Alert severity="info" sx={{ mt: 3 }}>
          This AI-generated assessment is for informational purposes only and does not constitute medical advice. 
          Please consult with your healthcare provider for proper diagnosis and treatment recommendations.
        </Alert>
    </Box>
  );
};

export default AssessmentReport; 