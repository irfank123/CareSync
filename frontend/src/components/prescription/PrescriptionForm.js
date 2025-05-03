import React, { useState, useEffect } from 'react';
import {
  Box,
  Grid,
  TextField,
  Button,
  IconButton,
  Typography,
  MenuItem,
  Select,
  FormControl,
  InputLabel,
  FormHelperText,
  Paper,
  Alert
} from '@mui/material';
import { AddCircleOutline, RemoveCircleOutline } from '@mui/icons-material';

const PrescriptionForm = ({ patientId, doctorId, onSubmit, onCancel, initialData = null }) => {
  const [medications, setMedications] = useState(initialData?.medications || [
    { name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }
  ]);
  const [notes, setNotes] = useState(initialData?.notes || '');
  const [errors, setErrors] = useState({});

  // Reset form if initialData changes (e.g., for editing)
  useEffect(() => {
      if (initialData) {
          setMedications(initialData.medications || [{ name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
          setNotes(initialData.notes || '');
      } else {
          // Reset for new form
          setMedications([{ name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
          setNotes('');
      }
      setErrors({});
  }, [initialData]);

  const handleMedicationChange = (index, field, value) => {
    const updatedMedications = [...medications];
    updatedMedications[index][field] = value;
    setMedications(updatedMedications);
    // Clear errors for this field
    if (errors.medications?.[index]?.[field]) {
        setErrors(prev => ({
            ...prev,
            medications: {
                ...prev.medications,
                [index]: {
                    ...prev.medications?.[index],
                    [field]: null
                }
            }
        }));
    }
  };

  const addMedicationField = () => {
    setMedications([...medications, { name: '', dosage: '', form: '', frequency: '', duration: '', instructions: '' }]);
  };

  const removeMedicationField = (index) => {
    if (medications.length > 1) { // Keep at least one field
      const updatedMedications = medications.filter((_, i) => i !== index);
      setMedications(updatedMedications);
      // Adjust errors object if needed
      const updatedErrors = { ...errors };
       if (updatedErrors.medications) {
           delete updatedErrors.medications[index];
           // Re-index subsequent errors if necessary
           const reindexedErrors = {};
           Object.keys(updatedErrors.medications).forEach(errIndex => {
               if (parseInt(errIndex) > index) {
                   reindexedErrors[parseInt(errIndex) - 1] = updatedErrors.medications[errIndex];
               } else if (parseInt(errIndex) < index) {
                   reindexedErrors[errIndex] = updatedErrors.medications[errIndex];
               }
           });
           updatedErrors.medications = reindexedErrors;
       }
       setErrors(updatedErrors);
    }
  };

  const validateForm = () => {
      const newErrors = { medications: {} };
      let isValid = true;

      if (medications.length === 0) {
          newErrors.general = 'At least one medication is required.';
          isValid = false;
      }

      medications.forEach((med, index) => {
          if (!med.name.trim()) {
              if (!newErrors.medications[index]) newErrors.medications[index] = {};
              newErrors.medications[index].name = 'Name is required';
              isValid = false;
          }
          if (!med.frequency.trim()) {
              if (!newErrors.medications[index]) newErrors.medications[index] = {};
              newErrors.medications[index].frequency = 'Frequency is required';
              isValid = false;
          }
          // Add more validation rules as needed (e.g., dosage format)
      });

      setErrors(newErrors);
      return isValid;
  };

  const handleSubmit = (event) => {
    event.preventDefault();
    if (!validateForm()) {
        return;
    }

    const prescriptionData = {
      patientId,
      doctorId, // Ensure this is passed correctly or derived
      medications,
      notes: notes.trim(),
      // appointmentId: optionalAppointmentId // Pass if relevant
    };
    onSubmit(prescriptionData);
  };

  const medicationForms = [
      'Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other'
  ];

  return (
    <Box component="form" onSubmit={handleSubmit} noValidate>
      {medications.map((med, index) => (
        <Paper key={index} variant="outlined" sx={{ p: 2, mb: 2, position: 'relative' }}>
           {medications.length > 1 && (
              <IconButton
                size="small"
                onClick={() => removeMedicationField(index)}
                sx={{ position: 'absolute', top: 8, right: 8 }}
                color="error"
              >
                <RemoveCircleOutline />
              </IconButton>
            )}
            <Typography variant="subtitle2" sx={{ mb: 1 }}>Medication #{index + 1}</Typography>
          <Grid container spacing={2}>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                required
                fullWidth
                label="Medication Name"
                name={`medications[${index}].name`}
                value={med.name}
                onChange={(e) => handleMedicationChange(index, 'name', e.target.value)}
                size="small"
                error={!!errors.medications?.[index]?.name}
                helperText={errors.medications?.[index]?.name}
              />
            </Grid>
             <Grid item xs={6} sm={3} md={2}>
              <TextField
                fullWidth
                label="Dosage"
                name={`medications[${index}].dosage`}
                value={med.dosage}
                onChange={(e) => handleMedicationChange(index, 'dosage', e.target.value)}
                size="small"
                error={!!errors.medications?.[index]?.dosage}
                helperText={errors.medications?.[index]?.dosage}
              />
            </Grid>
            <Grid item xs={6} sm={3} md={2}>
                 <FormControl fullWidth size="small" error={!!errors.medications?.[index]?.form}>
                    <InputLabel>Form</InputLabel>
                    <Select
                        label="Form"
                        name={`medications[${index}].form`}
                        value={med.form}
                        onChange={(e) => handleMedicationChange(index, 'form', e.target.value)}
                    >
                         <MenuItem value=""><em>None</em></MenuItem>
                        {medicationForms.map(formOption => (
                            <MenuItem key={formOption} value={formOption}>{formOption}</MenuItem>
                        ))}
                    </Select>
                    {errors.medications?.[index]?.form && <FormHelperText>{errors.medications[index].form}</FormHelperText>}
                </FormControl>
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <TextField
                required
                fullWidth
                label="Frequency"
                name={`medications[${index}].frequency`}
                value={med.frequency}
                onChange={(e) => handleMedicationChange(index, 'frequency', e.target.value)}
                size="small"
                placeholder="e.g., Twice daily"
                error={!!errors.medications?.[index]?.frequency}
                helperText={errors.medications?.[index]?.frequency}
              />
            </Grid>
             <Grid item xs={6} sm={3} md={3}>
              <TextField
                fullWidth
                label="Duration"
                name={`medications[${index}].duration`}
                value={med.duration}
                onChange={(e) => handleMedicationChange(index, 'duration', e.target.value)}
                size="small"
                placeholder="e.g., 7 days"
                error={!!errors.medications?.[index]?.duration}
                helperText={errors.medications?.[index]?.duration}
              />
            </Grid>
            <Grid item xs={12} sm={9} md={9}>
              <TextField
                fullWidth
                label="Instructions"
                name={`medications[${index}].instructions`}
                value={med.instructions}
                onChange={(e) => handleMedicationChange(index, 'instructions', e.target.value)}
                size="small"
                placeholder="e.g., Take with food"
                error={!!errors.medications?.[index]?.instructions}
                helperText={errors.medications?.[index]?.instructions}
              />
            </Grid>
          </Grid>
        </Paper>
      ))}

      <Button
        type="button"
        startIcon={<AddCircleOutline />}
        onClick={addMedicationField}
        sx={{ mb: 2 }}
      >
        Add Another Medication
      </Button>

      <TextField
        fullWidth
        label="General Notes (Optional)"
        multiline
        rows={3}
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
        sx={{ mb: 2 }}
      />
      
      {errors.general && <Alert severity="error" sx={{ mb: 2 }}>{errors.general}</Alert>}

      <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1, mt: 2 }}>
        <Button onClick={onCancel}>Cancel</Button>
        <Button type="submit" variant="contained">
          {initialData ? 'Update Prescription' : 'Save Prescription'}
        </Button>
      </Box>
    </Box>
  );
};

export default PrescriptionForm; 