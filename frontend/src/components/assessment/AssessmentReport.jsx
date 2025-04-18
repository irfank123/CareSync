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

      {parseError ? (
        <Paper elevation={2} sx={{ p: 3, my: 3 }}>
          <Typography variant="body1">
            {assessment.aiGeneratedReport || 'No report data available.'}
          </Typography>
        </Paper>
      ) : (
        <Box>
          <Grid container spacing={3} sx={{ mb: 4 }}>
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom>
                    Assessment Summary
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
                    <Typography variant="subtitle1" sx={{ mr: 1 }}>
                      Severity:
                    </Typography>
                    <Chip
                      icon={getSeverityIcon(assessment.severity)}
                      label={assessment.severity || 'Not specified'}
                      color={getSeverityColor(assessment.severity)}
                      variant="outlined"
                    />
                  </Box>
                  
                  <Typography variant="body1" sx={{ mb: 2 }}>
                    {reportData.summary || 'No summary available.'}
                  </Typography>
                </CardContent>
              </Card>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Card variant="outlined">
                <CardContent>
                  <Typography variant="h6" gutterBottom sx={{ display: 'flex', alignItems: 'center' }}>
                    <MedicalServicesIcon sx={{ mr: 1 }} />
                    Possible Conditions
                  </Typography>
                  <Divider sx={{ mb: 2 }} />
                  
                  {reportData.possibleConditions && reportData.possibleConditions.length > 0 ? (
                    <List dense>
                      {reportData.possibleConditions.map((condition, index) => (
                        <ListItem key={index} sx={{ py: 0.5 }}>
                          <ListItemText
                            primary={condition.name}
                            secondary={condition.description}
                          />
                        </ListItem>
                      ))}
                    </List>
                  ) : (
                    <Typography variant="body2" color="text.secondary">
                      No conditions specified in the report.
                    </Typography>
                  )}
                </CardContent>
              </Card>
            </Grid>
          </Grid>

          <Paper elevation={2} sx={{ p: 3, mb: 4 }}>
            <Typography variant="h6" gutterBottom>
              Detailed Analysis
            </Typography>
            <Divider sx={{ mb: 2 }} />
            
            <Typography variant="body1" sx={{ whiteSpace: 'pre-line' }}>
              {reportData.analysis || assessment.aiGeneratedReport || 'No detailed analysis available.'}
            </Typography>
          </Paper>

          <Alert severity="info" sx={{ mb: 3 }}>
            This AI-generated assessment is for informational purposes only and does not constitute medical advice. 
            Please consult with your healthcare provider for proper diagnosis and treatment recommendations.
          </Alert>
        </Box>
      )}

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

      {assessment.responses && assessment.responses.length > 0 && (
        <Box sx={{ mt: 4 }}>
          <Typography variant="h6" gutterBottom>
            Patient Responses
          </Typography>
          <List>
            {assessment.responses.map((response, index) => (
              <Paper key={index} variant="outlined" sx={{ mb: 2, p: 2 }}>
                <Typography variant="subtitle1" gutterBottom>
                  Q: {response.question}
                </Typography>
                <Typography variant="body1" color="text.secondary">
                  A: {response.answer}
                </Typography>
              </Paper>
            ))}
          </List>
        </Box>
      )}
    </Box>
  );
};

export default AssessmentReport; 