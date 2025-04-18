// src/services/clinicAuthService.mjs

import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import mongoose from 'mongoose';
import { Clinic, User, AuditLog } from '../models/index.mjs';
import config from '../config/config.mjs';
import emailService from './emailService.mjs';

/**
 * Authentication service for clinic registration and login
 */
class ClinicAuthService {
  /**
   * Register a new clinic with the system
   * @param {Object} clinicData - Clinic registration data
   * @returns {Object} New clinic data and token
   */
  async registerClinic(clinicData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // Check if clinic already exists
      const existingClinic = await Clinic.findOne({ email: clinicData.email });
      if (existingClinic) {
        throw new Error('Clinic with this email already exists');
      }
      
      // Create clinic admin user
      const adminUser = await User.create([{
        email: clinicData.email,
        firstName: clinicData.adminFirstName,
        lastName: clinicData.adminLastName,
        passwordHash: clinicData.password, // Will be hashed by pre-save hook
        role: 'admin',
        phoneNumber: clinicData.phoneNumber || '',
        emailVerified: false
      }], { session });
      
      // Create clinic
      const clinic = await Clinic.create([{
        name: clinicData.name,
        email: clinicData.email,
        phone: clinicData.phoneNumber,
        address: clinicData.address,
        password: clinicData.password, // Will be hashed by pre-save hook
        adminUserId: adminUser[0]._id,
        verificationStatus: 'pending',
        // Additional clinic fields as needed
        subscriptionTier: 'basic',
        verificationDocuments: clinicData.verificationDocuments || []
      }], { session });
      
      // Update user with clinic reference
      await User.findByIdAndUpdate(
        adminUser[0]._id,
        { clinicId: clinic[0]._id },
        { session }
      );
      
      // Create audit log
      await AuditLog.create([{
        userId: adminUser[0]._id,
        action: 'create',
        resource: 'clinic',
        resourceId: clinic[0]._id,
        details: {
          name: clinicData.name,
          email: clinicData.email
        }
      }], { session });
      
      // Send verification email
      try {
        await this.sendVerificationEmail(clinic[0].email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }
      
      // Generate token
      const token = this.generateClinicToken(clinic[0]);
      
      // Commit the transaction
      await session.commitTransaction();
      
      return {
        clinic: this.sanitizeClinicData(clinic[0]),
        user: adminUser[0],
        token
      };
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Clinic registration error:', error);
      throw new Error(error.message || 'Registration failed');
    } finally {
      session.endSession();
    }
  }

  /**
   * Authenticate a clinic
   * @param {string} email - Clinic email
   * @param {string} password - Clinic password
   * @returns {Object} Clinic data and token
   */
  async loginClinic(email, password) {
    try {
      // Find clinic by email
      const clinic = await Clinic.findOne({ email }).select('+password');
      if (!clinic) {
        throw new Error('Invalid credentials');
      }
      
      // Find admin user
      const adminUser = await User.findById(clinic.adminUserId);
      if (!adminUser) {
        throw new Error('Clinic admin user not found');
      }
      
      // Check password
      const isMatch = await clinic.comparePassword(password);
      if (!isMatch) {
        throw new Error('Invalid credentials');
      }
      
      // Check verification status
      if (clinic.verificationStatus === 'rejected') {
        throw new Error('Clinic registration has been rejected. Please contact support.');
      }
      
      // Generate token
      const token = this.generateClinicToken(clinic);
      
      // Update last login time
      clinic.lastLogin = new Date();
      await clinic.save();
      
      // Create audit log
      await AuditLog.create({
        userId: adminUser._id,
        action: 'login',
        resource: 'clinic',
        resourceId: clinic._id,
        details: {
          email: clinic.email
        }
      });
      
      return {
        clinic: this.sanitizeClinicData(clinic),
        user: adminUser,
        token
      };
    } catch (error) {
      console.error('Clinic login error:', error);
      throw new Error(error.message || 'Authentication failed');
    }
  }
  
  /**
   * Generate JWT token for clinic
   * @param {Object} clinic - Clinic object
   * @returns {string} JWT token
   */
  generateClinicToken(clinic) {
    const secret = config.jwt.secret;
    
    return jwt.sign(
      { 
        id: clinic._id,
        email: clinic.email,
        type: 'clinic',
        verificationStatus: clinic.verificationStatus
      },
      secret,
      { expiresIn: config.jwt.expiresIn }
    );
  }
  
  /**
   * Remove sensitive data from clinic object
   * @param {Object} clinic - Clinic object
   * @returns {Object} Sanitized clinic data
   */
  sanitizeClinicData(clinic) {
    const clinicObj = clinic.toObject ? clinic.toObject() : { ...clinic };
    delete clinicObj.password;
    return clinicObj;
  }
  
  /**
   * Remove sensitive data from user object
   * @param {Object} user - User object
   * @returns {Object} Sanitized user data
   */
  sanitizeUserData(user) {
    const userObj = user.toObject ? user.toObject() : { ...user };
    delete userObj.passwordHash;
    delete userObj.resetPasswordToken;
    delete userObj.resetPasswordExpire;
    return userObj;
  }
  
  /**
   * Verify clinic email with verification code
   * @param {string} email - Clinic email 
   * @param {string} code - Verification code
   * @returns {boolean} Success status
   */
  async verifyClinicEmail(email, code) {
    try {
      // Find clinic by email
      const clinic = await Clinic.findOne({ email });
      if (!clinic) {
        throw new Error('Clinic not found');
      }
      
      // Find admin user
      const adminUser = await User.findById(clinic.adminUserId);
      
      // In a real implementation, we would check the verification code
      // For this placeholder, we'll just mark as verified
      
      clinic.emailVerified = true;
      await clinic.save();
      
      if (adminUser) {
        adminUser.emailVerified = true;
        await adminUser.save();
      }
      
      return true;
    } catch (error) {
      console.error('Clinic verification error:', error);
      throw new Error('Verification failed');
    }
  }
  
  /**
   * Start the manual verification process for a clinic
   * @param {string} clinicId - Clinic ID
   * @param {Array} documents - Verification documents
   * @returns {Object} Updated clinic data
   */
  async startVerificationProcess(clinicId, documents) {
    try {
      const clinic = await Clinic.findById(clinicId);
      if (!clinic) {
        throw new Error('Clinic not found');
      }
      
      clinic.verificationDocuments = documents;
      clinic.verificationStatus = 'in_review';
      clinic.verificationSubmittedAt = new Date();
      
      await clinic.save();
      
      // Create audit log
      await AuditLog.create({
        userId: clinic.adminUserId,
        action: 'update',
        resource: 'clinic',
        resourceId: clinicId,
        details: {
          field: 'verificationStatus',
          oldValue: 'pending',
          newValue: 'in_review'
        }
      });
      
      return this.sanitizeClinicData(clinic);
    } catch (error) {
      console.error('Verification submission error:', error);
      throw new Error('Could not submit verification documents');
    }
  }

  
  /**
   * Update clinic verification status
   * @param {string} clinicId - Clinic ID
   * @param {string} status - New verification status
   * @param {string} notes - Notes about the verification
   * @returns {Object} Updated clinic
   */
  async updateVerificationStatus(clinicId, status, notes) {
    try {
      const clinic = await Clinic.findById(clinicId);
      
      if (!clinic) {
        throw new Error('Clinic not found');
      }
      
      const oldStatus = clinic.verificationStatus;
      clinic.verificationStatus = status;
      
      if (status === 'verified') {
        clinic.verificationCompletedAt = new Date();
      }
      
      if (notes) {
        // Save verification notes
        clinic.verificationNotes = notes;
      }
      
      await clinic.save();
      
      // Create audit log
      await AuditLog.create({
        userId: clinic.adminUserId,
        action: 'update',
        resource: 'clinic',
        resourceId: clinicId,
        details: {
          field: 'verificationStatus',
          oldValue: oldStatus,
          newValue: status,
          notes
        }
      });
      
      // Notify clinic about verification status change
      try {
        await emailService.sendClinicVerificationEmail(clinic, status, notes);
      } catch (emailError) {
        console.error('Verification status notification email error:', emailError);
      }
      
      return this.sanitizeClinicData(clinic);
    } catch (error) {
      console.error('Update clinic verification error:', error);
      throw new Error('Could not update verification status');
    }
  }
  
  /**
   * Handle forgot password for clinic
   * @param {string} email - Clinic email
   * @returns {boolean} Success status
   */
  async forgotPassword(email) {
    try {
      // Find clinic by email
      const clinic = await Clinic.findOne({ email });
      
      if (!clinic) {
        // Always return success even if clinic not found to prevent email enumeration
        return true;
      }
      
      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      
      // Hash token and store it
      clinic.resetPasswordToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      clinic.resetPasswordExpire = Date.now() + config.auth.passwordResetExpiry;
      
      await clinic.save();
      
      // Create reset URL
      const resetUrl = `${config.frontendUrl}/clinic/reset-password/${resetToken}`;
      
      // Send email
      try {
        await emailService.sendPasswordResetEmail(email, resetUrl);
        return true;
      } catch (emailError) {
        // Reset token if email fails
        clinic.resetPasswordToken = undefined;
        clinic.resetPasswordExpire = undefined;
        await clinic.save();
        
        console.error('Password reset email error:', emailError);
        throw new Error('Email could not be sent');
      }
    } catch (error) {
      console.error('Forgot password error:', error);
      throw new Error('Server error while processing forgot password request');
    }
  }
  
  /**
   * Reset clinic password with token
   * @param {string} resetToken - Reset token
   * @param {string} newPassword - New password
   * @returns {boolean} Success status
   */
  async resetPassword(resetToken, newPassword) {
    try {
      // Hash the reset token
      const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
      
      // Find clinic with valid token
      const clinic = await Clinic.findOne({
        resetPasswordToken: hashedToken,
        resetPasswordExpire: { $gt: Date.now() }
      });
      
      if (!clinic) {
        throw new Error('Invalid or expired token');
      }
      
      // Set new password
      clinic.password = newPassword;
      clinic.resetPasswordToken = undefined;
      clinic.resetPasswordExpire = undefined;
      
      await clinic.save();
      
      // Create audit log
      await AuditLog.create({
        userId: clinic.adminUserId,
        action: 'update',
        resource: 'clinic',
        resourceId: clinic._id,
        details: {
          field: 'password',
          action: 'reset'
        }
      });
      
      return true;
    } catch (error) {
      console.error('Reset password error:', error);
      throw new Error(error.message || 'Password reset failed');
    }
  }
  
  /**
   * Send verification email to clinic
   * @param {string} email - Clinic email
   */
  async sendVerificationEmail(email) {
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code (would typically be saved in database with expiry)
    // For now, we'll use a placeholder
    
    // Send email via email service
    return await emailService.sendVerificationEmail(email, verificationCode);
  }
}

export default new ClinicAuthService();