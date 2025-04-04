// src/services/authService.mjs

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { User, Doctor, Patient, Staff, AuditLog } from '../models/index.mjs';
import config from '../config/config.mjs';
import emailService from './emailService.mjs';
import mongoose from 'mongoose';

/**
 * Unified Authentication Service for all user types
 */
class AuthService {
  /**
   * Register a new user (patient, doctor, staff)
   * @param {Object} userData - User registration data
   * @param {string} userType - Type of user ('patient', 'doctor', 'staff')
   * @returns {Object} User data and token
   */
  async registerUser(userData, userType) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if user with this email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      let user, roleSpecificRecord;

      // Create standard user (patient, doctor, staff)
      user = await User.create([{
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        passwordHash: userData.password, // Will be hashed by pre-save hook
        role: userType,
        phoneNumber: userData.phoneNumber,
        isActive: true,
        clinicId: userData.clinicId
      }], { session });

      // Create role-specific record
      if (userType === 'patient') {
        roleSpecificRecord = await Patient.create([{
          userId: user[0]._id,
          dateOfBirth: userData.dateOfBirth || new Date(),
          gender: userData.gender || 'other'
        }], { session });
      } else if (userType === 'doctor') {
        roleSpecificRecord = await Doctor.create([{
          userId: user[0]._id,
          specialties: userData.specialties || [],
          licenseNumber: userData.licenseNumber || 'TO_BE_VERIFIED',
          appointmentFee: userData.appointmentFee || 0
        }], { session });
      } else if (userType === 'staff') {
        roleSpecificRecord = await Staff.create([{
          userId: user[0]._id,
          position: userData.position || 'other',
          department: userData.department || 'General'
        }], { session });
      }

      // Generate token
      const token = this._generateToken(user[0]._id, userType, { 
        clinicId: userData.clinicId 
      });

      // Try to send welcome email
      try {
        await emailService.sendWelcomeEmail(user[0].email, user[0].firstName, userType);
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Continue registration even if email fails
      }

      // Create audit log
      await AuditLog.create([{
        userId: user[0]._id,
        action: 'create',
        resource: 'user',
        resourceId: user[0]._id,
        details: {
          userType,
          email: user[0].email
        }
      }], { session });

      // Commit the transaction
      await session.commitTransaction();

      return { 
        user: this._sanitizeUserData(user[0]), 
        roleSpecificRecord: roleSpecificRecord ? roleSpecificRecord[0] : null, 
        token 
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Registration error:', error);
      throw new Error(error.message || 'Registration failed');
    } finally {
      session.endSession();
    }
  }

  /**
   * Authenticate a user
   * @param {string} email - User email
   * @param {string} password - User password
   * @returns {Object} User data and token
   */
  async loginUser(email, password) {
    try {
      // Find user by email
      const user = await User.findOne({ email }).select('+passwordHash');
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if password matches
      const isMatch = await user.matchPassword(password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }

      // Check if user is active
      if (!user.isActive) {
        throw new Error('Your account has been disabled. Please contact support.');
      }

      // Check if MFA is enabled
      if (user.mfaEnabled) {
        // Generate and send MFA code
        const mfaCode = this._generateMfaCode(user);
        
        // Send MFA code to user
        if (user.mfaMethod === 'sms') {
          // Implementation for SMS would go here
          console.log(`Would send SMS with code ${mfaCode.originalToken} to ${user.phoneNumber}`);
        } else {
          // Default to email
          await emailService.sendMfaEmail(user.email, mfaCode.originalToken);
        }
        
        return {
          user: this._sanitizeUserData(user),
          requiresMfa: true
        };
      }

      // Get role-specific data
      let roleData = null;
      if (user.role === 'patient') {
        roleData = await Patient.findOne({ userId: user._id });
      } else if (user.role === 'doctor') {
        roleData = await Doctor.findOne({ userId: user._id });
      } else if (user.role === 'staff') {
        roleData = await Staff.findOne({ userId: user._id });
      }

      // Update last login
      user.lastLogin = Date.now();
      await user.save();

      // Generate token
      let tokenOptions = {};
      if (user.clinicId) {
        tokenOptions.clinicId = user.clinicId;
      }
      const token = this._generateToken(user._id, user.role, tokenOptions);

      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'login',
        resource: 'user',
        details: {
          role: user.role
        }
      });

      return {
        user: this._sanitizeUserData(user),
        roleData,
        token
      };
    } catch (error) {
      console.error('Login error:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }

  /**
   * Verify MFA code
   * @param {string} email - User email
   * @param {string} mfaCode - MFA code
   * @returns {Object} User data and token
   */
  async verifyMfa(email, mfaCode) {
    try {
      // Find user by email
      const user = await User.findOne({ 
        email,
        mfaTokenExpires: { $gt: Date.now() }
      }).select('+passwordHash +mfaToken');
      
      if (!user) {
        throw new Error('Invalid or expired MFA code');
      }

      // Compare MFA code
      const hashedToken = crypto
        .createHash('sha256')
        .update(mfaCode)
        .digest('hex');

      if (hashedToken !== user.mfaToken) {
        throw new Error('Invalid MFA code');
      }

      // Clear MFA token
      user.mfaToken = undefined;
      user.mfaTokenExpires = undefined;
      await user.save();

      // Get role-specific data if needed
      let roleData = null;
      if (user.role === 'patient') {
        roleData = await Patient.findOne({ userId: user._id });
      } else if (user.role === 'doctor') {
        roleData = await Doctor.findOne({ userId: user._id });
      } else if (user.role === 'staff') {
        roleData = await Staff.findOne({ userId: user._id });
      }

      // Update last login
      user.lastLogin = Date.now();
      await user.save();

      // Generate token
      let tokenOptions = {};
      if (user.clinicId) {
        tokenOptions.clinicId = user.clinicId;
      }
      const token = this._generateToken(user._id, user.role, tokenOptions);

      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'login',
        resource: 'user',
        details: {
          role: user.role,
          mfaVerified: true
        }
      });

      return {
        user: this._sanitizeUserData(user),
        roleData,
        token
      };
    } catch (error) {
      console.error('MFA verification error:', error);
      throw new Error(error.message || 'MFA verification failed');
    }
  }

  /**
   * Handle Auth0 login and create/update user
   * @param {Object} auth0Profile - Auth0 user profile
   * @param {string} userType - 'patient' or 'doctor'
   * @returns {Object} User data and token
   */
  async handleAuth0Login(auth0Profile, userType) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      if (!auth0Profile || !auth0Profile.sub) {
        throw new Error('Invalid Auth0 profile');
      }

      if (userType !== 'patient' && userType !== 'doctor') {
        throw new Error('Invalid user type. Must be patient or doctor.');
      }

      // Find or create user based on Auth0 ID
      let user = await User.findOne({ auth0Id: auth0Profile.sub });
      
      if (!user) {
        // Create new user
        user = await User.create([{
          firstName: auth0Profile.given_name || auth0Profile.nickname || 'User',
          lastName: auth0Profile.family_name || '',
          email: auth0Profile.email,
          passwordHash: crypto.randomBytes(16).toString('hex'), // Random password for Auth0 users
          role: userType,
          auth0Id: auth0Profile.sub,
          isActive: true,
          emailVerified: auth0Profile.email_verified || false,
          profileImageUrl: auth0Profile.picture
        }], { session });
        
        // Create role-specific record
        if (userType === 'patient') {
          await Patient.create([{
            userId: user[0]._id,
            dateOfBirth: new Date(),
            gender: 'other'
          }], { session });
        } else if (userType === 'doctor') {
          await Doctor.create([{
            userId: user[0]._id,
            specialties: [],
            licenseNumber: 'AUTH0_TO_BE_VERIFIED',
            appointmentFee: 0
          }], { session });
        }

        // Create audit log
        await AuditLog.create([{
          userId: user[0]._id,
          action: 'create',
          resource: 'user',
          details: {
            userType,
            email: user[0].email,
            auth0Id: user[0].auth0Id
          }
        }], { session });

        await session.commitTransaction();
        user = user[0];
      } else {
        // Update existing user's last login
        user.lastLogin = new Date();
        
        // If user exists but role doesn't match, log a warning
        if (user.role !== userType) {
          console.warn(`User ${user.email} exists with role ${user.role} but trying to login as ${userType}`);
        }
        
        await user.save();
      }

      // Generate application JWT token
      const token = this._generateToken(user._id, user.role, { auth0Id: user.auth0Id });
      
      return {
        user: this._sanitizeUserData(user),
        token
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Auth0 login error:', error);
      throw new Error(error.message || 'Authentication failed');
    } finally {
      session.endSession();
    }
  }

  /**
   * Start password reset process
   * @param {string} email - User email
   * @returns {boolean} Success status
   */
  async forgotPassword(email) {
    try {
      const user = await User.findOne({ email });
      
      if (!user) {
        // Always return success even if user not found to prevent email enumeration
        return true;
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(20).toString('hex');

      // Hash token and set to resetPasswordToken field
      user.resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');

      // Set expire
      user.resetPasswordExpire = Date.now() + config.auth.passwordResetExpiry;

      await user.save({ validateBeforeSave: false });
      
      // Create reset URL
      const resetUrl = `${config.frontendUrl}/reset-password/${resetToken}`;
      
      try {
        await emailService.sendPasswordResetEmail(user.email, resetUrl);
        return true;
      } catch (error) {
        user.resetPasswordToken = undefined;
        user.resetPasswordExpire = undefined;
        await user.save({ validateBeforeSave: false });
        
        console.error('Password reset email error:', error);
        throw new Error('Email could not be sent');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      throw new Error('Server error while processing password reset');
    }
  }

  /**
   * Reset user password with token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {Object} User and token if successful
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Hash the token
      const resetPasswordToken = crypto
        .createHash('sha256')
        .update(resetToken)
        .digest('hex');
      
      // Find user by token
      const user = await User.findOne({
        resetPasswordToken,
        resetPasswordExpire: { $gt: Date.now() }
      });
      
      if (!user) {
        throw new Error('Invalid or expired token');
      }
      
      // Set new password
      user.passwordHash = newPassword; // Will be hashed by pre-save hook
      user.resetPasswordToken = undefined;
      user.resetPasswordExpire = undefined;
      user.passwordChangedAt = Date.now();
      
      await user.save();
      
      // Generate token
      const token = this._generateToken(user._id, user.role);
      
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'update',
        resource: 'user',
        resourceId: user._id,
        details: {
          field: 'password',
          action: 'reset'
        }
      });
      
      return {
        user: this._sanitizeUserData(user),
        token
      };
    } catch (error) {
      console.error('Reset password error:', error);
      throw new Error(error.message || 'Password reset failed');
    }
  }

  /**
   * Update user password (when logged in)
   * @param {string} userId - User ID
   * @param {string} currentPassword - Current password
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async updatePassword(userId, currentPassword, newPassword) {
    try {
      const user = await User.findById(userId).select('+passwordHash');
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Check current password
      const isMatch = await user.matchPassword(currentPassword);
      if (!isMatch) {
        throw new Error('Current password is incorrect');
      }
      
      // Set new password
      user.passwordHash = newPassword;
      user.passwordChangedAt = Date.now();
      await user.save();
      
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'update',
        resource: 'user',
        resourceId: user._id,
        details: {
          field: 'password',
          action: 'change'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Update password error:', error);
      throw new Error(error.message || 'Password update failed');
    }
  }

  /**
   * Get user profile with role-specific data
   * @param {string} userId - User ID
   * @returns {Object} User profile data
   */
  async getUserProfile(userId) {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      // Get role-specific data
      let roleData = null;
      if (user.role === 'patient') {
        roleData = await Patient.findOne({ userId: user._id });
      } else if (user.role === 'doctor') {
        roleData = await Doctor.findOne({ userId: user._id });
      } else if (user.role === 'staff') {
        roleData = await Staff.findOne({ userId: user._id });
      }
      
      return {
        user: this._sanitizeUserData(user),
        roleData
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      throw new Error('Failed to retrieve user profile');
    }
  }

  /**
   * Toggle MFA for a user
   * @param {string} userId - User ID
   * @param {boolean} enableMfa - Whether to enable MFA
   * @param {string} mfaMethod - MFA method ('app' or 'sms')
   * @returns {Object} Updated user data
   */
  async toggleMfa(userId, enableMfa, mfaMethod = 'sms') {
    try {
      const user = await User.findById(userId);
      
      if (!user) {
        throw new Error('User not found');
      }
      
      user.mfaEnabled = enableMfa;
      user.mfaMethod = enableMfa ? mfaMethod : null;
      
      await user.save();
      
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'update',
        resource: 'user',
        resourceId: user._id,
        details: {
          field: 'mfaEnabled',
          oldValue: !enableMfa,
          newValue: enableMfa,
          mfaMethod
        }
      });
      
      return {
        user: this._sanitizeUserData(user)
      };
    } catch (error) {
      console.error('Toggle MFA error:', error);
      throw new Error('Failed to update MFA settings');
    }
  }

  /**
   * Refresh token
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {Object} options - Additional token options
   * @returns {string} New token
   */
  refreshToken(userId, role, options = {}) {
    return this._generateToken(userId, role, options);
  }

  /**
   * Verify email with verification code
   * @param {string} email - User email
   * @param {string} code - Verification code
   * @returns {boolean} Success status
   */
  async verifyEmail(email, code) {
    try {
      // Find user by email
      const user = await User.findOne({ 
        email,
        emailVerificationExpire: { $gt: Date.now() }
      }).select('+emailVerificationToken');
      
      if (!user) {
        throw new Error('Invalid or expired verification code');
      }
      
      // Hash the code
      const hashedCode = crypto
        .createHash('sha256')
        .update(code)
        .digest('hex');
      
      // Check if code matches
      if (hashedCode !== user.emailVerificationToken) {
        throw new Error('Invalid verification code');
      }
      
      // Mark email as verified
      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpire = undefined;
      
      await user.save();
      
      // Create audit log
      await AuditLog.create({
        userId: user._id,
        action: 'update',
        resource: 'user',
        resourceId: user._id,
        details: {
          field: 'emailVerified',
          oldValue: false,
          newValue: true
        }
      });
      
      return true;
    } catch (error) {
      console.error('Email verification error:', error);
      throw new Error('Verification failed');
    }
  }

  /**
   * Generate JWT token
   * @param {string} userId - User ID
   * @param {string} role - User role
   * @param {Object} options - Additional token data
   * @returns {string} JWT token
   * @private
   */
  _generateToken(userId, role, options = {}) {
    return jwt.sign(
      {
        id: userId,
        role,
        ...options
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn
      }
    );
  }

  /**
   * Generate a reset token for password reset
   * @param {Object} user - User object
   * @returns {string} Reset token
   * @private
   */
  _generateResetToken(user) {
    // Generate token
    const resetToken = crypto.randomBytes(20).toString('hex');

    // Hash token and set to resetPasswordToken field
    user.resetPasswordToken = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Set expire
    user.resetPasswordExpire = Date.now() + config.auth.passwordResetExpiry;

    return resetToken;
  }

  /**
   * Generate MFA code
   * @param {Object} user - User object
   * @returns {Object} MFA code info
   * @private
   */
  _generateMfaCode(user) {
    // Generate a 6-digit code
    const originalToken = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Hash the code for storage
    const hashedToken = crypto
      .createHash('sha256')
      .update(originalToken)
      .digest('hex');
    
    // Set on user object
    user.mfaToken = hashedToken;
    user.mfaTokenExpires = Date.now() + config.auth.mfaTokenExpiry;
    
    // Save the user
    user.save();
    
    return { originalToken, hashedToken, expires: user.mfaTokenExpires };
  }

  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user data
   * @private
   */
  _sanitizeUserData(user) {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.passwordHash;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;
    delete userObj.mfaToken;
    delete userObj.mfaTokenExpires;
    delete userObj.emailVerificationToken;
    delete userObj.emailVerificationExpire;
    return userObj;
  }
}

export default new AuthService();