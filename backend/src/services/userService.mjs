// src/services/userService.mjs

import { User, Patient, Doctor, Staff, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';

/**
 * User Management Service
 */
class UserService {
  /**
   * Get all users with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Users and pagination info
   */
  async getAllUsers(options) {
    try {
      const {
        page = 1,
        limit = 10,
        role,
        search,
        sort = 'createdAt',
        order = 'desc',
        clinicId
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build query
      const query = {};
      
      // Filter by role if provided
      if (role) {
        query.role = role;
      }
      
      // Filter by clinic if provided
      if (clinicId) {
        query.clinicId = mongoose.Types.ObjectId(clinicId);
      }
      
      // Add search functionality
      if (search) {
        query.$or = [
          { firstName: { $regex: search, $options: 'i' } },
          { lastName: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ];
      }
      
      // Determine sort order
      const sortDirection = order === 'desc' ? -1 : 1;
      const sortOptions = {};
      sortOptions[sort] = sortDirection;
      
      // Execute query with pagination
      const users = await User.find(query)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
        .sort(sortOptions)
        .skip(skip)
        .limit(limit);
      
      // Get total count for pagination
      const total = await User.countDocuments(query);
      
      return {
        users,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Get all users error:', error);
      throw new Error('Failed to retrieve users');
    }
  }

  /**
   * Get user by ID
   * @param {string} userId - User ID
   * @returns {Object} User object
   */
  async getUserById(userId) {
    try {
      // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(userId)) {
        throw new Error('Invalid ID format');
    }  
    
      const user = await User.findById(userId)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');
      
      if (!user) {
        return null;
      }
      
      // Get role-specific data
      let roleData = {};
      if (user.role === 'patient') {
        roleData = await Patient.findOne({ userId: user._id });
      } else if (user.role === 'doctor') {
        roleData = await Doctor.findOne({ userId: user._id });
      } else if (user.role === 'staff') {
        roleData = await Staff.findOne({ userId: user._id });
      }
      
      // Combine user and role data
      return {
        ...user.toObject(),
        roleData: roleData ? roleData.toObject() : null
      };
    } catch (error) {
      console.error('Get user by ID error:', error);
      throw new Error('Failed to retrieve user');
    }
  }

  /**
   * Create new user
   * @param {Object} userData - User data
   * @param {string} createdById - ID of user creating this user
   * @returns {Object} New user object
   */
  async createUser(userData, createdById) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new Error('User with this email already exists');
      }
      
      // Create the user
      const user = await User.create([{
        firstName: userData.firstName,
        lastName: userData.lastName,
        email: userData.email,
        passwordHash: userData.password, // Will be hashed by pre-save hook
        role: userData.role,
        phoneNumber: userData.phoneNumber,
        isActive: userData.isActive || true,
        emailVerified: userData.emailVerified || false,
        clinicId: userData.clinicId
      }], { session });
      
      const newUser = user[0];
      
      // Create role-specific record if needed
      let roleSpecificRecord = null;
      
      if (userData.role === 'patient') {
        roleSpecificRecord = await Patient.create([{
          userId: newUser._id,
          dateOfBirth: userData.dateOfBirth || new Date(),
          gender: userData.gender || 'other',
          address: userData.address || {},
          emergencyContact: userData.emergencyContact || {},
          allergies: userData.allergies || [],
          medicalHistory: userData.medicalHistory || [],
          currentMedications: userData.currentMedications || [],
          preferredCommunication: userData.preferredCommunication || 'email'
        }], { session });
      } else if (userData.role === 'doctor') {
        roleSpecificRecord = await Doctor.create([{
          userId: newUser._id,
          specialties: userData.specialties || [],
          licenseNumber: userData.licenseNumber || 'TO_BE_VERIFIED',
          appointmentFee: userData.appointmentFee || 0,
          education: userData.education || [],
          acceptingNewPatients: userData.acceptingNewPatients !== false,
          availabilitySchedule: userData.availabilitySchedule || []
        }], { session });
      } else if (userData.role === 'staff') {
        roleSpecificRecord = await Staff.create([{
          userId: newUser._id,
          position: userData.position || 'other',
          department: userData.department || 'General',
          permissions: userData.permissions || []
        }], { session });
      }
      
      // Create audit log
      await AuditLog.create([{
        userId: createdById,
        action: 'create',
        resource: 'user',
        resourceId: newUser._id,
        details: {
          role: userData.role,
          email: userData.email
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Get the complete user with role data
      const completeUser = await this.getUserById(newUser._id);
      
      return completeUser;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create user error:', error);
      throw new Error(error.message || 'Failed to create user');
    } finally {
      session.endSession();
    }
  }

  /**
   * Update user
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user
   */
  async updateUser(userId, updateData) {
    try {
      // Check if user exists
      const user = await User.findById(userId);
      if (!user) {
        return null;
      }
      
      // Filter out fields that shouldn't be updated directly
      const restrictedFields = [
        'passwordHash', 'role', 'resetPasswordToken', 'resetPasswordExpire',
        'emailVerificationToken', 'emailVerificationExpire', 'auth0Id'
      ];
      
      // Create a clean update object
      const updateObj = {};
      Object.keys(updateData).forEach(key => {
        if (!restrictedFields.includes(key)) {
          updateObj[key] = updateData[key];
        }
      });
      
      // Update the user
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: updateObj },
        { new: true, runValidators: true }
      ).select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');
      
      if (!updatedUser) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: userId, // Using the user's own ID as actor for now
        action: 'update',
        resource: 'user',
        resourceId: userId,
        details: {
          updatedFields: Object.keys(updateObj)
        }
      });
      
      // Get the complete updated user with role data
      return await this.getUserById(userId);
    } catch (error) {
      console.error('Update user error:', error);
      throw new Error('Failed to update user');
    }
  }

  /**
   * Delete user
   * @param {string} userId - User ID to delete
   * @returns {boolean} Success status
   */
  async deleteUser(userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the user first
      const user = await User.findById(userId);
      if (!user) {
        return false;
      }
      
      // Delete role-specific record
      if (user.role === 'patient') {
        await Patient.findOneAndDelete({ userId: user._id }, { session });
      } else if (user.role === 'doctor') {
        await Doctor.findOneAndDelete({ userId: user._id }, { session });
      } else if (user.role === 'staff') {
        await Staff.findOneAndDelete({ userId: user._id }, { session });
      }
      
      // Delete the user
      await User.findByIdAndDelete(userId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: userId, // Using the user's own ID as actor for this log
        action: 'delete',
        resource: 'user',
        resourceId: userId,
        details: {
          email: user.email,
          role: user.role
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Delete user error:', error);
      throw new Error('Failed to delete user');
    } finally {
      session.endSession();
    }
  }

  /**
   * Search users by criteria
   * @param {Object} criteria - Search criteria
   * @returns {Array} Matching users
   */
  async searchUsers(criteria) {
    try {
      const { query, fields = [], limit = 10 } = criteria;
      
      // Define fields to search if not provided
      const searchFields = fields.length > 0 ? fields : ['firstName', 'lastName', 'email', 'phoneNumber'];
      
      // Build search query
      const searchQuery = {};
      
      if (query) {
        searchQuery.$or = searchFields.map(field => ({
          [field]: { $regex: query, $options: 'i' }
        }));
      }
      
      // Execute search
      const users = await User.find(searchQuery)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
        .limit(limit);
      
      return users;
    } catch (error) {
      console.error('Search users error:', error);
      throw new Error('Failed to search users');
    }
  }

  /**
   * Get user profile with basic and role-specific information
   * @param {string} userId - User ID
   * @returns {Object} User profile
   */
  async getUserProfile(userId) {
    try {
      // Get user and role-specific data
      const user = await this.getUserById(userId);
      
      if (!user) {
        return null;
      }
      
      // Additional profile information based on role
      let profileInfo = {};
      
      if (user.role === 'patient') {
        // Get patient appointments, etc.
        profileInfo.appointmentsCount = await this.getPatientAppointmentsCount(userId);
      } else if (user.role === 'doctor') {
        // Get doctor statistics
        profileInfo.patientsCount = await this.getDoctorPatientsCount(userId);
        profileInfo.appointmentsCount = await this.getDoctorAppointmentsCount(userId);
      }
      
      return {
        ...user,
        profileInfo
      };
    } catch (error) {
      console.error('Get user profile error:', error);
      throw new Error('Failed to retrieve user profile');
    }
  }

  /**
   * Get count of patient's appointments
   * @param {string} userId - User ID
   * @returns {number} Appointments count
   */
  async getPatientAppointmentsCount(userId) {
    try {
      // This would typically query the Appointment collection
      // For now, return a placeholder
      return 0;
    } catch (error) {
      console.error('Get patient appointments count error:', error);
      return 0;
    }
  }

  /**
   * Get count of doctor's patients
   * @param {string} userId - User ID
   * @returns {number} Patients count
   */
  async getDoctorPatientsCount(userId) {
    try {
      // This would typically query the Appointment collection for unique patients
      // For now, return a placeholder
      return 0;
    } catch (error) {
      console.error('Get doctor patients count error:', error);
      return 0;
    }
  }

  /**
   * Get count of doctor's appointments
   * @param {string} userId - User ID
   * @returns {number} Appointments count
   */
  async getDoctorAppointmentsCount(userId) {
    try {
      // This would typically query the Appointment collection
      // For now, return a placeholder
      return 0;
    } catch (error) {
      console.error('Get doctor appointments count error:', error);
      return 0;
    }
  }
}

export default new UserService();