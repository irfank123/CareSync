import api from './api';

// Auth0 configuration
const auth0Config = {
  domain: process.env.REACT_APP_AUTH0_DOMAIN || 'caresync.us.auth0.com',
  clientId: process.env.REACT_APP_AUTH0_CLIENT_ID || 'your-auth0-client-id',
  redirectUri: process.env.REACT_APP_AUTH0_CALLBACK_URL || `${window.location.origin}/callback`,
  audience: process.env.REACT_APP_AUTH0_AUDIENCE || 'https://api.caresync.example.com',
  scope: 'openid profile email',
  responseType: 'code',
};

/**
 * Helper function to construct Auth0 URLs
 * @param {Object} params - Parameters to add to URL
 * @returns {string} - Full Auth0 URL
 */
const buildAuth0Url = (endpoint, params) => {
  const url = new URL(`https://${auth0Config.domain}/${endpoint}`);
  
  // Add default parameters
  url.searchParams.append('client_id', auth0Config.clientId);
  url.searchParams.append('redirect_uri', auth0Config.redirectUri);
  
  // Add custom parameters
  if (params) {
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });
  }
  
  return url.toString();
};

/**
 * Auth0 Service for handling clinic authentication
 */
const auth0Service = {
  // Redirect to Auth0 login page for clinics
  loginWithAuth0: () => {
    const loginUrl = buildAuth0Url('authorize', {
      response_type: auth0Config.responseType,
      scope: auth0Config.scope,
      audience: auth0Config.audience,
      connection: 'Username-Password-Authentication', // Default database connection
      screen_hint: 'login',
    });
    
    // Save the fact that we're authenticating a clinic
    localStorage.setItem('auth_type', 'clinic');
    
    // Redirect to Auth0
    window.location.href = loginUrl;
  },
  
  // Redirect to Auth0 signup page for clinics
  registerWithAuth0: () => {
    const signupUrl = buildAuth0Url('authorize', {
      response_type: auth0Config.responseType,
      scope: auth0Config.scope,
      audience: auth0Config.audience,
      connection: 'Username-Password-Authentication',
      screen_hint: 'signup',
    });
    
    // Save the fact that we're registering a clinic
    localStorage.setItem('auth_type', 'clinic');
    
    // Redirect to Auth0
    window.location.href = signupUrl;
  },
  
  // Handle Auth0 callback
  handleAuth0Callback: async (code) => {
    try {
      // Auth type should be stored in localStorage (clinic vs patient/doctor)
      const authType = localStorage.getItem('auth_type') || 'user';
      
      // Exchange code for token with backend
      const response = await api.post('/auth/auth0/callback', { 
        code,
        userType: authType,
      });
      
      // If successful, store token and user info
      if (response.data.token) {
        localStorage.setItem('token', response.data.token);
        localStorage.setItem('user', JSON.stringify(response.data.user));
        
        if (authType === 'clinic' && response.data.clinic) {
          localStorage.setItem('clinic', JSON.stringify(response.data.clinic));
        }
      }
      
      // Clear auth type
      localStorage.removeItem('auth_type');
      
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Auth0 callback handling error:', error);
      return {
        success: false,
        error: error.response?.data?.message || 'Error processing Auth0 login'
      };
    }
  },
  
  // Logout from Auth0
  logoutFromAuth0: () => {
    // First clear local storage
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('clinic');
    
    // Then redirect to Auth0 logout
    const logoutUrl = buildAuth0Url('v2/logout', {
      client_id: auth0Config.clientId,
      returnTo: window.location.origin,
    });
    
    window.location.href = logoutUrl;
  }
};

export default auth0Service; 