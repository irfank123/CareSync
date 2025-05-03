import React, { useState, useEffect } from 'react';
import PropTypes from 'prop-types';
import { useNavigate } from 'react-router-dom';
import { 
  Box, 
  Typography, 
  Paper, 
  Table, 
  TableBody, 
  TableCell, 
  TableContainer, 
  TableHead, 
  TableRow,
  TablePagination,
  Chip,
  Button,
  CircularProgress
} from '@mui/material';
import { format } from 'date-fns';
import { getPatientAssessments } from '../../services/assessmentService';

const AssessmentList = ({ patientId }) => {
  const navigate = useNavigate();
  const [assessments, setAssessments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    const fetchAssessments = async () => {
      try {
        setLoading(true);
        const data = await getPatientAssessments(patientId);
        setAssessments(data);
        setError(null);
      } catch (err) {
        console.error('Error fetching assessments:', err);
        setError('Unable to load assessments. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    if (patientId) {
      fetchAssessments();
    }
  }, [patientId]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const handleViewAssessment = (assessmentId) => {
    navigate(`/assessments/${assessmentId}`);
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
      </Paper>
    );
  }

  if (assessments.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3 }}>
        <Typography align="center">No assessments found for this patient.</Typography>
      </Paper>
    );
  }

  return (
    <Box sx={{ width: '100%' }}>
      <Paper elevation={3} sx={{ width: '100%', mb: 2 }}>
        <TableContainer>
          <Table aria-label="assessment list">
            <TableHead>
              <TableRow>
                <TableCell>Date</TableCell>
                <TableCell>Chief Complaint</TableCell>
                <TableCell>Diagnosis</TableCell>
                <TableCell>Provider</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {assessments
                .slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage)
                .map((assessment) => (
                  <TableRow key={assessment.id}>
                    <TableCell>
                      {format(new Date(assessment.createdAt), 'MMM dd, yyyy')}
                    </TableCell>
                    <TableCell>{assessment.chiefComplaint}</TableCell>
                    <TableCell>
                      {assessment.diagnosis ? (
                        <Chip 
                          label={assessment.diagnosis} 
                          color="primary" 
                          variant="outlined" 
                          size="small" 
                        />
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Not specified
                        </Typography>
                      )}
                    </TableCell>
                    <TableCell>{assessment.providerName || 'Unknown'}</TableCell>
                    <TableCell align="right">
                      <Button
                        variant="contained"
                        size="small"
                        onClick={() => handleViewAssessment(assessment.id)}
                      >
                        View
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          rowsPerPageOptions={[5, 10, 25]}
          component="div"
          count={assessments.length}
          rowsPerPage={rowsPerPage}
          page={page}
          onPageChange={handleChangePage}
          onRowsPerPageChange={handleChangeRowsPerPage}
        />
      </Paper>
    </Box>
  );
};

AssessmentList.propTypes = {
  patientId: PropTypes.string.isRequired
};

export default AssessmentList; 