// src/services/userService.mjs

import BaseService from './base/baseService.mjs';
import { User, Patient, Doctor, Staff, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * User Service extending the BaseService
 */
class UserService extends BaseService {
  constructor() {
    // Configure base service with User model and options
    super(User, 'User', {
      // Fields to populate when fetching users
      populateFields: [],
      // Fields to use for text search
      searchFields: ['firstName', 'lastName', 'email', 'phoneNumber'],
      // This service supports clinic associations
      supportsClinic: true
    });
  }
  
  /**
   * Override getAll to support more complex filtering
   * @param {Object} options - Query options
   * @returns {Object} Users and pagination info
   */
  async getAll(options) {
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
      
      // Use facet to get both data and count in a single query
      const result = await User.aggregate([
        { $match: query },
        {
          $facet: {
            // Data with pagination
            data: [
              { $sort: sortOptions },
              { $skip: skip },
              { $limit: limit },
              {
                $project: {
                  _id: 1,
                  firstName: 1,
                  lastName: 1,
                  email: 1,
                  role: 1,
                  phoneNumber: 1,
                  isActive: 1,
                  emailVerified: 1,
                  profileImageUrl: 1,
                  createdAt: 1,
                  lastLogin: 1,
                  clinicId: 1,
                  preferences: 1
                }
              }
            ],
            // Total count for pagination
            count: [{ $count: 'total' }]
          }
        }
      ]);
      
      const users = result[0].data || [];
      const total = result[0].count.length > 0 ? result[0].count[0].total : 0;
      
      return {
        data: users,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page, 10)
      };
    } catch (error) {
      this._handleError(error, 'Failed to retrieve users');
    }
  }
  
  /**
   * Override getById to exclude sensitive fields
   * @param {string} id - User ID
   * @returns {Object} User
   */
  async getById(id) {
    try {
      this._validateId(id);
      
      const user = await User.findById(id)
        .select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire')
        .lean();
      
      if (!user) {
        return null;
      }
      
      // Get role-specific data
      let roleData = {};
      if (user.role === 'patient') {
        roleData = await Patient.findOne({ userId: user._id }).lean();
      } else if (user.role === 'doctor') {
        roleData = await Doctor.findOne({ userId: user._id }).lean();
      } else if (user.role === 'staff') {
        roleData = await Staff.findOne({ userId: user._id }).lean();
      }
      
      // Combine user and role data
      return {
        ...user,
        roleData: roleData || null
      };
    } catch (error) {
      this._handleError(error, 'Failed to retrieve user');
    }
  }
  
  /**
   * Override create to handle role-specific records
   * @param {Object} userData - User data
   * @param {string} createdBy - User ID creating the user
   * @returns {Object} Created user
   */
  async create(userData, createdBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      // Check if email already exists
      const existingUser = await User.findOne({ email: userData.email });
      if (existingUser) {
        throw new AppError('User with this email already exists', 400);
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
        userId: createdBy,
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
      
      // Return created user without sensitive fields
      return this.getById(newUser._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      this._handleError(error, 'Failed to create user');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Override update to handle special fields
   * @param {string} id - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated user
   */
  async update(id, updateData) {
    try {
      this._validateId(id);
      
      // Find the user first
      const user = await User.findById(id);
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
        id,
        { $set: updateObj },
        { new: true, runValidators: true }
      ).select('-passwordHash -resetPasswordToken -resetPasswordExpire -emailVerificationToken -emailVerificationExpire');
      
      if (!updatedUser) {
        return null;
      }
      
      // Get updated user with role data
      return this.getById(id);
    } catch (error) {
      this._handleError(error, 'Failed to update user');
    }
  }
  
  /**
   * Override delete to handle role-specific records and transactions
   * @param {string} id - User ID
   * @param {string} deletedBy - User ID of the person deleting
   * @returns {boolean} Success status
   */
  async delete(id, deletedBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      this._validateId(id);
      
      // Find the user first to get role
      const user = await User.findById(id);
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
      await User.findByIdAndDelete(id, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: deletedBy,
        action: 'delete',
        resource: 'user',
        resourceId: id,
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
      this._handleError(error, 'Failed to delete user');
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
        .limit(limit)
        .lean();
      
      return users;
    } catch (error) {
      this._handleError(error, 'Failed to search users');
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
      const user = await this.getById(userId);
      
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
      this._handleError(error, 'Failed to retrieve user profile');
    }
  }
  
  /**
   * Get count of patient's appointments
   * @param {string} userId - User ID
   * @returns {number} Appointments count
   */
  async getPatientAppointmentsCount(userId) {
    try {
      // Get patient record
      const patient = await Patient.findOne({ userId });
      if (!patient) return 0;
      
      // Get appointment count from Appointment model (using mongoose model to avoid circular dependency)
      const Appointment = mongoose.model('Appointment');
      return await Appointment.countDocuments({ patientId: patient._id });
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
      // Get doctor record
      const doctor = await Doctor.findOne({ userId });
      if (!doctor) return 0;
      
      // Get distinct patients from Appointment model
      const Appointment = mongoose.model('Appointment');
      const distinctPatients = await Appointment.distinct('patientId', { doctorId: doctor._id });
      return distinctPatients.length;
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
      // Get doctor record
      const doctor = await Doctor.findOne({ userId });
      if (!doctor) return 0;
      
      // Get appointment count
      const Appointment = mongoose.model('Appointment');
      return await Appointment.countDocuments({ doctorId: doctor._id });
    } catch (error) {
      console.error('Get doctor appointments count error:', error);
      return 0;
    }
  }
}

// Create a single instance of UserService
const userService = new UserService();

export default userService;