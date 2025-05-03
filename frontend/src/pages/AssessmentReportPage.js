import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Box, Container, Typography, CircularProgress, Button } from '@mui/material';
import { ArrowBack } from '@mui/icons-material';
import AssessmentReport from '../components/assessment/AssessmentReport';
import assessmentService from '../services/assessmentService';
import AlertMessage from '../components/common/AlertMessage';

const AssessmentReportPage = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [assessment, setAssessment] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchAssessment = async () => {
      try {
        setLoading(true);
        const response = await assessmentService.getAssessmentByAppointment(appointmentId);
        setAssessment(response.data);
        setError(null);
      } catch (err) {
        console.error('Error fetching assessment report:', err);
        setError('Failed to load the assessment report. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (appointmentId) {
      fetchAssessment();
    }
  }, [appointmentId]);

  const handleGoBack = () => {
    navigate(-1);
  };

  return (
    <Container maxWidth="lg">
      <Box sx={{ my: 4 }}>
        <Button 
          startIcon={<ArrowBack />} 
          onClick={handleGoBack}
          sx={{ mb: 3 }}
        >
          Back
        </Button>

        <Typography variant="h4" component="h1" gutterBottom>
          Assessment Report
        </Typography>

        {loading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <CircularProgress />
          </Box>
        ) : error ? (
          <AlertMessage severity="error" message={error} />
        ) : !assessment ? (
          <AlertMessage severity="info" message="No assessment found for this appointment." />
        ) : (
          <AssessmentReport assessment={assessment} />
        )}
      </Box>
    </Container>
  );
};

export default AssessmentReportPage; 