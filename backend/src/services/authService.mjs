// src/services/authService.mjs

import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import mongoose from 'mongoose';
import loadAndValidateConfig from '../config/config.mjs';
import { AppError } from '../utils/errorHandler.mjs';
import { AuditLog, Clinic } from '../models/index.mjs'; // Import Clinic model

// Load the config
const config = loadAndValidateConfig();

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
    this.Clinic = Clinic; // Add Clinic model reference

    // --- Explicitly bind the method --- 
    this._hashPassword = this._hashPassword.bind(this);
    // --- End binding ---
  }

  /**
   * Hash password
   * @param {string} password - Password to hash
   * @returns {string} Hashed password
   * @private
   */
  async _hashPassword(password) {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds || 10);
    return await bcrypt.hash(password, salt);
  }

  /**
   * Register a new user (patient, doctor, staff)
   * @param {Object} userData - User registration data
   * @param {string} userType - Type of user ('patient', 'doctor', 'staff')
   * @returns {Object} User data and token
   */
  async registerUser(userData, userType) {
    console.log('[RegisterUser] Received userData:', JSON.stringify(userData, null, 2));
    console.log('[RegisterUser] Received userType:', userType);
    
    const session = await this.User.startSession();
    session.startTransaction();

    try {
      // Fetch the single clinic
      const singleClinic = await this.Clinic.findOne().session(session);
      if (!singleClinic) {
        throw new AppError('No clinic found in the database. Cannot register user.', 500);
      }
      const clinicId = singleClinic._id;
      console.log(`[RegisterUser] Found clinic ID: ${clinicId} to associate user with.`);

      // Hash password
      const passwordHash = await this._hashPassword(userData.password);

      // Create user
      const user = await this.User.create([
        {
          ...userData,
          passwordHash,
        role: userType,
          clinicId: (userType === 'doctor' || userType === 'staff') ? clinicId : undefined,
        }
      ], { session });
      
      console.log(`[RegisterUser] User created with ID: ${user[0]._id} and clinicId: ${user[0].clinicId}`);

      // Create role-specific record
      let roleSpecificRecord = null;
      let RoleModel;
      let roleSpecificData = { 
        userId: user[0]._id,
        clinicId: (userType === 'doctor' || userType === 'staff') ? clinicId : undefined,
      };
      
      if (userType === 'patient') {
        // Prepare patient data, extracting relevant fields from userData
        const patientData = { 
          userId: user[0]._id,
          gender: userData.gender, // Add gender from userData
          dateOfBirth: userData.dateOfBirth, // Add dateOfBirth from userData
          // Add any other patient-specific fields from userData here
          // e.g., address: userData.address, phoneNumber: userData.phoneNumber
        };
        console.log('[RegisterUser] Preparing to create patient record with data:', JSON.stringify(patientData, null, 2)); // Log the data being passed
        roleSpecificRecord = await this.Patient.create([patientData], { session });
      } else if (userType === 'doctor') {
        // Prepare doctor data (if applicable)
        const doctorData = { 
          userId: user[0]._id,
          clinicId: clinicId, // Ensure clinicId is added
          licenseNumber: userData.licenseNumber, // Add licenseNumber
          specialties: userData.specialties, // Add specialties (assuming it comes as an array)
          appointmentFee: userData.appointmentFee, // Add appointmentFee (optional)
          deaNumber: userData.deaNumber, // Add DEA number (optional)
          bio: userData.bio, // Add bio (optional)
          education: userData.education, // Add education (optional)
          // Add any other doctor-specific fields from userData here
        };
        console.log('[RegisterUser] Preparing to create doctor record with data:', JSON.stringify(doctorData, null, 2));
        // Remove undefined optional fields before creating
        Object.keys(doctorData).forEach(key => {
          if (doctorData[key] === undefined) {
            delete doctorData[key];
          }
        });
        roleSpecificRecord = await this.Doctor.create([doctorData], { session });
      } else if (userType === 'staff') {
        // Prepare staff data (if applicable)
        const staffData = {
          userId: user[0]._id,
          department: userData.department, // Example: Add department
          // Add other staff-specific fields
        };
        roleSpecificRecord = await this.Staff.create([staffData], { session });
      }
      
      console.log(`[RegisterUser] Role-specific record created for type: ${userType}`);

      // Create audit log entry
      await this.AuditLog.create([{
        userId: user[0]._id,
        action: 'register',
        resource: 'user',
        resourceId: user[0]._id,
        details: {
          userType,
          email: user[0].email
        }
      }], { session });

      // Generate token (include clinicId if user has it)
      let tokenOptions = {};
      if (user[0].clinicId) {
        tokenOptions.clinicId = user[0].clinicId;
      }
      const token = this._generateToken(user[0]._id, user[0].role, tokenOptions);

      // Commit the transaction
      await session.commitTransaction();
      console.log(`[RegisterUser] Transaction committed for user ${user[0].email}`);

      return { 
        user: this._sanitizeUserData(user[0]), 
        roleSpecificRecord: roleSpecificRecord ? roleSpecificRecord[0].toObject() : null, // Convert role record to object
        token 
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Registration error:', error);
      // Rethrow specific AppErrors, wrap others
      if (error instanceof AppError) throw error;
      throw new AppError(error.message || 'Registration failed', 500);
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