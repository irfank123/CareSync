import React, { useState, useEffect } from 'react';
import { Box, Button, Typography, Link, CircularProgress, Alert, Tooltip } from '@mui/material';
import VideoCallIcon from '@mui/icons-material/VideoCall';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import { axiosInstance } from '../../services/api';
import { toast } from 'react-toastify';
import { useAuth } from '../../context/AuthContext';

const AppointmentMeetingLink = ({ appointment, onMeetingLinkGenerated }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [currentMeetingLink, setCurrentMeetingLink] = useState(appointment?.googleMeetLink || appointment?.videoConferenceLink || null);

  useEffect(() => {
    setCurrentMeetingLink(appointment?.googleMeetLink || appointment?.videoConferenceLink || null);
  }, [appointment?.googleMeetLink, appointment?.videoConferenceLink]);

  const isDoctor = user?.role === 'doctor';
  const hasExistingLink = !!currentMeetingLink;
  
  const handleGenerateMeetingLink = async () => {
    if (!appointment || !appointment._id) {
      toast.error('Appointment data is missing.');
      return;
    }
    
    setLoading(true);
    setError(null);
    
    try {
      const response = await axiosInstance.post(`/appointments/${appointment._id}/generate-meet-link`);
      
      if (response.data && response.data.success) {
        const newLink = response.data.data.meetLink;
        const newEventId = response.data.data.eventId;
        toast.success(hasExistingLink ? 'Google Meet link regenerated successfully!' : 'Google Meet link generated successfully!');
        setCurrentMeetingLink(newLink);
        
        if (onMeetingLinkGenerated) {
          onMeetingLinkGenerated({
            ...appointment,
            googleMeetLink: newLink,
            videoConferenceLink: newLink,
            googleEventId: newEventId
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
    if (!currentMeetingLink) return;
    navigator.clipboard.writeText(currentMeetingLink)
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
      
      {isDoctor && (
        <Box sx={{ mt: 1, display: 'flex', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
           <Button
              variant="contained"
              startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <VideoCallIcon />}
              onClick={handleGenerateMeetingLink}
              disabled={loading}
            >
              {loading ? 'Generating...' : (hasExistingLink ? 'Regenerate Google Meet Link' : 'Generate Google Meet Link')}
            </Button>
           {hasExistingLink && (
               <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                  (Re)generates a new link, replacing the existing one.
               </Typography>
           )}
        </Box>
      )}

      {currentMeetingLink && (
        <Box sx={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 1, mt: isDoctor ? 2 : 1 }}>
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
              href={currentMeetingLink} 
              target="_blank" 
              rel="noopener noreferrer"
              sx={{ display: 'inline-flex', alignItems: 'center' }}
            >
              {currentMeetingLink}
              <OpenInNewIcon fontSize="small" sx={{ ml: 0.5 }} />
            </Link>
          </Typography>
          
          <Tooltip title="Copy meeting link">
            <Button variant="outlined" startIcon={<ContentCopyIcon />} onClick={handleCopyLink} size="small" >
              Copy
            </Button>
          </Tooltip>
        </Box>
      )}

    </Box>
  );
};

export default AppointmentMeetingLink; 