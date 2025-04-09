import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Box,
  Container,
  Typography,
  Paper,
  Grid,
  Avatar,
  Button,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import { Edit as EditIcon } from '@mui/icons-material';

const Profile = () => {
  const { user } = useAuth();

  return (
    <Container maxWidth="lg" sx={{ mt: 4, mb: 4 }}>
      <Grid container spacing={3}>
        {/* Profile Summary */}
        <Grid item xs={12} md={4}>
          <Paper sx={{ p: 3, textAlign: 'center' }}>
            <Avatar
              src={user?.picture}
              alt={user?.name}
              sx={{ width: 120, height: 120, mx: 'auto', mb: 2 }}
            />
            <Typography variant="h5" gutterBottom>
              {user?.name}
            </Typography>
            <Typography color="text.secondary" gutterBottom>
              {user?.email}
            </Typography>
            <Button
              variant="outlined"
              startIcon={<EditIcon />}
              sx={{ mt: 2 }}
              fullWidth
            >
              Edit Profile
            </Button>
          </Paper>
        </Grid>

        {/* Profile Details */}
        <Grid item xs={12} md={8}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" gutterBottom>
              Personal Information
            </Typography>
            <List>
              <ListItem>
                <ListItemText
                  primary="Full Name"
                  secondary={user?.name || 'Not provided'}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Email"
                  secondary={user?.email || 'Not provided'}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Phone Number"
                  secondary={user?.phone || 'Not provided'}
                />
              </ListItem>
              <Divider />
              <ListItem>
                <ListItemText
                  primary="Address"
                  secondary={user?.address || 'Not provided'}
                />
              </ListItem>
            </List>

            <Box sx={{ mt: 4 }}>
              <Typography variant="h6" gutterBottom>
                Medical Information
              </Typography>
              <List>
                <ListItem>
                  <ListItemText
                    primary="Blood Type"
                    secondary={user?.bloodType || 'Not provided'}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Allergies"
                    secondary={user?.allergies || 'None'}
                  />
                </ListItem>
                <Divider />
                <ListItem>
                  <ListItemText
                    primary="Medical Conditions"
                    secondary={user?.conditions || 'None'}
                  />
                </ListItem>
              </List>
            </Box>
          </Paper>
        </Grid>
      </Grid>
    </Container>
  );
};

export default Profile; 