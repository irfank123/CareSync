import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  TextField,
  Button,
  FormControlLabel,
  Switch,
  Divider,
} from '@mui/material';

const Settings = () => {
  const { user } = useAuth();

  const handleSubmit = (e) => {
    e.preventDefault();
    // Handle settings update
  };

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Typography variant="h4" component="h1" gutterBottom>
        Settings
      </Typography>

      <Grid container spacing={3}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Account Settings
            </Typography>
            <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
              <TextField
                fullWidth
                label="Email"
                defaultValue={user?.email}
                margin="normal"
                disabled
              />
              <TextField
                fullWidth
                label="Current Password"
                type="password"
                margin="normal"
              />
              <TextField
                fullWidth
                label="New Password"
                type="password"
                margin="normal"
              />
              <TextField
                fullWidth
                label="Confirm New Password"
                type="password"
                margin="normal"
              />
              <Button
                type="submit"
                variant="contained"
                color="primary"
                sx={{ mt: 3 }}
              >
                Update Password
              </Button>
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Notification Settings
            </Typography>
            <Box sx={{ mt: 2 }}>
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Email Notifications"
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Appointment Reminders"
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Medical Report Updates"
              />
              <Divider sx={{ my: 2 }} />
              <FormControlLabel
                control={<Switch defaultChecked />}
                label="Newsletter Subscription"
              />
            </Box>
          </Paper>
        </Grid>

        <Grid item xs={12}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom color="error">
              Danger Zone
            </Typography>
            <Box sx={{ mt: 2 }}>
              <Button variant="outlined" color="error">
                Delete Account
              </Button>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Settings; 