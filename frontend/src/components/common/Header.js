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
import AccountCircle from '@mui/icons-material/AccountCircle';

const Header = () => {
  const { user: clientUser, isAuthenticated: isClientAuthenticated, logout: clientLogout } = useAuth();
  const { clinicUser, isClinicAuthenticated, logoutClinic, loading: clinicLoading } = useClinicAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);
  const [clinicAnchorEl, setClinicAnchorEl] = React.useState(null);

  const handleClientMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClientClose = () => {
    setAnchorEl(null);
  };

  const handleClientLogout = async () => {
    await clientLogout();
    handleClientClose();
    navigate('/');
  };

  const handleClinicMenu = (event) => {
    setClinicAnchorEl(event.currentTarget);
  };

  const handleClinicClose = () => {
    setClinicAnchorEl(null);
  };

  const handleClinicLogout = async () => {
    await logoutClinic();
    handleClinicClose();
  };

  return (
    <AppBar position="static">
      <Toolbar>
        <Typography
          variant="h6"
          component={RouterLink}
          to="/"
          sx={{
            flexGrow: 1,
            textDecoration: 'none',
            color: 'inherit',
          }}
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
                aria-label="account of current clinic user"
                aria-controls="clinic-menu-appbar"
                aria-haspopup="true"
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
                id="clinic-menu-appbar"
                anchorEl={clinicAnchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(clinicAnchorEl)}
                onClose={handleClinicClose}
              >
                <MenuItem onClick={handleClinicLogout}>Logout Clinic</MenuItem>
              </Menu>
            </>
          ) : isClientAuthenticated && clientUser ? (
            <>
              <Button color="inherit" component={RouterLink} to={clientUser.role === 'doctor' ? '/doctor-dashboard' : '/dashboard'}>
                Dashboard
              </Button>
              <Button color="inherit" component={RouterLink} to="/appointments">
                Appointments
              </Button>
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
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
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                keepMounted
                transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                open={Boolean(anchorEl)}
                onClose={handleClientClose}
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