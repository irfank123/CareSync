// src/config/auth0Config.mjs
import { ManagementClient } from 'auth0';


const auth0Config = {
    domain: process.env.AUTH0_DOMAIN,
    clientId: process.env.AUTH0_CLIENT_ID,
    clientSecret: process.env.AUTH0_CLIENT_SECRET,
    audience: process.env.AUTH0_AUDIENCE || 'https://api.caresync.example.com',
    
    //configuration for different user roles in Auth0
    patientRole: process.env.AUTH0_PATIENT_ROLE || 'rol_patient',
    doctorRole: process.env.AUTH0_DOCTOR_ROLE || 'rol_doctor',
    
    //allowed callback and logout URLs
    callbackUrls: [
      process.env.AUTH0_CALLBACK_URL || 'http://localhost:3000/callback'
    ],
    logoutUrls: [
      process.env.AUTH0_LOGOUT_URL || 'http://localhost:3000'
    ]
  };
  
  
    //configure Auth0 Management API client
    export const configureAuth0ManagementClient = () => {
      // Validate required configuration
      if (!auth0Config.domain || !auth0Config.clientId || !auth0Config.clientSecret) {
        console.error('Missing required Auth0 configuration');
        throw new Error('Auth0 configuration incomplete');
      }
      
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
    };
  
  export default auth0Config;