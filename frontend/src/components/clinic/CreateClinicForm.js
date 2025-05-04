import React, { useState } from 'react';
import { Box, TextField, Button, Typography, Grid, Paper, CircularProgress, Alert } from '@mui/material';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import { useAuth0 } from '@auth0/auth0-react';
import { axiosInstance } from '../../services/api';

const CreateClinicForm = () => {
  const { getAccessTokenSilently } = useAuth0();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: {
      street: '',
      city: '',
      state: '',
      zipCode: '',
      country: ''
    }
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) setErrors(prev => ({ ...prev, [name]: null })); // Clear specific error
    setSubmitError(''); // Clear general submit error
  };

  const handleAddressChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      address: { ...prev.address, [name]: value }
    }));
    if (errors[`address.${name}`]) setErrors(prev => ({ ...prev, [`address.${name}`]: null }));
    setSubmitError('');
  };

  // Basic frontend validation (more robust validation on backend)
  const validateForm = () => {
    const newErrors = {};
    if (!formData.name) newErrors.name = 'Clinic name is required';
    if (!formData.phone) newErrors.phone = 'Phone number is required';
    // Basic phone format check (consider a library for more robust validation)
    // else if (!/^\+?[1-9]\d{1,14}$/.test(formData.phone)) newErrors.phone = 'Invalid phone format';
    if (!formData.address.street) newErrors['address.street'] = 'Street is required';
    if (!formData.address.city) newErrors['address.city'] = 'City is required';
    if (!formData.address.state) newErrors['address.state'] = 'State is required';
    if (!formData.address.zipCode) newErrors['address.zipCode'] = 'ZIP Code is required';
    if (!formData.address.country) newErrors['address.country'] = 'Country is required';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitError('');
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Get the Auth0 access token
      const token = await getAccessTokenSilently();
      // Log the actual token value
      console.log('Auth0 Access Token fetched for /clinics request:', token);
      
      // Use the correct full path including /api prefix and add Authorization header
      const response = await axiosInstance.post('/api/clinics', formData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        // Refresh the clinic auth context to get the new clinic info
        // await fetchClinicProfile(); // Commented out: Backend endpoint /auth/clinic/me doesn't exist yet
        // TODO: Once /auth/clinic/me is working, uncomment the line above
        //       OR potentially update clinicInfo state directly from the response here.
        console.log('Clinic created successfully according to backend response:', response.data);
        // The ClinicDashboard will re-render due to context update (if fetchClinicProfile worked or state is set)
      } else {
         // Handle specific errors from backend if provided
         setSubmitError(response.data.message || 'Failed to create clinic. Please try again.');
         if (response.data.errors) {
           const backendErrors = response.data.errors.reduce((acc, err) => {
             acc[err.param] = err.msg;
             return acc;
           }, {});
           setErrors(prev => ({ ...prev, ...backendErrors }));
         }
      }
    } catch (error) {
      console.error('Create clinic submission error:', error);
      setSubmitError(error.response?.data?.message || 'An unexpected error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Paper elevation={3} sx={{ p: 4, mt: 3 }}>
      <Typography variant="h5" component="h2" gutterBottom>
        Create Your Clinic Profile
      </Typography>
      <Typography variant="body2" color="text.secondary" gutterBottom>
        Please provide the details for your clinic.
      </Typography>
      <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 2 }}>
        {submitError && <Alert severity="error" sx={{ mb: 2 }}>{submitError}</Alert>}
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              id="name"
              label="Clinic Name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              error={!!errors.name}
              helperText={errors.name}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              id="phone"
              label="Phone Number"
              name="phone"
              type="tel"
              value={formData.phone}
              onChange={handleInputChange}
              error={!!errors.phone}
              helperText={errors.phone}
              disabled={isLoading}
            />
          </Grid>
          {/* Address Fields */}
          <Grid item xs={12}>
            <Typography variant="subtitle1" gutterBottom sx={{ mt: 1 }}>Address</Typography>
          </Grid>
          <Grid item xs={12}>
            <TextField
              required
              fullWidth
              id="street"
              label="Street Address"
              name="street"
              value={formData.address.street}
              onChange={handleAddressChange}
              error={!!errors['address.street']}
              helperText={errors['address.street']}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="city"
              label="City"
              name="city"
              value={formData.address.city}
              onChange={handleAddressChange}
              error={!!errors['address.city']}
              helperText={errors['address.city']}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="state"
              label="State / Province"
              name="state"
              value={formData.address.state}
              onChange={handleAddressChange}
              error={!!errors['address.state']}
              helperText={errors['address.state']}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="zipCode"
              label="ZIP / Postal Code"
              name="zipCode"
              value={formData.address.zipCode}
              onChange={handleAddressChange}
              error={!!errors['address.zipCode']}
              helperText={errors['address.zipCode']}
              disabled={isLoading}
            />
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField
              required
              fullWidth
              id="country"
              label="Country"
              name="country"
              value={formData.address.country}
              onChange={handleAddressChange}
              error={!!errors['address.country']}
              helperText={errors['address.country']}
              disabled={isLoading}
            />
          </Grid>
        </Grid>
        <Button
          type="submit"
          fullWidth
          variant="contained"
          sx={{ mt: 3, mb: 2 }}
          disabled={isLoading}
        >
          {isLoading ? <CircularProgress size={24} /> : 'Create Clinic'}
        </Button>
      </Box>
    </Paper>
  );
};

export default CreateClinicForm; 