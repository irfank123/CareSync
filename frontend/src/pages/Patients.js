import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  InputAdornment,
  CircularProgress,
  Alert,
  Link,
  IconButton,
  Tooltip
} from '@mui/material';
import { Search as SearchIcon, PersonSearch as PersonSearchIcon } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { format } from 'date-fns';
import { patientService } from '../services/api';

const Patients = () => {
  const { user } = useAuth();
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  // TODO: Add state for pagination, sorting, filtering if needed

  // Fetch patients
  useEffect(() => {
    const fetchPatients = async () => {
      try {
        setLoading(true);
        setError(null);
        
        // Ensure user is authorized (e.g., admin, doctor, staff)
        if (!['admin', 'doctor', 'staff'].includes(user?.role)) {
            setError('You are not authorized to view this page.');
            setLoading(false);
            return;
        }

        const response = await patientService.getAll();
        
        if (response?.data?.success) {
          const rawPatientData = response.data.data || [];
          // console.log("Raw patient data from API:", rawPatientData);
          
          const patientData = rawPatientData.map(rawPatient => {
              // console.log("Mapping raw patient:", rawPatient);
              
              // Backend now sends _id as string, access directly
              // const patientIdString = rawPatient._id; 
                                      
              // console.log("Original ID:", rawPatient._id, "Stringified ID:", patientIdString);
              
              // Return object, _id should be correct from backend
              return {
                ...rawPatient, 
                // _id is already a string from backend
                
                // Map other fields as before
                firstName: rawPatient.user?.firstName || 'N/A',
                lastName: rawPatient.user?.lastName || '',
                email: rawPatient.user?.email || 'N/A',
                phoneNumber: rawPatient.user?.phoneNumber || 'N/A',
                dobFormatted: rawPatient.dateOfBirth
                    ? format(new Date(rawPatient.dateOfBirth), 'MM/dd/yyyy')
                    : 'N/A',
              };
          });

          setPatients(patientData || []);

          // TODO: Set pagination state if API provides it (totalPages, currentPage)
        } else {
           setError(response?.data?.message || 'Failed to load patients.');
        }

      } catch (err) {
        console.error('Error fetching patients:', err);
        setError(err.response?.data?.message || err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
    };

    if (user?.role) { // Check if user role is available before fetching
        fetchPatients();
    } else {
        // Handle case where user data is not yet loaded (optional)
        setLoading(false); 
        // setError('User data not available.'); // Or wait for user context to load
    }
  // Only re-run if the user's role changes
  }, [user?.role]);

  if (loading) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4, display: 'flex', justifyContent: 'center' }}>
        <CircularProgress />
      </Container>
    );
  }

  if (error) {
    return (
      <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
        <Alert severity="error">{error}</Alert>
      </Container>
    );
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" component="h1">
          Patients
        </Typography>
        <Button
          variant="contained"
          color="primary"
          component={RouterLink}
          to="/patients/new"
        >
          Add New Patient
        </Button>
      </Box>

      <Box sx={{ mb: 4 }}>
        <TextField
          fullWidth
          placeholder="Search patients by name or ID"
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          }}
        />
      </Box>

      <Paper sx={{ width: '100%', overflow: 'hidden' }}>
        <TableContainer>
          <Table stickyHeader aria-label="patients table">
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Date of Birth</TableCell>
                <TableCell>Gender</TableCell>
                <TableCell>Contact</TableCell>
                <TableCell>Actions</TableCell> 
              </TableRow>
            </TableHead>
            <TableBody>
              {patients.length === 0 ? (
                <TableRow>
                    <TableCell colSpan={6} align="center">
                    No patients found.
                    </TableCell>
                </TableRow>
                ) : (
                patients.map((patient) => (
                    <TableRow hover role="checkbox" tabIndex={-1} key={patient._id}>
                    <TableCell>{`${patient.firstName} ${patient.lastName}`}</TableCell>
                    <TableCell>{patient.email}</TableCell>
                    <TableCell>{patient.dobFormatted}</TableCell>
                    <TableCell>{patient.gender || 'N/A'}</TableCell>
                    <TableCell>{patient.phoneNumber}</TableCell>
                    <TableCell>
                       <Tooltip title="View Details">
                         {/* console.log('Rendering link for patient:', patient, 'with ID:', patient._id, 'Type:', typeof patient._id) */}
                         <IconButton 
                             component={RouterLink} 
                             // Use patient._id directly, assuming it's now a string
                             to={`/patients/${patient._id}`}
                             size="small"
                         > 
                           <PersonSearchIcon />
                         </IconButton>
                        </Tooltip>
                    </TableCell>
                    </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
    </Container>
  );
};

export default Patients; 