import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  Grid
} from '@mui/material';
import {
  CalendarMonth,
  Healing,
  Notes,
  CheckCircle,
  Cancel,
  AccessTime,
  Person,
  Medication
} from '@mui/icons-material';
import { format, isValid, parseISO } from 'date-fns';

const formatFrequency = (freq) => {
  if (!freq) return 'Frequency not specified';
  const parts = freq.trim().split(/\s*-\s*/);
  if (parts.length === 3 && parts.every(p => /^\d+$/.test(p))) {
    return `Dosage Schedule: ${parts[0]} morning, ${parts[1]} afternoon, ${parts[2]} evening`;
  }
  return `Frequency: ${freq}`;
};

const PrescriptionCard = ({ prescription }) => {

  const getStatusChip = (status) => {
    const statusProps = {
      active: { color: 'success', icon: <CheckCircle fontSize="small" /> },
      cancelled: { color: 'error', icon: <Cancel fontSize="small" /> },
      completed: { color: 'info', icon: <CheckCircle fontSize="small" /> },
    };
    const { color, icon } = statusProps[status?.toLowerCase()] || { color: 'default', icon: <AccessTime fontSize="small" /> };
    return (
      <Chip
        icon={icon}
        label={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        color={color}
        size="small"
        variant="outlined"
      />
    );
  };
  
  const formatDateSafe = (dateString) => {
      if (!dateString) return 'N/A';
      try {
          const date = parseISO(dateString);
          if (isValid(date)) {
              return format(date, 'MM/dd/yyyy');
          }
          const fallbackDate = new Date(dateString);
          if (isValid(fallbackDate)) {
              return format(fallbackDate, 'MM/dd/yyyy');
          }
      } catch (e) {
          console.error("Error parsing date:", dateString, e);
      }
      return 'Invalid Date';
  };

  if (!prescription) {
    return <Paper variant="outlined" elevation={1} sx={{ p: 2, mb: 2, backgroundColor: 'grey.50' }}><Typography sx={{ fontStyle: 'italic', color: 'text.secondary'}}>No prescription data available.</Typography></Paper>;
  }

  const doctorName = prescription.doctorName ? 
    (prescription.doctorName.toLowerCase().startsWith('dr.') ? prescription.doctorName : `Dr. ${prescription.doctorName}`)
    : 'Unknown Doctor';

  return (
    <Paper variant="outlined" elevation={1} sx={{ p: 2.5, mb: 2, borderRadius: 2, backgroundColor: '#fafafa' }}>
        <Grid container spacing={1} alignItems="center" sx={{ mb: 2 }}>
            <Grid item xs={12} sm={5} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Person fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary" noWrap>
                    {doctorName}
                </Typography>
            </Grid>
            
            <Grid item xs={7} sm={4} sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <CalendarMonth fontSize="small" sx={{ color: 'text.secondary' }} />
                <Typography variant="body2" color="text.secondary">
                    Issued:
                </Typography>
                <Typography variant="body2" fontWeight="500" sx={{ ml: 0.5 }}>
                   {formatDateSafe(prescription.issueDate)}
                </Typography>
            </Grid>
            
            <Grid item xs={5} sm={3} sx={{ display: 'flex', alignItems: 'center', justifyContent: { xs: 'flex-end', sm: 'flex-end' } }}>
                {getStatusChip(prescription.status)}
            </Grid>
        </Grid>
      
      <Divider sx={{ my: 2 }} />

      <Typography variant="subtitle1" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, fontWeight: '500', mb: 1.5 }}>
        <Medication fontSize='small' color="primary"/> Medications
      </Typography>
      <List dense disablePadding sx={{ pl: 1.5 }}>
        {prescription.medications && prescription.medications.length > 0 ? (
          prescription.medications.map((med, index) => (
            <ListItem key={index} disableGutters sx={{ alignItems: 'flex-start', mb: 1 }}>
              <ListItemIcon sx={{ minWidth: '30px', mt: 0.5 }}>
                <Medication fontSize="small" color="action" />
              </ListItemIcon>
              <ListItemText
                primary={`${med.name || 'Unnamed Medication'} (${med.dosage || 'N/A'})${med.form ? ` - ${med.form}` : ''}`}
                secondary={
                  <Box component="span" sx={{ display: 'block', mt: 0.5 }}>
                    <Typography variant="caption" display="block" color="text.secondary">
                        {formatFrequency(med.frequency)}
                    </Typography>
                    {med.duration && 
                        <Typography variant="caption" display="block" color="text.secondary">Duration: {med.duration}</Typography>
                    }
                    {med.instructions && 
                        <Typography variant="caption" display="block" color="text.secondary">Instructions: {med.instructions}</Typography>
                    }
                  </Box>
                }
                primaryTypographyProps={{ variant: 'body1', fontWeight: '500' }}
                secondaryTypographyProps={{ variant: 'caption', component: 'div' }}
              />
            </ListItem>
          ))
        ) : (
          <ListItem disableGutters>
            <ListItemText primary="No medications listed." primaryTypographyProps={{ variant: 'body2', sx:{ fontStyle: 'italic', color: 'text.secondary' } }} />
          </ListItem>
        )}
      </List>

      {prescription.notes && (
          <Box sx={{ mt: 2.5, pt: 1.5, pb: 1.5, pl: 2, pr: 2, borderTop: '1px solid', borderColor: 'divider', backgroundColor: 'grey.100', borderRadius: 1 }}>
            <Typography variant="subtitle2" gutterBottom sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1, fontWeight: '500'}}>
              <Notes fontSize='small' /> Prescriber Notes
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ pl: 0 }}>{prescription.notes}</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PrescriptionCard; 