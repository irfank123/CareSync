import React from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import {
  AppBar,
  Toolbar,
  Typography,
  Button,
  Box,
  IconButton,
  Menu,
  MenuItem,
  Avatar,
} from '@mui/material';
import { useAuth } from '../../context/AuthContext';
import { useClinicAuth } from '../../context/ClinicAuthContext';
import MedicalNoteIcon from '@mui/icons-material/MedicalInformation';
import AccountCircle from '@mui/icons-material/AccountCircle';

const Header = () => {
  const { user: clientUser, isAuthenticated: isClientAuthenticated, logout: clientLogout } = useAuth();
  const { clinicUser, isClinicAuthenticated, logoutClinic, loading: clinicLoading } = useClinicAuth();
  const navigate = useNavigate();

  const [clientAnchorEl, setClientAnchorEl] = React.useState(null);
  const [clinicAnchorEl, setClinicAnchorEl] = React.useState(null);

  const handleClientMenu = (event) => setClientAnchorEl(event.currentTarget);
  const handleClientClose = () => setClientAnchorEl(null);
  const handleClientLogout = async () => {
    await clientLogout();
    handleClientClose();
    navigate('/');
  };

  const handleClinicMenu = (event) => setClinicAnchorEl(event.currentTarget);
  const handleClinicClose = () => setClinicAnchorEl(null);
  const handleClinicLogout = async () => {
    await logoutClinic();
    handleClinicClose();
  };

  const renderClientLinks = () => {
    if (!clientUser) return null;

    return (
      <>
        {clientUser.role !== 'patient' ? (
          <Button color="inherit" component={RouterLink} to={clientUser.role === 'doctor' ? '/doctor-dashboard' : '/dashboard'}>
            Dashboard
          </Button>
        ) : (
          <Button color="inherit" component={RouterLink} to="/my-dashboard">
            My Dashboard
          </Button>
        )}

        <Button color="inherit" component={RouterLink} to="/appointments">
          Appointments
        </Button>

        {clientUser.role === 'patient' && (
          <Button
            color="inherit"
            component={RouterLink}
            to="/medical-records"
            startIcon={<MedicalNoteIcon />}
          >
            Medical Records
          </Button>
        )}

        {['admin', 'doctor', 'staff'].includes(clientUser.role) && (
          <Button color="inherit" component={RouterLink} to="/patients">
            Patients
          </Button>
        )}
      </>
    );
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{ flexGrow: 1, textDecoration: 'none', color: 'inherit' }}
        >
          CareSync
        </Typography>

        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          {clinicLoading ? (
            <Typography variant="body2" color="inherit">Loading...</Typography>
          ) : isClinicAuthenticated && clinicUser ? (
            <>
              <Button color="inherit" component={RouterLink} to="/clinic-dashboard">
                Clinic Dashboard
              </Button>
              <IconButton
                size="large"
                aria-label="clinic user menu"
                onClick={handleClinicMenu}
                color="inherit"
              >
                {clinicUser.profileImageUrl ? (
                  <Avatar alt={clinicUser.firstName} src={clinicUser.profileImageUrl} sx={{ width: 32, height: 32 }} />
                ) : (
                  <AccountCircle />
                )}
              </IconButton>
              <Menu
                anchorEl={clinicAnchorEl}
                open={Boolean(clinicAnchorEl)}
                onClose={handleClinicClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem onClick={handleClinicLogout}>Logout Clinic</MenuItem>
              </Menu>
            </>
          ) : isClientAuthenticated && clientUser ? (
            <>
              {renderClientLinks()}
              <IconButton
                size="large"
                aria-label="client user menu"
                onClick={handleClientMenu}
                color="inherit"
              >
                <Avatar
                  alt={clientUser.firstName}
                  src={clientUser.profileImageUrl}
                  sx={{ width: 32, height: 32 }}
                />
              </IconButton>
              <Menu
                anchorEl={clientAnchorEl}
                open={Boolean(clientAnchorEl)}
                onClose={handleClientClose}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              >
                <MenuItem component={RouterLink} to="/profile" onClick={handleClientClose}>
                  Profile
                </MenuItem>
                <MenuItem component={RouterLink} to="/settings" onClick={handleClientClose}>
                  Settings
                </MenuItem>
                <MenuItem onClick={handleClientLogout}>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">
                Client Login
              </Button>
              <Button color="inherit" component={RouterLink} to="/register">
                Client Register
              </Button>
              <Button color="inherit" component={RouterLink} to="/">
                Clinic Portal
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header;