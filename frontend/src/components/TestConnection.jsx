import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { Box, Typography, Paper } from '@mui/material';

const TestConnection = () => {
  const [status, setStatus] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const testConnection = async () => {
      try {
        // Note: The health endpoint is at /health, not /api/health
        const response = await axios.get(`${process.env.REACT_APP_API_URL}/health`);
        setStatus(response.data);
        setError('');
      } catch (err) {
        setError(err.message || 'Failed to connect to backend');
        setStatus(null);
        console.error('Connection error:', err);
      }
    };

    testConnection();
  }, []);

  return (
    <Box sx={{ p: 4, maxWidth: 600, mx: 'auto' }}>
      <Typography variant="h4" gutterBottom>
        Backend Connection Test
      </Typography>
      
      {status && (
        <Paper sx={{ p: 3, mb: 2, bgcolor: 'success.light', color: 'success.contrastText' }}>
          <Typography variant="h6">Status: Connected</Typography>
          <Typography>Message: {status.message}</Typography>
          <Typography>Timestamp: {new Date(status.timestamp).toLocaleString()}</Typography>
        </Paper>
      )}
      
      {error && (
        <Paper sx={{ p: 3, bgcolor: 'error.light', color: 'error.contrastText' }}>
          <Typography variant="h6">Connection Failed</Typography>
          <Typography>{error}</Typography>
        </Paper>
      )}
    </Box>
  );
};

export default TestConnection; 