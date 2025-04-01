// src/services/patientService.mjs

import { Patient, User, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';

/**
 * Patient Management Service
 */
class PatientService {
  /**
   * Get all patients with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Patients and pagination info
   */
  async getAllPatients(options) {
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
      
      // Stage 5: Count total documents (for pagination)
      const countPipeline = [...pipeline];
      countPipeline.push({ $count: 'total' });
      
      // Stage 6: Skip and limit for pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      // Stage 7: Project the fields we want to return
      pipeline.push({
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
      });
      
      // Execute the aggregation pipeline
      const patients = await Patient.aggregate(pipeline);
      
      // Get the total count for pagination
      const countResult = await Patient.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        patients,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Get all patients error:', error);
      throw new Error('Failed to retrieve patients');
    }
  }

  /**
   * Get patient by ID
   * @param {string} patientId - Patient ID
   * @returns {Object} Patient with user information
   */
  async getPatientById(patientId) {
    try {
        //validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(patientId)) {
            throw new Error('Invalid ID format');
        }
      // Use aggregation to get patient and user data in one query
      const patient = await Patient.aggregate([
        {
          $match: { _id: mongoose.Types.ObjectId(patientId) }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
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
      ]);
      
      if (!patient || patient.length === 0) {
        return null;
      }
      
      return patient[0];
    } catch (error) {
      console.error('Get patient by ID error:', error);
      throw new Error('Failed to retrieve patient');
    }
  }

  /**
   * Get patient by user ID
   * @param {string} userId - User ID
   * @returns {Object} Patient with user information
   */
  async getPatientByUserId(userId) {
    try {
      // Use aggregation to get patient and user data in one query
      const patient = await Patient.aggregate([
        {
          $match: { userId: mongoose.Types.ObjectId(userId) }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'userId',
            foreignField: '_id',
            as: 'user'
          }
        },
        {
          $unwind: {
            path: '$user',
            preserveNullAndEmptyArrays: true
          }
        },
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
      ]);
      
      if (!patient || patient.length === 0) {
        return null;
      }
      
      return patient[0];
    } catch (error) {
      console.error('Get patient by user ID error:', error);
      throw new Error('Failed to retrieve patient');
    }
  }

  /**
   * Get patient's user ID
   * @param {string} patientId - Patient ID
   * @returns {string} User ID
   */
  async getPatientUserId(patientId) {
    try {
      const patient = await Patient.findById(patientId).select('userId');
      return patient ? patient.userId : null;
    } catch (error) {
      console.error('Get patient user ID error:', error);
      throw new Error('Failed to retrieve patient user ID');
    }
  }

  /**
   * Create new patient
   * @param {Object} patientData - Patient data
   * @returns {Object} New patient
   */
  async createPatient(patientData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Verify that the user exists and is not already a patient
      const user = await User.findById(patientData.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const existingPatient = await Patient.findOne({ userId: patientData.userId });
      if (existingPatient) {
        throw new Error('User is already a patient');
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
        userId: patientData.userId,
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
      return this.getPatientById(patient[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create patient error:', error);
      throw new Error(error.message || 'Failed to create patient');
    } finally {
      session.endSession();
    }
  }

  /**
   * Update patient
   * @param {string} patientId - Patient ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated patient
   */
  async updatePatient(patientId, updateData) {
    try {
    // Validate ObjectId
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
        throw new Error('Invalid ID format');
    }

      // Check if patient exists
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return null;
      }
      
      // Update patient
      const updatedPatient = await Patient.findByIdAndUpdate(
        patientId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedPatient) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: patient.userId,
        action: 'update',
        resource: 'patient',
        resourceId: patientId,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete patient with user info
      return this.getPatientById(patientId);
    } catch (error) {
      console.error('Update patient error:', error);
      throw new Error('Failed to update patient');
    }
  }

  /**
   * Update patient by user ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated patient
   */
  async updatePatientByUserId(userId, updateData) {
    try {
      // Find patient by user ID
      const patient = await Patient.findOne({ userId });
      if (!patient) {
        return null;
      }
      
      // Update patient
      const updatedPatient = await Patient.findByIdAndUpdate(
        patient._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedPatient) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: userId,
        action: 'update',
        resource: 'patient',
        resourceId: patient._id,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete patient with user info
      return this.getPatientByUserId(userId);
    } catch (error) {
      console.error('Update patient by user ID error:', error);
      throw new Error('Failed to update patient');
    }
  }

  /**
   * Delete patient
   * @param {string} patientId - Patient ID to delete
   * @returns {boolean} Success status
   */
  async deletePatient(patientId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the patient first
      const patient = await Patient.findById(patientId);
      if (!patient) {
        return false;
      }
      
      // Delete the patient record
      await Patient.findByIdAndDelete(patientId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: patient.userId,
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
      console.error('Delete patient error:', error);
      throw new Error('Failed to delete patient');
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
      const patient = await Patient.findById(patientId).select('medicalHistory');
      if (!patient) {
        return null;
      }
      
      return patient.medicalHistory || [];
    } catch (error) {
      console.error('Get medical history error:', error);
      throw new Error('Failed to retrieve medical history');
    }
  }
}

export default new PatientService();