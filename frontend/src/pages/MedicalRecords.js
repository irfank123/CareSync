import React, { useState, useEffect } from 'react';
import { prescriptionService } from '../services/api';
import { useAuth } from '../context/AuthContext';
import {
  Container,
  Typography,
  Box,
  CircularProgress,
  Alert,
  Grid,
} from '@mui/material';
import PrescriptionCard from '../components/prescription/PrescriptionCard';

const MedicalRecords = () => {
  const [prescriptions, setPrescriptions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMyPrescriptions = async () => {
      setLoading(true);
      setError(null);
      try {
        console.log("MedicalRecords: Fetching prescriptions...");
        const response = await prescriptionService.getMyPrescriptions();
        console.log("MedicalRecords: API Response:", response);

        if (response?.data?.success) {
          const fetchedPrescriptions = response.data.data || [];
          console.log("MedicalRecords: Prescriptions fetched successfully:", fetchedPrescriptions);
          setPrescriptions(fetchedPrescriptions);
        } else {
          console.error("MedicalRecords: Failed to fetch prescriptions - Success false or no data", response?.data);
          setError(response?.data?.message || 'Failed to load your prescriptions.');
        }
      } catch (err) {
        console.error("MedicalRecords: Error fetching prescriptions:", err);
        setError(err.response?.data?.message || err.message || 'An error occurred while fetching your medical records.');
      } finally {
        setLoading(false);
      }
    };

    fetchMyPrescriptions();
  }, []);

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        My Medical Records
      </Typography>
      <Typography variant="h6" component="h2" sx={{ mb: 3 }}>
        Prescriptions
      </Typography>

      {loading && (
        <Box sx={{ display: 'flex', justifyContent: 'center', mt: 5 }}>
          <CircularProgress />
        </Box>
      )}

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {error}
        </Alert>
      )}

      {!loading && !error && prescriptions.length === 0 && (
        <Alert severity="info" sx={{ mt: 2 }}>
          You do not have any prescriptions on record.
        </Alert>
      )}

      {!loading && !error && prescriptions.length > 0 && (
        <Grid container spacing={3}>
          {prescriptions.map((prescription) => (
            <Grid item xs={12} key={prescription._id}>
              <PrescriptionCard prescription={prescription} />
            </Grid>
          ))}
        </Grid>
      )}
    </Container>
  );
};

export default MedicalRecords; 