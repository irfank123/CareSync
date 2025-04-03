// src/services/doctorService.mjs

import BaseService from './base/baseService.mjs';
import { Doctor, User, TimeSlot, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Doctor Service extending the BaseService
 */
class DoctorService extends BaseService {
  constructor() {
    // Configure base service with Doctor model and options
    super(Doctor, 'Doctor', {
      // Fields to populate when fetching doctors
      populateFields: [
        { path: 'userId', select: 'firstName lastName email phoneNumber isActive' }
      ],
      // Fields to use for text search
      searchFields: ['userId.firstName', 'userId.lastName', 'userId.email', 'specialties'],
      // This service supports clinic associations
      supportsClinic: true
    });
  }
  
  /**
   * Override getAll to support complex queries with aggregation pipeline
   * @param {Object} options - Query options
   * @returns {Object} Doctors and pagination info
   */
  async getAll(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'createdAt',
        order = 'desc',
        specialty,
        acceptingNewPatients,
        minFee,
        maxFee,
        clinicId
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
      
      // Filter by specialty if provided
      if (specialty) {
        matchConditions.specialties = specialty;
      }
      
      // Filter by accepting new patients
      if (acceptingNewPatients !== undefined) {
        matchConditions.acceptingNewPatients = acceptingNewPatients;
      }
      
      // Filter by fee range
      if (minFee !== undefined || maxFee !== undefined) {
        matchConditions.appointmentFee = {};
        
        if (minFee !== undefined) {
          matchConditions.appointmentFee.$gte = minFee;
        }
        
        if (maxFee !== undefined) {
          matchConditions.appointmentFee.$lte = maxFee;
        }
      }
      
      // Add search functionality
      if (search) {
        matchConditions.$or = [
          { 'user.firstName': { $regex: search, $options: 'i' } },
          { 'user.lastName': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } },
          { specialties: { $regex: search, $options: 'i' } }
        ];
      }
      
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }
      
      // Stage 4: Sort the results
      const sortDirection = order === 'desc' ? -1 : 1;
      const sortField = sort.startsWith('user.') ? sort : (
        sort === 'createdAt' ? 'user.createdAt' : sort
      );
      
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
                specialties: 1,
                licenseNumber: 1,
                deaNumber: 1,
                education: 1,
                availabilitySchedule: 1,
                vacationDays: 1,
                maxAppointmentsPerDay: 1,
                appointmentDuration: 1,
                acceptingNewPatients: 1,
                appointmentFee: 1,
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
      const [result] = await Doctor.aggregate(pipeline);
      
      const doctors = result.data || [];
      const total = result.count.length > 0 ? result.count[0].total : 0;
      
      return {
        data: doctors,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page, 10)
      };
    } catch (error) {
      this._handleError(error, 'Failed to retrieve doctors');
    }
  }
  
  /**
   * Get doctor's user ID
   * @param {string} doctorId - Doctor ID
   * @returns {string} User ID
   */
  async getDoctorUserId(doctorId) {
    try {
      this._validateId(doctorId);
      
      const doctor = await Doctor.findById(doctorId).select('userId');
      return doctor ? doctor.userId : null;
    } catch (error) {
      this._handleError(error, 'Failed to retrieve doctor user ID');
    }
  }
  
  /**
   * Override create to handle user role update
   * @param {Object} doctorData - Doctor data
   * @param {string} createdBy - User ID creating the doctor
   * @returns {Object} Created doctor
   */
  async create(doctorData, createdBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      // Verify that the user exists and is not already a doctor
      const user = await User.findById(doctorData.userId);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      
      const existingDoctor = await Doctor.findOne({ userId: doctorData.userId });
      if (existingDoctor) {
        throw new AppError('User is already a doctor', 400);
      }
      
      // Update user role if needed
      if (user.role !== 'doctor') {
        user.role = 'doctor';
        await user.save({ session });
      }
      
      // Create doctor record
      const doctor = await Doctor.create([{
        userId: doctorData.userId,
        specialties: doctorData.specialties || [],
        licenseNumber: doctorData.licenseNumber,
        deaNumber: doctorData.deaNumber,
        education: doctorData.education || [],
        availabilitySchedule: doctorData.availabilitySchedule || [],
        vacationDays: doctorData.vacationDays || [],
        maxAppointmentsPerDay: doctorData.maxAppointmentsPerDay || 20,
        appointmentDuration: doctorData.appointmentDuration || 30,
        acceptingNewPatients: doctorData.acceptingNewPatients !== false,
        appointmentFee: doctorData.appointmentFee
      }], { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: createdBy,
        action: 'create',
        resource: 'doctor',
        resourceId: doctor[0]._id,
        details: {
          specialties: doctorData.specialties,
          licenseNumber: doctorData.licenseNumber
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Return the complete doctor with user info
      return this.getById(doctor[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      this._handleError(error, 'Failed to create doctor');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Override delete to handle time slots and appointments
   * @param {string} doctorId - Doctor ID to delete
   * @param {string} deletedBy - User ID deleting the doctor
   * @returns {boolean} Success status
   */
  async delete(doctorId, deletedBy) {
    const session = await this.startSession();
    session.startTransaction();
    
    try {
      this._validateId(doctorId);
      
      // Find the doctor first to get user ID
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return false;
      }
      
      // Delete all time slots associated with this doctor
      await TimeSlot.deleteMany({ doctorId }, { session });
      
      // Delete the doctor record
      await Doctor.findByIdAndDelete(doctorId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: deletedBy,
        action: 'delete',
        resource: 'doctor',
        resourceId: doctorId
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      this._handleError(error, 'Failed to delete doctor');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get doctor's availability
   * @param {string} doctorId - Doctor ID
   * @param {Date} startDate - Start date for availability range
   * @param {Date} endDate - End date for availability range
   * @returns {Array} Available time slots
   */
  async getDoctorAvailability(doctorId, startDate, endDate) {
    try {
      this._validateId(doctorId);
      
      // Default to retrieving the next 7 days if dates aren't provided
      const today = new Date();
      const start = startDate || today;
      const end = endDate || new Date(today.setDate(today.getDate() + 7));
      
      // Get the doctor to access their schedule
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new AppError('Doctor not found', 404);
      }
      
      // Get all time slots for this doctor in the date range
      const timeSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end },
        status: 'available'
      }).sort({ date: 1, startTime: 1 });
      
      return timeSlots;
    } catch (error) {
      this._handleError(error, 'Failed to retrieve doctor availability');
    }
  }
}

// Create single instance of DoctorService
const doctorService = new DoctorService();

export default doctorService;