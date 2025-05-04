// src/config/auth0Config.mjs
import { ManagementClient } from 'auth0';
import dotenv from 'dotenv';

// Ensure environment variables are loaded
dotenv.config();

// Log environment variables for debugging
console.log('Auth0 Environment Variables:');
console.log('- AUTH0_DOMAIN:', process.env.AUTH0_DOMAIN ? 'Set' : 'Not set');
console.log('- AUTH0_CLIENT_ID:', process.env.AUTH0_CLIENT_ID ? 'Set' : 'Not set');
console.log('- AUTH0_CLIENT_SECRET:', process.env.AUTH0_CLIENT_SECRET ? 'Set' : 'Not set');
console.log('- AUTH0_CALLBACK_URL:', process.env.AUTH0_CALLBACK_URL || 'Using default');
console.log('- FRONTEND_URL:', process.env.FRONTEND_URL || 'Using default');

const requiredAuth0Config = ['AUTH0_DOMAIN', 'AUTH0_CLIENT_ID', 'AUTH0_CLIENT_SECRET'];
let missingConfig = [];

// Check for missing Auth0 configuration
requiredAuth0Config.forEach(configKey => {
  if (!process.env[configKey]) {
    missingConfig.push(configKey);
  }
});

// Log warning for missing config
if (missingConfig.length > 0) {
  console.warn(`⚠️ Missing Auth0 configuration: ${missingConfig.join(', ')}`);
  console.warn('OAuth authentication will not work properly without these environment variables.');
}

// Default callback URL for development
const defaultCallbackUrl = process.env.FRONTEND_URL 
  ? `${process.env.FRONTEND_URL}/auth/clinic/auth0/callback` 
  : 'http://localhost:5000/api/auth/clinic/auth0/callback';

// Provide actual values or clear placeholders
const auth0Config = {
  domain: process.env.AUTH0_DOMAIN || '',
  clientId: process.env.AUTH0_CLIENT_ID || '',
  clientSecret: process.env.AUTH0_CLIENT_SECRET || '',
  audience: process.env.AUTH0_AUDIENCE || '',
  
  // Configuration for different user roles in Auth0
  patientRole: process.env.AUTH0_PATIENT_ROLE || 'rol_patient',
  doctorRole: process.env.AUTH0_DOCTOR_ROLE || 'rol_doctor',
  
  // Allowed callback and logout URLs
  callbackUrls: [
    process.env.AUTH0_CALLBACK_URL || defaultCallbackUrl
  ],
  logoutUrls: [
    process.env.AUTH0_LOGOUT_URL || (process.env.FRONTEND_URL || 'http://localhost:3000')
  ]
};

// Log the configured callback URL
console.log('Auth0 callback URL:', auth0Config.callbackUrls[0]);

// Check if configuration is valid (non-empty values)
const isAuth0Configured = auth0Config.domain && auth0Config.clientId && auth0Config.clientSecret;

// Configure Auth0 Management API client
export const configureAuth0ManagementClient = () => {
  // Validate required configuration
  if (!isAuth0Configured) {
    console.error('❌ Missing required Auth0 configuration - cannot initialize Management API client');
    throw new Error('Auth0 configuration incomplete');
  }
  
  try {
    // Create Auth0 Management client
    const management = new ManagementClient({
      domain: auth0Config.domain,
      clientId: auth0Config.clientId,
      clientSecret: auth0Config.clientSecret,
      scope: 'read:users update:users create:users read:roles'
    });
    
    return {
      getUser: async (userId) => {
        return await management.users.get({ id: userId });
      },
      
      assignRoleToUser: async (userId, roleId) => {
        return await management.users.assignRoles({ id: userId }, { roles: [roleId] });
      },
      
      createUser: async (userData) => {
        return await management.users.create({
          email: userData.email,
          password: userData.password,
          connection: 'Username-Password-Authentication',
          name: `${userData.firstName} ${userData.lastName}`,
          given_name: userData.firstName,
          family_name: userData.lastName,
          metadata: {
            role: userData.role
          }
        });
      }
    };
  } catch (error) {
    console.error('❌ Failed to initialize Auth0 Management client:', error);
    throw error;
  }
};

// Export configuration and validation flag
export default {
  ...auth0Config,
  isConfigured: isAuth0Configured
};