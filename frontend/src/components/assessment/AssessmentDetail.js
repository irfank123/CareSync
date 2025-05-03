import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Divider,
  Button,
  Chip,
  CircularProgress,
  Paper,
  Stack
} from '@mui/material';
import { format } from 'date-fns';
import { getAssessmentById } from '../../services/assessmentService';

const AssessmentDetail = ({ assessmentId: propAssessmentId }) => {
  const { id: paramAssessmentId } = useParams();
  const assessmentId = propAssessmentId || paramAssessmentId;
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      if (!assessmentId) return;
      
      try {
        setLoading(true);
        const data = await getAssessmentById(assessmentId);
        setAssessment(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching assessment:', err);
        setError('Unable to load assessment details. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAssessment();
  }, [assessmentId]);

  const handleBack = () => {
    navigate(-1);
  };

  const handleEdit = () => {
    navigate(`/assessments/edit/${assessmentId}`);
  };

  if (loading) {
    return (
      <Box display="flex" justifyContent="center" my={4}>
        <CircularProgress />
      </Box>
    );
  }

  if (error) {
    return (
      <Paper elevation={2} sx={{ p: 3, bgcolor: '#fff9f9' }}>
        <Typography color="error">{error}</Typography>
        <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Paper>
    );
  }

  if (!assessment) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography>Assessment not found or has been deleted.</Typography>
        <Button variant="contained" onClick={handleBack} sx={{ mt: 2 }}>
          Go Back
        </Button>
      </Paper>
    );
  }

  return (
    <Box sx={{ maxWidth: 1000, mx: 'auto', p: 2 }}>
      <Stack direction="row" spacing={2} sx={{ mb: 3 }}>
        <Button variant="outlined" onClick={handleBack}>
          Back
        </Button>
        <Button variant="contained" onClick={handleEdit}>
          Edit Assessment
        </Button>
      </Stack>

      <Card elevation={3}>
        <CardContent>
          <Typography variant="h5" gutterBottom>
            Assessment Details
          </Typography>
          <Typography variant="subtitle1" color="text.secondary" gutterBottom>
            Created on {format(new Date(assessment.createdAt), 'MMMM dd, yyyy')}
          </Typography>
          
          <Divider sx={{ my: 2 }} />
          
          <Grid container spacing={3}>
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Patient
              </Typography>
              <Typography variant="body1" gutterBottom>
                {assessment.patientName || 'Unknown'}
              </Typography>
            </Grid>
            
            <Grid item xs={12} md={6}>
              <Typography variant="subtitle2" color="text.secondary">
                Provider
              </Typography>
              <Typography variant="body1" gutterBottom>
                {assessment.providerName || 'Not assigned'}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Chief Complaint
              </Typography>
              <Typography variant="body1" gutterBottom>
                {assessment.chiefComplaint || 'Not specified'}
              </Typography>
            </Grid>

            <Grid item xs={12}>
              <Typography variant="subtitle2" color="text.secondary">
                Diagnosis
              </Typography>
              {assessment.diagnosis ? (
                <Chip 
                  label={assessment.diagnosis} 
                  color="primary" 
                  sx={{ mt: 1 }} 
                />
              ) : (
                <Typography variant="body1" gutterBottom>
                  No diagnosis provided
                </Typography>
              )}
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Vital Signs
              </Typography>
              
              <Grid container spacing={2}>
                <Grid item xs={6} sm={4}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Blood Pressure
                    </Typography>
                    <Typography variant="body1">
                      {assessment.bloodPressure || 'Not recorded'}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} sm={4}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Heart Rate
                    </Typography>
                    <Typography variant="body1">
                      {assessment.heartRate ? `${assessment.heartRate} bpm` : 'Not recorded'}
                    </Typography>
                  </Paper>
                </Grid>
                
                <Grid item xs={6} sm={4}>
                  <Paper elevation={1} sx={{ p: 2 }}>
                    <Typography variant="subtitle2" color="text.secondary">
                      Temperature
                    </Typography>
                    <Typography variant="body1">
                      {assessment.temperature ? `${assessment.temperature} °F` : 'Not recorded'}
                    </Typography>
                  </Paper>
                </Grid>
              </Grid>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Assessment Notes
              </Typography>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  minHeight: '100px',
                }}
              >
                <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
                  {assessment.notes || 'No assessment notes have been added.'}
                </Typography>
              </Paper>
            </Grid>
            
            <Grid item xs={12}>
              <Divider sx={{ my: 1 }} />
              <Typography variant="h6" gutterBottom sx={{ mt: 2 }}>
                Treatment Plan
              </Typography>
              <Paper
                elevation={1}
                sx={{
                  p: 2,
                  bgcolor: 'background.default',
                  minHeight: '100px',
                }}
              >
                <Typography variant="body1" component="div" sx={{ whiteSpace: 'pre-wrap' }}>
                  {assessment.treatmentPlan || 'No treatment plan has been specified.'}
                </Typography>
              </Paper>
            </Grid>
          </Grid>
        </CardContent>
      </Card>
    </Box>
  );
};

AssessmentDetail.propTypes = {
  assessmentId: PropTypes.string
};

export default AssessmentDetail; 