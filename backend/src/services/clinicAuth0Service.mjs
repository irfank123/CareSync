import { AuthenticationClient } from 'auth0';
import config from '../config/config.mjs';
import { User, Clinic } from '../models/index.mjs'; // May need these later
import jwt from 'jsonwebtoken'; // For generating local JWT

class ClinicAuth0Service {
  constructor() {
    if (!config.auth0.domain || !config.auth0.clientId || !config.auth0.clientSecret) {
      console.warn('Auth0 configuration missing. Clinic Auth0 features will not work.');
      this.auth0Client = null;
    } else {
      this.auth0Client = new AuthenticationClient({
        domain: config.auth0.domain,
        clientId: config.auth0.clientId,
        clientSecret: config.auth0.clientSecret,
      });
    }
  }

  /**
   * Generates the Auth0 Universal Login URL for clinic authentication.
   * Constructs the URL manually based on OAuth 2.0/OIDC spec.
   * @returns {string} The authorization URL
   */
  getAuthorizationUrl() {
    if (!config.auth0.domain || !config.auth0.clientId) {
      throw new Error('Auth0 domain or client ID is not configured.');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.auth0.clientId,
      redirect_uri: config.auth0.callbackUrls?.[0],
      scope: 'openid profile email',
      audience: config.auth0.audience,
    });

    const authorizationUrl = `https://${config.auth0.domain}/authorize?${params.toString()}`;
    
    return authorizationUrl;
  }

  /**
   * Handles the callback from Auth0, exchanges code for tokens, 
   * finds/creates a local user, and generates a local JWT.
   * @param {string} authorizationCode - The authorization code received from Auth0.
   * @returns {Object} { user, clinic, token } - Local user, associated clinic (if any), and local JWT token.
   */
  async handleCallback(authorizationCode) {
    if (!this.auth0Client) {
      throw new Error('Auth0 client is not configured.');
    }

    try {
      // 1. Exchange authorization code for tokens
      const tokenResponse = await this.auth0Client.oauth.codeGrant({
        code: authorizationCode,
        redirect_uri: config.auth0.callbackUrls?.[0],
      });

      const accessToken = tokenResponse.data.access_token;
      // const idToken = tokenResponse.data.id_token; // Can also decode ID token for user info

      // 2. Get user profile from Auth0
      const userInfo = await this.auth0Client.users.getInfo(accessToken);
      const profile = userInfo.data;

      if (!profile.email) {
        throw new Error('Email not available from Auth0 profile.');
      }

      // 3. Find or create local user based on Auth0 ID or email
      // Decision: Let's prioritize finding by auth0Id (sub) first, then email.
      // We assume a clinic admin user will exist in the User collection.
      // We need a way to designate these users as clinic admins.
      // Option A: A specific role like 'clinic_admin'
      // Option B: An association via the Clinic model (current setup uses clinic.adminUserId)

      let user = await User.findOne({ auth0Id: profile.sub });

      if (!user) {
        // User with this Auth0 ID doesn't exist, try finding by email
        user = await User.findOne({ email: profile.email });

        if (user) {
          // User exists (maybe created via regular signup?), link Auth0 ID
          user.auth0Id = profile.sub;
          // Ensure the role is appropriate. This is tricky.
          // If they logged in via Clinic Auth0, should we force their role?
          // For now, let's assume if found by email, they keep their existing role
          // but we add the auth0Id.
          user.emailVerified = profile.email_verified;
          await user.save();
        } else {
          // User doesn't exist at all, create a new one
          // Assign a default role - this needs careful consideration.
          // Should they be 'clinic_admin' automatically?
          // Or maybe a default role like 'pending_clinic_admin'?
          // Let's default to 'admin' for now, assuming this flow is only for clinic admins.
          // **ASSUMPTION**: A new user created via this Auth0 flow will have the 'admin' role
          // but will NOT be linked to a clinic initially (clinicId will be null).
          user = await User.create({
            auth0Id: profile.sub,
            email: profile.email,
            firstName: profile.given_name || profile.nickname || 'Clinic', // Get names from profile
            lastName: profile.family_name || 'Admin', 
            role: 'admin', // Assign 'admin' role - REVIEW THIS LOGIC
            emailVerified: profile.email_verified,
            // We don't have a password, as auth is via Auth0
          });
          // **NEXT STEP**: The frontend application (e.g., on the /clinic-dashboard) 
          // should prompt this user to either CREATE a new clinic profile or 
          // JOIN an existing one (e.g., using an invite code). 
          // This action would then update the user's clinicId.
        }
      }

      // 4. Find associated Clinic (if user is linked)
      // The user might not be linked to a clinic immediately after Auth0 signup
      let clinic = null;
      if (user.clinicId) {
        clinic = await Clinic.findById(user.clinicId);
      }

      // 5. Generate local JWT token for the session
      const localJwtPayload = {
        id: user._id,
        type: 'user', // Or maybe 'clinic_admin'? Let's stick to 'user' for now as per authMiddleware
        role: user.role,
        auth0Id: user.auth0Id, // Include Auth0 ID in local token
        clinicId: user.clinicId ? user.clinicId.toString() : undefined, // Include clinic ID if available
      };
      const localToken = jwt.sign(localJwtPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      return {
        user: user.toObject(), // Return plain object
        clinic: clinic ? clinic.toObject() : null,
        token: localToken,
      };

    } catch (error) {
      console.error('Auth0 callback handling error:', error.response?.data || error.message);
      if (error.response?.data?.error_description) {
         throw new Error(`Auth0 Error: ${error.response.data.error_description}`);
      } 
      throw new Error('Failed to handle Auth0 callback.');
    }
  }
}

export default new ClinicAuth0Service(); 