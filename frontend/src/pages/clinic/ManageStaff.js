import React from 'react';
import { Container, Typography, Box } from '@mui/material';

const ManageStaff = () => {
  return (
    <Container maxWidth="lg">
      <Box sx={{ mt: 4 }}>
        <Typography variant="h4" component="h1" gutterBottom>
          Manage Clinic Staff
        </Typography>
        <Typography variant="body1">
          (Content for viewing, adding, and managing staff members will go here)
        </Typography>
        {/* TODO: Add table/list of staff, add staff button, edit/remove options, etc. */}
      </Box>
    </Container>
  );
};

export default ManageStaff; 