// src/config/auth0Config.mjs


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
    // ============== placeholder===============================
    
    return {
      getUser: async (userId) => {
        console.log(`[PLACEHOLDER] Getting Auth0 user: ${userId}`);
        return {}; //placeholder
      },
      
      assignRoleToUser: async (userId, role) => {
        console.log(`[PLACEHOLDER] Assigning role ${role} to user: ${userId}`);
        return true; //placeholder
      },
      
      createUser: async (userData) => {
        console.log(`[PLACEHOLDER] Creating Auth0 user: ${userData.email}`);
        return {}; //placeholder
      }
    };
  };
  
  export default auth0Config;