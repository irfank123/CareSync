// src/services/authService.js

import jwt from 'jsonwebtoken';
import { User, Doctor, Patient } from '../models';
import { config } from '../config';

/**
 * Auth0 Service for handling patient and doctor authentication
 */
class AuthService {
  /**
   * Verify and decode Auth0 token
   * @param {string} token - JWT token from Auth0
   * @returns {Object} Decoded token payload
   */
  verifyToken(token) {
    try {
      // This would use Auth0's verification in production
      // For now we're using a placeholder implementation
      const decoded = jwt.decode(token);
      return { valid: true, decoded };
    } catch (error) {
      return { valid: false, error: error.message };
    }
  }

  /**
   * Process Auth0 callback and create/update user records
   * @param {Object} auth0Profile - Auth0 user profile
   * @param {string} userType - 'patient' or 'doctor'
   * @returns {Object} User data and token
   */
  async handleAuth0Login(auth0Profile, userType) {
    try {
      // Find or create user based on Auth0 ID
      let user = await User.findOne({ auth0Id: auth0Profile.sub });
      
      if (!user) {
        // Create new user if not exists
        user = await User.create({
          auth0Id: auth0Profile.sub,
          email: auth0Profile.email,
          name: auth0Profile.name,
          userType: userType,
          emailVerified: auth0Profile.email_verified || false,
          picture: auth0Profile.picture
        });
        
        // Create corresponding doctor or patient record
        if (userType === 'doctor') {
          await Doctor.create({
            userId: user._id,
            specialties: [],
            availability: []
            // Other doctor-specific fields would be updated later
          });
        } else if (userType === 'patient') {
          await Patient.create({
            userId: user._id,
            medicalHistory: {},
            // Other patient-specific fields would be updated later
          });
        }
      } else {
        // Update existing user data
        user.lastLogin = new Date();
        await user.save();
      }

      // Generate our application's JWT token (separate from Auth0 tokens)
      const appToken = this.generateAppToken(user);
      
      return {
        user,
        token: appToken
      };
    } catch (error) {
      console.error('Auth0 login error:', error);
      throw new Error('Authentication failed');
    }
  }
  
  /**
   * Generate application JWT token
   * @param {Object} user - User object
   * @returns {string} JWT token
   */
  generateAppToken(user) {
    // In production, use a secure environment variable for the secret
    const secret = config.jwt.secret;
    
    return jwt.sign(
      { 
        id: user._id,
        email: user.email,
        userType: user.userType,
        auth0Id: user.auth0Id 
      },
      secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }
  
  /**
   * Placeholder for Auth0 signup flow
   * This will be handled mostly by Auth0, but we may need some customization
   */
  async configureAuth0Signup() {
    // This would configure Auth0 signup rules, roles, etc.
    // For now it's a placeholder
    return true;
  }
}

export default new AuthService();