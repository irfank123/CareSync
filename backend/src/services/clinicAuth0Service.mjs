import { AuthenticationClient, ManagementClient } from 'auth0';
import loadAndValidateConfig from '../config/config.mjs';
import { User, Clinic } from '../models/index.mjs'; // May need these later
import jwt from 'jsonwebtoken'; // For generating local JWT
import fetch from 'node-fetch'; // Add this import
import crypto from 'crypto'; // Add this import for crypto

const config = loadAndValidateConfig();

class ClinicAuth0Service {
  constructor() {
    this.config = config.auth0;
    this.managementClient = null;
    this.authClient = null; // Add auth client

    // Initialize clients only if config is valid
    if (this.config && this.config.domain && this.config.clientId && this.config.clientSecret) {
        try {
            // Initialize Management Client for user management operations
            this.managementClient = new ManagementClient({
                domain: this.config.domain,
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret,
                // scope: "read:users update:users" // Add scopes if needed
            });
            
            // Initialize Authentication Client for auth flows (like code exchange)
            this.authClient = new AuthenticationClient({
                domain: this.config.domain,
                clientId: this.config.clientId,
                clientSecret: this.config.clientSecret
            });
            
            console.log('✅ Auth0 Management Client initialized successfully.');
        } catch (error) {
             console.error('❌ Failed to initialize Auth0 Clients:', error);
             // Handle initialization failure
             this.managementClient = null;
             this.authClient = null;
        }
    } else {
      console.warn('❌ Auth0 configuration is incomplete or invalid. Auth0 clients not initialized.');
      this.managementClient = null;
      this.authClient = null;
    }
  }

  // Method to check if the client was initialized successfully
  isInitialized() {
      return !!this.managementClient && !!this.authClient;
  }

  /**
   * Exchange authorization code for tokens directly via Auth0 token endpoint
   * @param {string} code The authorization code
   * @param {string} redirectUri The callback URL
   * @returns {Promise<Object>} The token response
   */
  async exchangeCodeForTokens(code, redirectUri) {
    if (!code || !redirectUri) {
      throw new Error('Code and redirect URI are required to exchange for tokens');
    }

    const tokenUrl = `https://${this.config.domain}/oauth/token`;
    
    // Check if redirectUri is already fully qualified, if not, ensure it matches exactly what Auth0 expects
    let finalRedirectUri = redirectUri;
    if (!redirectUri.startsWith('http')) {
      console.log('[DEBUG] Redirect URI is not fully qualified, needs to be normalized');
      // Use stored callback URL from config if possible
      finalRedirectUri = this.config.callbackUrl;
      console.log('[DEBUG] Using config.callbackUrl instead:', finalRedirectUri);
    }
    
    console.log('[DEBUG] Exchanging code with Auth0 using these parameters:', {
      tokenUrl,
      clientId: this.config.clientId,
      redirectUri: finalRedirectUri,
      codeLength: code?.length || 0
    });
    
    const payload = {
      grant_type: 'authorization_code',
      client_id: this.config.clientId,
      client_secret: this.config.clientSecret,
      code: code,
      redirect_uri: finalRedirectUri
    };
    
    try {
      const response = await fetch(tokenUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('[DEBUG] Token exchange error:', errorData);
        console.error('[DEBUG] Response status:', response.status, response.statusText);
        
        // Check for "Invalid authorization code" error
        if (errorData.error_description && errorData.error_description.includes('Invalid authorization code')) {
          console.log('[DEBUG] Invalid authorization code - checking if this is a code reuse situation');
          
          // Check DB for recent user with matching auth0Id
          // This is a simplified example - the token would be part of an id_token
          // In a real implementation, you'd need to decode the token from a previous successful attempt
          
          // For now, return a special error that the frontend can handle
          throw new Error('Code reuse detected - check if user is already authenticated');
        }
        
        throw new Error(`Token exchange failed: ${errorData.error_description || response.statusText}`);
      }
      
      const data = await response.json();
      console.log('[DEBUG] Token exchange successful, received access_token and id_token');
      return data;
    } catch (error) {
      console.error('[DEBUG] Error exchanging code for tokens:', error);
      throw new Error(`Error exchanging code for tokens: ${error.message}`);
    }
  }

  /**
   * Generates the Auth0 Universal Login URL for clinic authentication.
   * Constructs the URL manually based on OAuth 2.0/OIDC spec.
   * @returns {string} The authorization URL
   */
  getAuthorizationUrl() {
    if (!this.isInitialized()) {
      throw new Error('Auth0 clients are not initialized. Check your configuration.');
    }
    
    // Ensure we have a valid callback URL
    const callbackUrl = this.config.callbackUrl;
    if (!callbackUrl) {
      throw new Error('Auth0 callback URL is not configured.');
    }
    
    console.log('[DEBUG] Using Auth0 Callback URL for redirect_uri:', callbackUrl);

    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.config.clientId,
      redirect_uri: callbackUrl,
      scope: 'openid profile email',
      audience: this.config.audience || `https://${this.config.domain}/api/v2/`,
    });

    const authorizationUrl = `https://${this.config.domain}/authorize?${params.toString()}`;
    console.log('Generated Auth0 authorization URL:', authorizationUrl);
    
    return authorizationUrl;
  }

  /**
   * Handles the callback from Auth0, exchanges code for tokens, 
   * finds/creates a local user, and generates a local JWT.
   * @param {string} authorizationCode - The authorization code received from Auth0.
   * @param {string} fullRequestUrl - The full request URL (optional, for debugging).
   * @returns {Object} { user, clinic, token } - Local user, associated clinic (if any), and local JWT token.
   */
  async handleCallback(authorizationCode, fullRequestUrl) {
    if (!this.isInitialized()) {
      throw new Error('Auth0 clients are not configured.');
    }

    if (!authorizationCode) {
      throw new Error('No authorization code provided');
    }

    try {
      console.log('Processing Auth0 callback with code:', authorizationCode.substring(0, 5) + '...');
      
      // Ensure we have a valid callback URL
      const callbackUrl = this.config.callbackUrl;
      if (!callbackUrl) {
        throw new Error('Auth0 callback URL is not configured.');
      }
      
      console.log('[DEBUG] Configured callback URL:', callbackUrl);
      if (fullRequestUrl) {
        console.log('[DEBUG] Full request URL for reference:', fullRequestUrl);
      }
      
      // 1. Exchange authorization code for tokens using direct implementation
      const tokenResponse = await this.exchangeCodeForTokens(authorizationCode, callbackUrl);
      
      console.log('[DEBUG] Token response received:', !!tokenResponse);

      // Validate token response
      if (!tokenResponse || !tokenResponse.id_token) {
        console.error('[DEBUG] Invalid token response:', tokenResponse);
        throw new Error('No ID token returned from Auth0');
      }

      const idToken = tokenResponse.id_token;

      // 2. Get user profile from the decoded ID token
      const profile = jwt.decode(idToken);

      if (!profile || !profile.email) {
        console.error('[DEBUG] Email missing from decoded ID token:', profile);
        throw new Error('Email not available from Auth0 profile (ID token).');
      }
      
      if (!profile.sub) {
         console.error('[DEBUG] Subject (sub) missing from decoded ID token:', profile);
         throw new Error('User identifier (sub) missing from Auth0 profile (ID token).');
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
            // For Auth0 users, we set a randomly generated password which won't actually be used
            // since Auth0 handles authentication. This helps with any lingering validation issues.
            passwordHash: crypto.randomBytes(32).toString('hex')
          });
          console.log('Created new user from Auth0 profile:', user._id);
        }
      } else {
        console.log('Found existing user with Auth0 ID:', user._id);
      }

      // 4. Find associated Clinic IF user.clinicId exists
      let clinic = null;
      if (user.clinicId) {
        try {
           clinic = await Clinic.findById(user.clinicId);
           console.log('Found associated clinic:', clinic?._id || 'None (ID existed but lookup failed)');
        } catch (dbError) {
           console.error(`Error fetching clinic with ID ${user.clinicId}:`, dbError);
           // Clinic fetch failed, proceed without clinic info
           clinic = null;
        }
      } else {
         console.log('User does not have a clinicId.');
      }

      // 5. Generate local JWT token for the session
      const localJwtPayload = {
        id: user._id,
        type: 'user',
        role: user.role, // Role comes from User record
        auth0Id: user.auth0Id,
        // Only include clinicId in JWT if a valid clinic was actually found
        clinicId: clinic ? clinic._id.toString() : undefined,
      };

      const localToken = jwt.sign(localJwtPayload, config.jwt.secret, {
        expiresIn: config.jwt.expiresIn,
      });

      return {
        user: user.toObject(),
        // Return clinic object (or null) to the controller
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

  async getUser(auth0UserId) {
      if (!this.managementClient) {
          throw new Error('Auth0 Management client is not initialized. Check your configuration.');
      }
      // ... implementation ...
  }
  
  /**
   * Verify if Auth0 is properly configured
   * @returns {boolean} True if Auth0 is configured
   */
  isAuth0Configured() {
      return this.isInitialized() && this.config.callbackUrl;
  }

  /**
   * Get user profile using access token (alternative to ID token decoding)
   * @param {string} accessToken - Access token from Auth0
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile(accessToken) {
    try {
      const userInfo = await this.authClient.getProfile(accessToken);
      return userInfo;
    } catch (error) {
      console.error('Error getting user profile:', error);
      throw new Error('Failed to get user profile from Auth0');
    }
  }
}

export default new ClinicAuth0Service(); 