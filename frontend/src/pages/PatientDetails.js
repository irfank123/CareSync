import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Typography,
  Box,
  Paper,
  Grid,
  CircularProgress,
  Alert,
  Button,
  Divider,
  List,
  ListItem,
  ListItemText,
  Dialog, // For prescription form modal
  DialogTitle,
  DialogContent,
  DialogActions
} from '@mui/material';
import { ArrowBack, Add } from '@mui/icons-material';
import { Link as RouterLink } from 'react-router-dom';
import { patientService, prescriptionService, doctorService } from '../services/api';
import { format } from 'date-fns';
// Import components we will create later
import PrescriptionCard from '../components/prescription/PrescriptionCard'; // Import Card
import PrescriptionForm from '../components/prescription/PrescriptionForm'; // Import Form

const PatientDetails = () => {
  const { id: patientId } = useParams(); // Get patient ID from route params
  const { user } = useAuth();
  const navigate = useNavigate();

  const [patient, setPatient] = useState(null);
  const [prescriptions, setPrescriptions] = useState([]);
  const [loadingPatient, setLoadingPatient] = useState(true);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(true);
  const [error, setError] = useState(null);
  const [prescriptionError, setPrescriptionError] = useState(null); // Separate error state for dialog
  const [openPrescriptionDialog, setOpenPrescriptionDialog] = useState(false);
  const [doctorRecordId, setDoctorRecordId] = useState(null); // State for doctor's record ID

  const isDoctor = user?.role === 'doctor'; // Check if user is a doctor

  // Fetch Doctor Record ID if user is a doctor
  useEffect(() => {
    const fetchDoctorRecordId = async () => {
        if (isDoctor && user?.id) {
            try {
                console.log(`Fetching doctor record for user ID: ${user.id}`);
                const response = await doctorService.getByUserId(user.id);
                if (response?.data?.success && response.data.data?._id) {
                    const fetchedDoctorId = response.data.data._id;
                    console.log(`Found doctor record ID: ${fetchedDoctorId}`);
                    setDoctorRecordId(fetchedDoctorId);
                } else {
                    console.error('Doctor record not found for user:', user.id);
                    setPrescriptionError('Could not link logged-in user to a doctor profile.'); // Set error
                }
            } catch (err) {
                console.error('Error fetching doctor record:', err);
                setPrescriptionError('Error retrieving doctor information.'); // Set error
            }
        }
    };
    fetchDoctorRecordId();
  }, [isDoctor, user?.id]);

  // Define fetchPrescriptions separately to call it again after saving
  const fetchPrescriptions = async () => {
      if (!patientId || !isDoctor) {
          setLoadingPrescriptions(false);
          setPrescriptions([]); // Ensure list is empty if not authorized
          return;
      }
      setLoadingPrescriptions(true);
      setPrescriptionError(null); // Clear previous errors
      try {
        const response = await prescriptionService.getByPatientId(patientId);
        if (response?.data?.success) {
          setPrescriptions(response.data.data || []);
        } else {
          // Use the specific error state for prescriptions section
          setPrescriptionError('Failed to load prescriptions.'); 
        }
      } catch (err) {
        console.error('Error fetching prescriptions:', err);
        setPrescriptionError('An error occurred fetching prescriptions.');
      } finally {
        setLoadingPrescriptions(false);
      }
  };

  // Fetch Patient Details
  useEffect(() => {
    const fetchPatientData = async () => {
      if (!patientId) return;
      setLoadingPatient(true);
      try {
        const response = await patientService.getById(patientId);
        if (response?.data?.success) {
           const rawPatientData = response.data.data;
           console.log("Raw patient data for details page:", rawPatientData); // Log raw data
           
           // Access populated user details from the 'userId' field
           const populatedUser = rawPatientData?.userId;
           
           const patientData = {
               ...rawPatientData, // Spread raw data first
               
               // Then explicitly map/overwrite fields from populated user
               firstName: populatedUser?.firstName || 'N/A',
               lastName: populatedUser?.lastName || '',
               email: populatedUser?.email || 'N/A',
               phoneNumber: populatedUser?.phoneNumber || 'N/A',
               
               // REMOVED dobFormatted calculation
           };
          console.log("Processed patient data:", patientData); // Log processed data
          setPatient(patientData);
        } else {
          setError('Failed to load patient details.');
        }
      } catch (err) {
        console.error('Error fetching patient details:', err);
        setError(err.response?.data?.message || err.message || 'An error occurred fetching patient data.');
      } finally {
        setLoadingPatient(false);
      }
    };
    fetchPatientData();
  }, [patientId]);

  // Fetch Prescriptions for this Patient
  useEffect(() => {
    fetchPrescriptions(); // Call the separated function
  }, [patientId, isDoctor]); // Dependencies remain the same

  const handleOpenPrescriptionDialog = () => {
    setOpenPrescriptionDialog(true);
  };

  const handleClosePrescriptionDialog = () => {
    setOpenPrescriptionDialog(false);
  };

  const handleSavePrescription = async (prescriptionFormData) => {
    setPrescriptionError(null); // Clear previous errors
    if (!isDoctor) {
        setPrescriptionError('Only doctors can create prescriptions.');
        return;
    }
    if (!doctorRecordId) { // Check if we have the doctor's record ID
        setPrescriptionError('Could not identify prescribing doctor. Please ensure your doctor profile is set up.');
        return;
    }

    try {
      // Log the service object right before calling create
      console.log('Attempting to call prescriptionService.create. prescriptionService:', prescriptionService);
      
      // Log the data being sent
      const dataToSend = { 
          ...prescriptionFormData, 
          patientId: patientId, // Ensure patientId is included
          doctorId: doctorRecordId // Pass the actual doctor record ID from state
      };
      console.log('Data being sent to prescriptionService.create:', dataToSend);

      const response = await prescriptionService.create(dataToSend);
      
      if (response?.data?.success) {
          handleClosePrescriptionDialog();
          fetchPrescriptions(); // Refresh the list
          // Optionally show a success toast message
      } else {
          setPrescriptionError(response?.data?.message || 'Failed to save prescription.');
      }
    } catch (err) {
      console.error('Error saving prescription:', err);
      setPrescriptionError(err.response?.data?.message || err.message || 'An unexpected error occurred while saving.');
    }
  };

  if (loadingPatient) {
    return <Container sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}><CircularProgress /></Container>;
  }

  if (error) {
    return <Container sx={{ mt: 5 }}><Alert severity="error">{error}</Alert></Container>;
  }

  if (!patient) {
    return <Container sx={{ mt: 5 }}><Alert severity="warning">Patient not found.</Alert></Container>;
  }

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Button component={RouterLink} to="/patients" startIcon={<ArrowBack />} sx={{ mb: 2 }}>
        Back to Patients List
      </Button>

      <Grid container spacing={3}>
        {/* Patient Information Section */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h5" component="h1" gutterBottom>
              {patient.firstName} {patient.lastName}
            </Typography>
            <Divider sx={{ mb: 2 }} />
            <Typography variant="body1"><strong>Email:</strong> {patient.email}</Typography>
            <Typography variant="body1"><strong>Phone:</strong> {patient.phoneNumber}</Typography>
            <Typography variant="body1"><strong>Gender:</strong> {patient.gender || 'N/A'}</Typography>
            {/* Add more patient details as needed */}
          </Paper>
        </Grid>

        {/* Prescriptions Section */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
              <Typography variant="h6" component="h2">
                Prescriptions
              </Typography>
              {isDoctor && (
                <Button
                  variant="contained"
                  startIcon={<Add />}
                  onClick={handleOpenPrescriptionDialog}
                >
                  New Prescription
                </Button>
              )}
            </Box>
            <Divider sx={{ mb: 2 }} />
            {loadingPrescriptions ? (
              <CircularProgress size={24} />
            ) : prescriptionError ? (
                <Alert severity="error" sx={{ mt: 1 }}>{prescriptionError}</Alert> // Show prescription-specific error
            ) : prescriptions.length === 0 ? (
              <Typography>No prescriptions found for this patient.</Typography>
            ) : (
              <Box>
                {prescriptions.map((prescription) => (
                   <PrescriptionCard key={prescription._id} prescription={prescription} />
                ))}
              </Box>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Prescription Form Dialog */}
      <Dialog open={openPrescriptionDialog} onClose={handleClosePrescriptionDialog} maxWidth="md" fullWidth>
        <DialogTitle>Create New Prescription for {patient.firstName} {patient.lastName}</DialogTitle>
        <DialogContent>
          {/* Render PrescriptionForm component */}
          {prescriptionError && <Alert severity="error" sx={{ mb: 2 }}>{prescriptionError}</Alert>} {/* Show error in dialog */}
          <PrescriptionForm 
              patientId={patientId}
              doctorId={doctorRecordId} // Pass the fetched doctor ID to the form
              onSubmit={handleSavePrescription}
              onCancel={handleClosePrescriptionDialog}
          />
        </DialogContent>
        {/* DialogActions are now part of PrescriptionForm */}
        {/* <DialogActions>
          <Button onClick={handleClosePrescriptionDialog}>Cancel</Button>
          <Button onClick={() => handleSavePrescription({})} variant="contained">
            Save Prescription
          </Button>
        </DialogActions> */}
      </Dialog>

    </Container>
  );
};

export default PatientDetails; 