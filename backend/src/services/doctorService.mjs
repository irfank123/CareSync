// src/services/doctorService.mjs

import { Doctor, User, TimeSlot, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';

/**
 * Doctor Management Service
 */
class DoctorService {
  /**
   * Get all doctors with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Doctors and pagination info
   */
  async getAllDoctors(options) {
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
      });
      
      // Execute the aggregation pipeline
      const doctors = await Doctor.aggregate(pipeline);
      
      // Get the total count for pagination
      const countResult = await Doctor.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        doctors,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Get all doctors error:', error);
      throw new Error('Failed to retrieve doctors');
    }
  }

  /**
 * Get doctor by ID
 * @param {string} doctorId - Doctor ID
 * @returns {Object} Doctor with user information
 */
async getDoctorById(doctorId) {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(doctorId)) {
        throw new Error('Invalid doctor ID format');
      }
      
      // Use aggregation to get doctor and user data in one query
      const doctor = await Doctor.aggregate([
        {
          $match: { _id: mongoose.Types.ObjectId(doctorId) }
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
      ]);
      
      if (!doctor || doctor.length === 0) {
        return null;
      }
      
      return doctor[0];
    } catch (error) {
      console.error('Get doctor by ID error:', error);
      throw new Error(`Failed to retrieve doctor: ${error.message}`);
    }
  }

  /**
   * Get doctor by user ID
   * @param {string} userId - User ID
   * @returns {Object} Doctor with user information
   */
  async getDoctorByUserId(userId) {
    try {
      // Use aggregation to get doctor and user data in one query
      const doctor = await Doctor.aggregate([
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
      ]);
      
      if (!doctor || doctor.length === 0) {
        return null;
      }
      
      return doctor[0];
    } catch (error) {
      console.error('Get doctor by user ID error:', error);
      throw new Error('Failed to retrieve doctor');
    }
  }

  /**
   * Get doctor's user ID
   * @param {string} doctorId - Doctor ID
   * @returns {string} User ID
   */
  async getDoctorUserId(doctorId) {
    try {
      const doctor = await Doctor.findById(doctorId).select('userId');
      return doctor ? doctor.userId : null;
    } catch (error) {
      console.error('Get doctor user ID error:', error);
      throw new Error('Failed to retrieve doctor user ID');
    }
  }

  /**
   * Create new doctor
   * @param {Object} doctorData - Doctor data
   * @returns {Object} New doctor
   */
  async createDoctor(doctorData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Verify that the user exists and is not already a doctor
      const user = await User.findById(doctorData.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const existingDoctor = await Doctor.findOne({ userId: doctorData.userId });
      if (existingDoctor) {
        throw new Error('User is already a doctor');
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
        userId: doctorData.userId,
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
      return this.getDoctorById(doctor[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create doctor error:', error);
      throw new Error(error.message || 'Failed to create doctor');
    } finally {
      session.endSession();
    }
  }

  /**
   * Update doctor
   * @param {string} doctorId - Doctor ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated doctor
   */
  async updateDoctor(doctorId, updateData) {
    try {
      // Check if doctor exists
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return null;
      }
      
      // Update doctor
      const updatedDoctor = await Doctor.findByIdAndUpdate(
        doctorId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedDoctor) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: doctor.userId,
        action: 'update',
        resource: 'doctor',
        resourceId: doctorId,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete doctor with user info
      return this.getDoctorById(doctorId);
    } catch (error) {
      console.error('Update doctor error:', error);
      throw new Error('Failed to update doctor');
    }
  }

  /**
   * Update doctor by user ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated doctor
   */
  async updateDoctorByUserId(userId, updateData) {
    try {
      // Find doctor by user ID
      const doctor = await Doctor.findOne({ userId });
      if (!doctor) {
        return null;
      }
      
      // Update doctor
      const updatedDoctor = await Doctor.findByIdAndUpdate(
        doctor._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedDoctor) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: userId,
        action: 'update',
        resource: 'doctor',
        resourceId: doctor._id,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete doctor with user info
      return this.getDoctorByUserId(userId);
    } catch (error) {
      console.error('Update doctor by user ID error:', error);
      throw new Error('Failed to update doctor');
    }
  }

  /**
   * Delete doctor
   * @param {string} doctorId - Doctor ID to delete
   * @returns {boolean} Success status
   */
  async deleteDoctor(doctorId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the doctor first
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
        userId: doctor.userId,
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
      console.error('Delete doctor error:', error);
      throw new Error('Failed to delete doctor');
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
      // Default to retrieving the next 7 days if dates aren't provided
      const today = new Date();
      const start = startDate || today;
      const end = endDate || new Date(today.setDate(today.getDate() + 7));
      
      // Get the doctor to access their schedule
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Get all time slots for this doctor in the date range
      const timeSlots = await TimeSlot.find({
        doctorId,
        date: { $gte: start, $lte: end },
        status: 'available'
      }).sort({ date: 1, startTime: 1 });
      
      // If there are no pre-generated time slots, generate them based on doctor's schedule
      if (timeSlots.length === 0) {
        // Generate temporary slots based on the doctor's availability schedule
        const generatedSlots = [];
        
        // Iterate through each day in the date range
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
          const currentDate = new Date(d);
          const dayOfWeek = currentDate.getDay(); // 0-6 (Sunday-Saturday)
          
          // Find the schedule for this day of week
          const daySchedule = doctor.availabilitySchedule.find(
            schedule => schedule.dayOfWeek === dayOfWeek && schedule.isAvailable
          );
          
          // Skip if no schedule for this day or not available
          if (!daySchedule) continue;
          
          // Check if this is a vacation day
          const isVacationDay = doctor.vacationDays.some(
            vacation => 
              vacation.date.getFullYear() === currentDate.getFullYear() &&
              vacation.date.getMonth() === currentDate.getMonth() &&
              vacation.date.getDate() === currentDate.getDate() &&
              !vacation.isWorkDay
          );
          
          // Skip if vacation day
          if (isVacationDay) continue;
          
          // Parse start and end times
          const [startHour, startMinute] = daySchedule.startTime.split(':').map(Number);
          const [endHour, endMinute] = daySchedule.endTime.split(':').map(Number);
          
          // Use doctor's appointment duration or default
          const appointmentDuration = doctor.appointmentDuration || 30; // in minutes
          const slotStart = new Date(currentDate);
          slotStart.setHours(startHour, startMinute, 0, 0);
          
          const slotEnd = new Date(currentDate);
          slotEnd.setHours(endHour, endMinute, 0, 0);
          
          // Generate slots while slot end time is before the end of day
          while (slotStart.getTime() + appointmentDuration * 60000 <= slotEnd.getTime()) {
            const slotEndTime = new Date(slotStart.getTime() + appointmentDuration * 60000);
            
            generatedSlots.push({
              doctorId,
              date: new Date(slotStart),
              startTime: slotStart.toTimeString().substring(0, 5),
              endTime: slotEndTime.toTimeString().substring(0, 5),
              status: 'available',
              generated: true // Flag to indicate this is a generated slot, not from database
            });
            
            // Move to next slot
            slotStart.setTime(slotStart.getTime() + appointmentDuration * 60000);
          }
        }
        
        return generatedSlots;
      }
      
      return timeSlots;
    } catch (error) {
      console.error('Get doctor availability error:', error);
      throw new Error('Failed to retrieve doctor availability');
    }
  }
}

export default new DoctorService();