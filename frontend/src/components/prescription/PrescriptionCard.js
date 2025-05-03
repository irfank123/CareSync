import React from 'react';
import {
  Paper,
  Typography,
  Box,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
  IconButton,
  Tooltip
} from '@mui/material';
import { CalendarMonth, Healing, Notes, CheckCircle, Cancel, AccessTime } from '@mui/icons-material'; // Example icons
import { format } from 'date-fns';

const PrescriptionCard = ({ prescription }) => {

  const getStatusChip = (status) => {
    const statusProps = {
      active: { color: 'success', icon: <CheckCircle fontSize="small" /> },
      cancelled: { color: 'error', icon: <Cancel fontSize="small" /> },
      completed: { color: 'info', icon: <CheckCircle fontSize="small" /> }, // Or use a different icon/color
    };
    const { color, icon } = statusProps[status] || { color: 'default', icon: <AccessTime fontSize="small" /> };
    return (
      <Chip
        icon={icon}
        label={status ? status.charAt(0).toUpperCase() + status.slice(1) : 'Unknown'}
        color={color}
        size="small"
        sx={{ ml: 1 }}
      />
    );
  };

  if (!prescription) {
    return null;
  }

  return (
    <Paper variant="outlined" sx={{ p: 2, mb: 2 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <CalendarMonth fontSize="small" color="action" />
            <Typography variant="subtitle1" fontWeight="medium">
            Issued: {prescription.issueDate ? format(new Date(prescription.issueDate), 'MM/dd/yyyy') : 'N/A'}
            </Typography>
            {getStatusChip(prescription.status)}
        </Box>
        {/* Add action icons here if needed - e.g., View Details, Cancel */}
        {/* <Tooltip title="Cancel Prescription">
            <IconButton size="small" color="error" onClick={() => onCancel(prescription._id)}>
                <Cancel />
            </IconButton>
        </Tooltip> */}
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        Prescribed by: {prescription.doctorName || 'Unknown Doctor'}
      </Typography>
      
      <Divider sx={{ my: 1 }} />

      <Typography variant="subtitle2" gutterBottom>Medications:</Typography>
      <List dense disablePadding>
        {prescription.medications && prescription.medications.length > 0 ? (
          prescription.medications.map((med, index) => (
            <ListItem key={index} sx={{ pl: 1 }}>
              <ListItemText
                primary={`${med.name} ${med.dosage || ''} ${med.form || ''}`}
                secondary={`${med.frequency} ${med.duration ? `- ${med.duration}` : ''} ${med.instructions ? `- ${med.instructions}` : ''}`}
                primaryTypographyProps={{ variant: 'body2' }}
                secondaryTypographyProps={{ variant: 'caption' }}
              />
            </ListItem>
          ))
        ) : (
          <ListItem>
            <ListItemText primary="No medications listed." primaryTypographyProps={{ variant: 'body2' }} />
          </ListItem>
        )}
      </List>

      {prescription.notes && (
          <Box sx={{ mt: 1, pt: 1, borderTop: '1px dashed grey' }}>
            <Typography variant="caption" display="block" gutterBottom>Notes:</Typography>
            <Typography variant="body2">{prescription.notes}</Typography>
        </Box>
      )}
    </Paper>
  );
};

export default PrescriptionCard; 