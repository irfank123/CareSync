import React, { useState, useEffect } from 'react';
import { useNavigate, Link as RouterLink } from 'react-router-dom';
import {
  Container,
  Paper,
  TextField,
  Button,
  Typography,
  Box,
  Link,
  Alert,
  CircularProgress,
  Snackbar
} from '@mui/material';
import { toast } from 'react-toastify';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const navigate = useNavigate();
  const { login, isAuthenticated, user } = useAuth();
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    mfaCode: ''
  });
  const [errors, setErrors] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);
  const [loginAttempts, setLoginAttempts] = useState(0);
  const [mfaCodeSent, setMfaCodeSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // Clear error message when form data changes
  useEffect(() => {
    setErrorMessage('');
  }, [formData]);

  // Check if already authenticated
  useEffect(() => {
    console.log('[Login] Auth state check:', { isAuthenticated, user });
    if (isAuthenticated && user) {
      console.log('[Login] Already authenticated, redirecting to dashboard');
      
      // Redirect based on user role
      if (user.role === 'doctor') {
        navigate('/doctor-dashboard');
      } else if (user.role === 'patient') {
        navigate('/dashboard');
      } else {
        navigate('/');
      }
    }
  }, [isAuthenticated, user, navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.email) newErrors.email = 'Email is required';
    if (!formData.password) newErrors.password = 'Password is required';
    if (mfaRequired && !formData.mfaCode) newErrors.mfaCode = 'MFA code is required';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setIsLoading(true);
    try {
      // Add exponential backoff delay if there were previous failed attempts
      if (loginAttempts > 0) {
        const delay = Math.min(1000 * Math.pow(2, loginAttempts - 1), 30000);
        await new Promise(resolve => setTimeout(resolve, delay));
      }

      console.log('[Login] Submitting login form:', { 
        email: formData.email, 
        passwordLength: formData.password?.length,
        mfaRequired
      });

      // Use the context login function instead of direct API call
      const result = await login({
        email: formData.email,
        password: formData.password,
        ...(mfaRequired && { mfaCode: formData.mfaCode })
      });
      
      console.log('[Login] Login result:', result);
      
      if (result.success) {
        // Context will handle navigation and state updates
        console.log('[Login] Login successful');
      } else if (result.requiresMfa && !mfaRequired) {
        setMfaRequired(true);
        setMfaCodeSent(true);
        toast.info('MFA code has been sent to your email');
      } else if (result.error) {
        setErrorMessage(result.error);
        toast.error(result.error);
      }
    } catch (error) {
      console.error('[Login] Error during login:', error);
      setLoginAttempts(prev => prev + 1);
      
      if (error.response) {
        switch (error.response.status) {
          case 401:
            setErrorMessage('Invalid email or password');
            break;
          case 429:
            setErrorMessage('Too many login attempts. Please try again later.');
            break;
          case 403:
            setErrorMessage('Your account has been disabled. Please contact support.');
            break;
          default:
            setErrorMessage(error.response.data?.message || 'Login failed. Please try again.');
        }
      } else {
        setErrorMessage('Network error. Please check your connection and try again.');
      }
      
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container component="main" maxWidth="xs">
      <Box
        sx={{
          marginTop: 8,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
        }}
      >
        <Paper elevation={3} sx={{ p: 4, width: '100%' }}>
          <Typography component="h1" variant="h5" align="center" gutterBottom>
            Sign In
          </Typography>

          {errorMessage && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {errorMessage}
            </Alert>
          )}

          {mfaCodeSent && (
            <Alert severity="info" sx={{ mb: 2 }}>
              MFA code has been sent to your email
            </Alert>
          )}

          <Box component="form" onSubmit={handleSubmit} noValidate sx={{ mt: 1 }}>
            <TextField
              margin="normal"
              required
              fullWidth
              id="email"
              label="Email Address"
              name="email"
              autoComplete="email"
              autoFocus
              value={formData.email}
              onChange={handleInputChange}
              error={!!errors.email}
              helperText={errors.email}
              disabled={isLoading}
            />
            <TextField
              margin="normal"
              required
              fullWidth
              name="password"
              label="Password"
              type="password"
              id="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              error={!!errors.password}
              helperText={errors.password}
              disabled={isLoading}
            />

            {mfaRequired && (
              <TextField
                margin="normal"
                required
                fullWidth
                name="mfaCode"
                label="MFA Code"
                type="text"
                id="mfaCode"
                value={formData.mfaCode}
                onChange={handleInputChange}
                error={!!errors.mfaCode}
                helperText={errors.mfaCode}
                disabled={isLoading}
              />
            )}

            <Button
              type="submit"
              fullWidth
              variant="contained"
              sx={{ mt: 3, mb: 2 }}
              disabled={isLoading}
            >
              {isLoading ? <CircularProgress size={24} /> : 'Sign In'}
            </Button>

            <Box sx={{ mt: 2, display: 'flex', justifyContent: 'space-between' }}>
              <Link component={RouterLink} to="/forgot-password" variant="body2">
                Forgot password?
              </Link>
              <Link component={RouterLink} to="/register" variant="body2">
                {"Don't have an account? Sign Up"}
              </Link>
            </Box>
          </Box>
        </Paper>
      </Box>
    </Container>
  );
};

export default Login; 