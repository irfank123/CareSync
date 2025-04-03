// src/services/patientService.mjs

import BaseService from './base/baseService.mjs';
import { Patient, User, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Patient Service extending the BaseService
 */
class PatientService extends BaseService {
  constructor() {
    // Configure base service with Patient model and options
    super(Patient, 'Patient', {
      // Fields to populate when fetching patients
      populateFields: [
        { path: 'userId', select: 'firstName lastName email phoneNumber isActive' }
      ],
      // Fields to use for text search
      searchFields: ['userId.firstName', 'userId.lastName', 'userId.email'],
      // This service supports clinic associations
      supportsClinic: true
    });
  }
  
  /**
   * Override getAll to support complex queries with aggregation pipeline
   * @param {Object} options - Query options
   * @returns {Object} Patients and pagination info
   */
  async getAll(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'createdAt',
        order = 'desc',
        clinicId,
        gender,
        minAge,
        maxAge,
        condition
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build the aggregation pipeline
      const pipeline = [];
      
      // Stage 1: Join with User model to get user information
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'userId',
          foreignField: '_id',
          as: 'user'
        }
      });
      
      // Stage 2: Unwind the user array (from lookup)
      pipeline.push({
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      });
      
      // Stage 3: Match conditions
      const matchConditions = {};
      
      // Filter by clinic if provided
      if (clinicId) {
        matchConditions['user.clinicId'] = mongoose.Types.ObjectId(clinicId);
      }
      
      // Filter by gender if provided
      if (gender) {
        matchConditions.gender = gender;
      }
      
      // Filter by age if provided
      if (minAge || maxAge) {
        matchConditions.dateOfBirth = {};
        
        if (minAge) {
          const minDate = new Date();
          minDate.setFullYear(minDate.getFullYear() - minAge);
          matchConditions.dateOfBirth.$lte = minDate;
        }
        
        if (maxAge) {
          const maxDate = new Date();
          maxDate.setFullYear(maxDate.getFullYear() - maxAge);
          matchConditions.dateOfBirth.$gte = maxDate;
        }
      }
      
      // Filter by medical condition if provided
      if (condition) {
        matchConditions['medicalHistory.condition'] = { $regex: condition, $options: 'i' };
      }
      
      // Add search functionality
      if (search) {
        matchConditions.$or = [
          { 'user.firstName': { $regex: search, $options: 'i' } },
          { 'user.lastName': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } }
        ];
      }
      
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }
      
      // Stage 4: Sort the results
      const sortDirection = order === 'desc' ? -1 : 1;
      const sortField = sort.startsWith('user.') ? sort : `user.${sort}`;
      
      const sortStage = {};
      sortStage[sortField] = sortDirection;
      pipeline.push({ $sort: sortStage });
      
      // Use facet to get both data and count in a single query
      pipeline.push({
        $facet: {
          // Data with pagination
          data: [
            { $skip: skip },
            { $limit: limit },
            {
              $project: {
                _id: 1,
                userId: 1,
                dateOfBirth: 1,
                gender: 1,
                address: 1,
                emergencyContact: 1,
                allergies: 1,
                medicalHistory: 1,
                currentMedications: 1,
                preferredCommunication: 1,
                createdAt: 1,
                updatedAt: 1,
                'user._id': 1,
                'user.firstName': 1,
                'user.lastName': 1,
                'user.email': 1,
                'user.phoneNumber': 1,
                'user.isActive': 1,
                'user.role': 1,
                'user.clinicId': 1,
                'user.emailVerified': 1,
                'user.lastLogin': 1,
                'user.profileImageUrl': 1
              }
            }
          ],
          // Total count for pagination
          count: [{ $count: 'total' }]
        }
      });
      
      // Execute the aggregation pipeline
      const [result] = await Patient.aggregate(pipeline);
      
      const patients = result.data || [];
      const total = result.count.length > 0 ? result.count[0].total : 0;
      
      return {
        data: patients,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page, 10)
      };
    } catch (error) {
      this._handleError(error, 'Failed to retrieve patients');
    }
  }
  
  /**
   * Get patient's user ID
   * @param {string} patientId - Patient ID
   * @returns {string} User ID
   */
  async getPatientUserId(patientId) {
    try {
      this._validateId(patientId);
      
      const patient = await Patient.findById(patientId).select('userId');
      return patient ? patient.userId : null;
    } catch (error) {
      this._handleError(error, 'Failed to retrieve patient user ID');
    }
  }
  
  /**
   * Override create to handle user role update
   * @param {Object} patientData - Patient data
   * @param {string} createdBy - User ID creating the patient
   * @returns {Object} Created patient
   */
  async create(patientData, createdBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      // Verify that the user exists and is not already a patient
      const user = await User.findById(patientData.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const existingPatient = await Patient.findOne({ userId: patientData.userId });
      if (existingPatient) {
        throw new AppError('User is already a patient', 400);
      }
      
      // Update user role if needed
      if (user.role !== 'patient') {
        user.role = 'patient';
        await user.save({ session });
      }
      
      // Create patient record
      const patient = await Patient.create([{
        userId: patientData.userId,
        dateOfBirth: patientData.dateOfBirth,
        gender: patientData.gender,
        address: patientData.address || {},
        emergencyContact: patientData.emergencyContact || {},
        allergies: patientData.allergies || [],
        medicalHistory: patientData.medicalHistory || [],
        currentMedications: patientData.currentMedications || [],
        preferredCommunication: patientData.preferredCommunication || 'email'
      }], { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: createdBy,
        action: 'create',
        resource: 'patient',
        resourceId: patient[0]._id,
        details: {
          dateOfBirth: patientData.dateOfBirth,
          gender: patientData.gender
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Return the complete patient with user info
      return this.getById(patient[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      this._handleError(error, 'Failed to create patient');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get patient's medical history
   * @param {string} patientId - Patient ID
   * @returns {Array} Medical history
   */
  async getMedicalHistory(patientId) {
    try {
      this._validateId(patientId);
      
      const patient = await Patient.findById(patientId).select('medicalHistory');
      if (!patient) {
        return null;
      }
      
      return patient.medicalHistory || [];
    } catch (error) {
      this._handleError(error, 'Failed to retrieve medical history');
    }
  }
  
  /**
   * Override delete to handle transaction and audit logging
   * @param {string} patientId - Patient ID to delete
   * @param {string} deletedBy - User ID deleting the patient
   * @returns {boolean} Success status
   */
  async delete(patientId, deletedBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      this._validateId(patientId);
      
      // Find the patient first to get user ID
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return false;
      }
      
      // Delete the patient record
      await Patient.findByIdAndDelete(patientId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: deletedBy,
        action: 'delete',
        resource: 'patient',
        resourceId: patientId
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      this._handleError(error, 'Failed to delete patient');
    } finally {
      session.endSession();
    }
  }
}

// Create single instance of PatientService
const patientService = new PatientService();

export default patientService;