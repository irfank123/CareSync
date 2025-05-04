import React, { useState } from 'react';
import { Box, Button, Typography, Link, CircularProgress, Alert, Tooltip } from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { axiosInstance } from '../../services/api';
import { toast } from 'react-toastify';

const AppointmentMeetingLink = ({ appointment, onMeetingLinkGenerated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Check if appointment has a meeting link
  const hasMeetingLink = !!(appointment.googleMeetLink || appointment.videoConferenceLink);
  const meetingLink = appointment.googleMeetLink || appointment.videoConferenceLink;
  
  const handleGenerateMeetingLink = async () => {
    if (!appointment || !appointment._id) {
      toast.error('Appointment data is missing.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      // Call the backend endpoint to generate the meeting link
      const response = await axiosInstance.post(`/appointments/${appointment._id}/generate-meet-link`);
      
      if (response.data && response.data.success) {
        toast.success('Google Meet link generated successfully!');
        
        // Update the appointment data via the callback
        if (onMeetingLinkGenerated) {
          onMeetingLinkGenerated({
            ...appointment,
            googleMeetLink: response.data.data.meetLink,
            videoConferenceLink: response.data.data.meetLink,
            googleEventId: response.data.data.eventId
          });
        }
      } else {
        throw new Error(response.data.message || 'Failed to generate link');
      }
    } catch (err) {
      console.error('Error generating meeting link:', err);
      const errorMessage = err.response?.data?.message || err.message || 'An unexpected error occurred';
      setError(errorMessage);
      toast.error(`Error: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleCopyLink = () => {
    navigator.clipboard.writeText(meetingLink)
      .then(() => toast.success('Meeting link copied to clipboard'))
      .catch(() => toast.error('Failed to copy meeting link'));
  };
  
  return (
    <Box sx={{ mt: 2 }}>
      <Typography variant="subtitle1" gutterBottom>
        <VideoCallIcon sx={{ verticalAlign: 'middle', mr: 1 }} />
        Video Meeting
      </Typography>
      
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      )}
      
      {hasMeetingLink ? (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: 1 }}>
          <Typography 
            variant="body2" 
            component="div" 
            sx={{ 
              flexGrow: 1, 
              overflow: 'hidden', 
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              bgcolor: 'background.paper',
              p: 1,
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              maxWidth: { xs: '100%', sm: '70%' }
            }}
          >
            <Link 
              href={meetingLink} 
              target="_blank" 
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {meetingLink}
              <OpenInNewIcon fontSize="small" sx={{ ml: 0.5 }} />
            </Link>
          </Typography>
          
          <Tooltip title="Copy meeting link">
            <Button 
              variant="outlined" 
              startIcon={<ContentCopyIcon />}
              onClick={handleCopyLink}
              size="small"
            >
              Copy
            </Button>
          </Tooltip>
        </Box>
      ) : (
        <Box sx={{ mt: 1 }}>
          <Button
            variant="contained"
            startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VideoCallIcon />}
            onClick={handleGenerateMeetingLink}
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Generate Google Meet Link'}
          </Button>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
            Generate a Google Meet link for this virtual appointment
          </Typography>
        </Box>
      )}
    </Box>
  );
};

export default AppointmentMeetingLink; 