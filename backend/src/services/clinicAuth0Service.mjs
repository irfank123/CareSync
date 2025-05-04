import { AuthenticationClient } from 'auth0';
import config from '../config/config.mjs';
import { User, Clinic } from '../models/index.mjs'; // May need these later
import jwt from 'jsonwebtoken'; // For generating local JWT

class ClinicAuth0Service {
  constructor() {
    // Check if Auth0 is configured using the flag from config
    if (!config.auth0.isConfigured) {
      console.warn('❌ Auth0 configuration is incomplete. Clinic Auth0 features will not work.');
      this.auth0Client = null;
      return;
    }
    
    try {
      this.auth0Client = new AuthenticationClient({
        domain: config.auth0.domain,
        clientId: config.auth0.clientId,
        clientSecret: config.auth0.clientSecret,
      });
      console.log('✅ Auth0 client initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Auth0 client:', error);
      this.auth0Client = null;
    }
  }

  /**
   * Generates the Auth0 Universal Login URL for clinic authentication.
   * Constructs the URL manually based on OAuth 2.0/OIDC spec.
   * @returns {string} The authorization URL
   */
  getAuthorizationUrl() {
    if (!this.auth0Client) {
      throw new Error('Auth0 client is not initialized. Check your configuration.');
    }
    
    // Ensure we have a valid callback URL
    const callbackUrl = config.auth0.callbackUrls?.[0];
    if (!callbackUrl) {
      throw new Error('Auth0 callback URL is not configured.');
    }

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.auth0.clientId,
      redirect_uri: callbackUrl,
      scope: 'openid profile email',
      audience: config.auth0.audience || `https://${config.auth0.domain}/api/v2/`,
    });

    const authorizationUrl = `https://${config.auth0.domain}/authorize?${params.toString()}`;
    console.log('Generated Auth0 authorization URL:', authorizationUrl);
    
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

    if (!authorizationCode) {
      throw new Error('No authorization code provided');
    }

    try {
      console.log('Processing Auth0 callback with code:', authorizationCode.substring(0, 5) + '...');
      
      // Ensure we have a valid callback URL
      const callbackUrl = config.auth0.callbackUrls?.[0];
      if (!callbackUrl) {
        throw new Error('Auth0 callback URL is not configured.');
      }
      
      // 1. Exchange authorization code for tokens
      const tokenResponse = await this.auth0Client.oauth.codeGrant({
        code: authorizationCode,
        redirect_uri: callbackUrl,
      });

      if (!tokenResponse || !tokenResponse.data) {
        throw new Error('Invalid token response from Auth0');
      }

      const accessToken = tokenResponse.data.access_token;
      if (!accessToken) {
        throw new Error('No access token returned from Auth0');
      }

      // 2. Get user profile from Auth0
      const userInfo = await this.auth0Client.users.getInfo(accessToken);
      const profile = userInfo.data;

      if (!profile || !profile.email) {
        throw new Error('Email not available from Auth0 profile.');
      }

      console.log('Retrieved Auth0 profile for email:', profile.email);

      // 3. Find or create local user based on Auth0 ID or email
      let user = await User.findOne({ auth0Id: profile.sub });

      if (!user) {
        // User with this Auth0 ID doesn't exist, try finding by email
        user = await User.findOne({ email: profile.email });

        if (user) {
          // User exists (maybe created via regular signup?), link Auth0 ID
          user.auth0Id = profile.sub;
          user.emailVerified = profile.email_verified;
          await user.save();
          console.log('Linked existing user to Auth0 ID:', user._id);
        } else {
          // User doesn't exist at all, create a new one
          user = await User.create({
            auth0Id: profile.sub,
            email: profile.email,
            firstName: profile.given_name || profile.nickname || 'Clinic', 
            lastName: profile.family_name || 'Admin', 
            role: 'admin', // Assign 'admin' role
            emailVerified: profile.email_verified,
          });
          console.log('Created new user from Auth0 profile:', user._id);
        }
      } else {
        console.log('Found existing user with Auth0 ID:', user._id);
      }

      // 4. Find associated Clinic (if user is linked)
      let clinic = null;
      if (user.clinicId) {
        clinic = await Clinic.findById(user.clinicId);
        console.log('Found associated clinic:', clinic?._id || 'None');
      }

      // 5. Generate local JWT token for the session
      const localJwtPayload = {
        id: user._id,
        type: 'user',
        role: user.role,
        auth0Id: user.auth0Id,
        clinicId: user.clinicId ? user.clinicId.toString() : undefined,
      };
      
      const localToken = jwt.sign(localJwtPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      return {
        user: user.toObject(),
        clinic: clinic ? clinic.toObject() : null,
        token: localToken,
      };

    } catch (error) {
      console.error('Auth0 callback handling error:', error.response?.data || error.message);
      if (error.response?.data?.error_description) {
         throw new Error(`Auth0 Error: ${error.response.data.error_description}`);
      } 
      throw new Error('Failed to handle Auth0 callback: ' + (error.message || 'Unknown error'));
    }
  }
}

export default new ClinicAuth0Service(); 