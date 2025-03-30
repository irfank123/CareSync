// src/services/clinicAuthService.js

import jwt from 'jsonwebtoken';
import { Clinic, User } from '../models';
import { config } from '../config';
import { emailService } from './emailService';

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
    try {
      // Check if clinic already exists
      const existingClinic = await Clinic.findOne({ email: clinicData.email });
      if (existingClinic) {
        throw new Error('Clinic with this email already exists');
      }
      
      // Create clinic admin user
      const adminUser = await User.create({
        email: clinicData.email,
        name: clinicData.adminName || clinicData.name,
        userType: 'clinic_admin',
        emailVerified: false
      });
      
      // Create clinic
      const clinic = await Clinic.create({
        name: clinicData.name,
        email: clinicData.email,
        phone: clinicData.phone,
        address: clinicData.address,
        password: clinicData.password, // Will be hashed by pre-save hook
        adminUserId: adminUser._id,
        verificationStatus: 'pending',
        // Additional clinic fields as needed
        subscriptionTier: 'basic',
        verificationDocuments: clinicData.verificationDocuments || []
      });
      
      // Update user with clinic reference
      adminUser.clinicId = clinic._id;
      await adminUser.save();
      
      // Send verification email
      try {
        await this.sendVerificationEmail(clinic.email);
      } catch (emailError) {
        console.error('Failed to send verification email:', emailError);
        // Continue with registration even if email fails
      }
      
      // Generate token
      const token = this.generateClinicToken(clinic);
      
      return {
        clinic: this.sanitizeClinicData(clinic),
        token
      };
    } catch (error) {
      console.error('Clinic registration error:', error);
      throw new Error(error.message || 'Registration failed');
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
      
      return {
        clinic: this.sanitizeClinicData(clinic),
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
   * Send verification email to clinic
   * @param {string} email - Clinic email
   */
  async sendVerificationEmail(email) {
    // Generate verification code
    const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Store verification code (would typically be saved in database with expiry)
    // For now, we'll use a placeholder
    
    // Send email via email service
    return await emailService.sendEmail({
      to: email,
      subject: 'Verify your CareSync Clinic Account',
      text: `Your verification code is: ${verificationCode}. This code will expire in 24 hours.`,
      html: `
        <h1>Welcome to CareSync!</h1>
        <p>Your verification code is: <strong>${verificationCode}</strong></p>
        <p>This code will expire in 24 hours.</p>
      `
    });
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
      
      // In a real implementation, we would check the verification code
      // For this placeholder, we'll just mark as verified
      
      clinic.emailVerified = true;
      await clinic.save();
      
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
      
      // Notify admin about new verification request (placeholder)
      // This would trigger an email or notification to the platform admin
      
      return this.sanitizeClinicData(clinic);
    } catch (error) {
      console.error('Verification submission error:', error);
      throw new Error('Could not submit verification documents');
    }
  }
}

export default new ClinicAuthService();