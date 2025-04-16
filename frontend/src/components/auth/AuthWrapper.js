import React, { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { CircularProgress, Box } from '@mui/material';

// Public routes that don't require authentication
const publicRoutes = ['/', '/login', '/register', '/forgot-password', '/reset-password'];

const AuthWrapper = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  
  useEffect(() => {
    // Don't redirect during loading
    if (loading) return;
    
    const isPublicRoute = publicRoutes.some(route => 
      location.pathname === route || location.pathname.startsWith('/reset-password/'));
    
    console.log('Auth check:', { 
      path: location.pathname, 
      isPublicRoute, 
      isAuthenticated, 
      loading 
    });
    
    // Redirect to login if accessing protected route without authentication
    if (!isAuthenticated && !isPublicRoute) {
      console.log('Not authenticated, redirecting to login from', location.pathname);
      navigate('/login', { replace: true, state: { from: location.pathname } });
    }
    
    // Redirect to dashboard if accessing login/register while authenticated
    if (isAuthenticated && (location.pathname === '/login' || location.pathname === '/register')) {
      console.log('Already authenticated, redirecting to dashboard');
      navigate('/dashboard', { replace: true });
    }
  }, [isAuthenticated, loading, location.pathname, navigate]);
  
  // Show loading indicator while checking authentication
  if (loading) {
    return (
      <Box sx={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        <CircularProgress />
      </Box>
    );
  }
  
  return children;
};

export default AuthWrapper;