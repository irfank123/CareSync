// src/services/authService.mjs

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import config from '../config/config.mjs';

/**
 * Unified Authentication Service for all user types
 */
class AuthService {
  constructor(emailService, userRepository) {
    this.emailService = emailService;
    this.User = mongoose.model('User');
    this.Doctor = mongoose.model('Doctor');
    this.Patient = mongoose.model('Patient');
    this.Staff = mongoose.model('Staff');
    this.AuditLog = mongoose.model('AuditLog');
  }

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
      const existingUser = await this.User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      let user, roleSpecificRecord;

      // Create standard user (patient, doctor, staff)
      user = await this.User.create([{
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
        roleSpecificRecord = await this.Patient.create([{
          userId: user[0]._id,
          dateOfBirth: userData.dateOfBirth || new Date(),
          gender: userData.gender || 'other'
        }], { session });
      } else if (userType === 'doctor') {
        roleSpecificRecord = await this.Doctor.create([{
          userId: user[0]._id,
          specialties: userData.specialties || [],
          licenseNumber: userData.licenseNumber || 'TO_BE_VERIFIED',
          appointmentFee: userData.appointmentFee || 0
        }], { session });
      } else if (userType === 'staff') {
        roleSpecificRecord = await this.Staff.create([{
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
        if (this.emailService) {
          await this.emailService.sendWelcomeEmail(user[0].email, user[0].firstName, userType);
        }
      } catch (emailError) {
        console.error('Welcome email error:', emailError);
        // Continue registration even if email fails
      }

      // Create audit log
      await this.AuditLog.create([{
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
      const user = await this.User.findOne({ email }).select('+passwordHash');
      
      if (!user) {
        throw new Error('Invalid credentials');
      }

      // Check if password matches
      const isMatch = await this._matchPassword(password, user.passwordHash);
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
        } else if (this.emailService) {
          // Default to email
          await this.emailService.sendMfaEmail(user.email, mfaCode.originalToken);
        }
        
        return {
          user: this._sanitizeUserData(user),
          requiresMfa: true
        };
      }

      // Get role-specific data
      let roleData = null;
      if (user.role === 'patient') {
        roleData = await this.Patient.findOne({ userId: user._id });
      } else if (user.role === 'doctor') {
        roleData = await this.Doctor.findOne({ userId: user._id });
      } else if (user.role === 'staff') {
        roleData = await this.Staff.findOne({ userId: user._id });
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
      await this.AuditLog.create({
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
   * Match password with hashed password
   * @param {string} enteredPassword - Password to check
   * @param {string} hashedPassword - Stored hashed password
   * @returns {boolean} Whether passwords match
   * @private
   */
  async _matchPassword(enteredPassword, hashedPassword) {
    try {
      return await bcrypt.compare(enteredPassword, hashedPassword);
    } catch (error) {
      throw new Error('Password comparison failed');
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

// Export a factory function instead of a singleton
export default function createAuthService(emailService) {
  return new AuthService(emailService);
}