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
import MedicalServicesIcon from '@mui/icons-material/MedicalServices';
import MedicalNoteIcon from '@mui/icons-material/MedicalInformation';

const Header = () => {
  const { user, isAuthenticated, logout } = useAuth();
  const navigate = useNavigate();
  const [anchorEl, setAnchorEl] = React.useState(null);

  const handleMenu = (event) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleLogout = async () => {
    await logout();
    handleClose();
    navigate('/');
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
          {isAuthenticated ? (
            <>
              {user && (
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  {/* Navigation Links based on Role */}
                  {user.role !== 'patient' && (
                    <Button color="inherit" component={RouterLink} to="/dashboard">Dashboard</Button>
                  )}
                  {user.role === 'patient' && (
                    <Button color="inherit" component={RouterLink} to="/my-dashboard">My Dashboard</Button>
                  )}
                  
                  <Button color="inherit" component={RouterLink} to="/appointments">Appointments</Button>

                  {/* Show Medical Records link for patients */} 
                  {user.role === 'patient' && (
                      <Button 
                        color="inherit" 
                        component={RouterLink} 
                        to="/medical-records"
                        startIcon={<MedicalNoteIcon />}
                      >
                        Medical Records
                      </Button>
                  )}

                  {/* Show Patients link for admin, doctor, staff */} 
                  {['admin', 'doctor', 'staff'].includes(user.role) && (
                      <Button color="inherit" component={RouterLink} to="/patients">Patients</Button>
                  )}
                </Box>
              )}
              <IconButton
                size="large"
                aria-label="account of current user"
                aria-controls="menu-appbar"
                aria-haspopup="true"
                onClick={handleMenu}
                color="inherit"
              >
                <Avatar
                  alt={user?.name}
                  src={user?.picture}
                  sx={{ width: 32, height: 32 }}
                />
              </IconButton>
              <Menu
                id="menu-appbar"
                anchorEl={anchorEl}
                anchorOrigin={{
                  vertical: 'bottom',
                  horizontal: 'right',
                }}
                keepMounted
                transformOrigin={{
                  vertical: 'top',
                  horizontal: 'right',
                }}
                open={Boolean(anchorEl)}
                onClose={handleClose}
              >
                <MenuItem component={RouterLink} to="/profile" onClick={handleClose}>
                  Profile
                </MenuItem>
                <MenuItem component={RouterLink} to="/settings" onClick={handleClose}>
                  Settings
                </MenuItem>
                <MenuItem onClick={handleLogout}>Logout</MenuItem>
              </Menu>
            </>
          ) : (
            <>
              <Button color="inherit" component={RouterLink} to="/login">
                Login
              </Button>
              <Button color="inherit" component={RouterLink} to="/register">
                Register
              </Button>
            </>
          )}
        </Box>
      </Toolbar>
    </AppBar>
  );
};

export default Header; 