// src/services/staffService.mjs

import { Staff, User, AuditLog } from '../models/index.mjs';
import mongoose from 'mongoose';

/**
 * Staff Management Service
 */
class StaffService {
  /**
   * Get all staff members with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Staff members and pagination info
   */
  async getAllStaffMembers(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'createdAt',
        order = 'desc',
        position,
        department,
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
      
      // Filter by position if provided
      if (position) {
        matchConditions.position = position;
      }
      
      // Filter by department if provided
      if (department) {
        matchConditions.department = { $regex: department, $options: 'i' };
      }
      
      // Add search functionality
      if (search) {
        matchConditions.$or = [
          { 'user.firstName': { $regex: search, $options: 'i' } },
          { 'user.lastName': { $regex: search, $options: 'i' } },
          { 'user.email': { $regex: search, $options: 'i' } },
          { department: { $regex: search, $options: 'i' } }
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
          position: 1,
          department: 1,
          permissions: 1,
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
      const staff = await Staff.aggregate(pipeline);
      
      // Get the total count for pagination
      const countResult = await Staff.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        staff,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Get all staff members error:', error);
      throw new Error('Failed to retrieve staff members');
    }
  }

  /**
   * Get staff member by ID
   * @param {string} staffId - Staff ID
   * @returns {Object} Staff member with user information
   */
  async getStaffById(staffId) {
    try {
        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(staffId)) {
            throw new Error('Invalid ID format');
        }
        
      // Use aggregation to get staff and user data in one query
      const staff = await Staff.aggregate([
        {
          $match: { _id: mongoose.Types.ObjectId(staffId) }
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
            position: 1,
            department: 1,
            permissions: 1,
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
      
      if (!staff || staff.length === 0) {
        return null;
      }
      
      return staff[0];
    } catch (error) {
      console.error('Get staff by ID error:', error);
      throw new Error('Failed to retrieve staff member');
    }
  }

  /**
   * Get staff member by user ID
   * @param {string} userId - User ID
   * @returns {Object} Staff member with user information
   */
  async getStaffByUserId(userId) {
    try {
      // Use aggregation to get staff and user data in one query
      const staff = await Staff.aggregate([
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
            position: 1,
            department: 1,
            permissions: 1,
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
      
      if (!staff || staff.length === 0) {
        return null;
      }
      
      return staff[0];
    } catch (error) {
      console.error('Get staff by user ID error:', error);
      throw new Error('Failed to retrieve staff member');
    }
  }

  /**
   * Get staff member's user ID
   * @param {string} staffId - Staff ID
   * @returns {string} User ID
   */
  async getStaffUserId(staffId) {
    try {
      const staff = await Staff.findById(staffId).select('userId');
      return staff ? staff.userId : null;
    } catch (error) {
      console.error('Get staff user ID error:', error);
      throw new Error('Failed to retrieve staff user ID');
    }
  }

  /**
   * Create new staff member
   * @param {Object} staffData - Staff data
   * @returns {Object} New staff member
   */
  async createStaff(staffData) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Verify that the user exists and is not already a staff member
      const user = await User.findById(staffData.userId);
      if (!user) {
        throw new Error('User not found');
      }
      
      const existingStaff = await Staff.findOne({ userId: staffData.userId });
      if (existingStaff) {
        throw new Error('User is already a staff member');
      }
      
      // Update user role if needed
      if (user.role !== 'staff') {
        user.role = 'staff';
        await user.save({ session });
      }
      
      // Create staff record
      const staff = await Staff.create([{
        userId: staffData.userId,
        position: staffData.position,
        department: staffData.department,
        permissions: staffData.permissions || []
      }], { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: staffData.userId,
        action: 'create',
        resource: 'staff',
        resourceId: staff[0]._id,
        details: {
          position: staffData.position,
          department: staffData.department
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Return the complete staff member with user info
      return this.getStaffById(staff[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create staff error:', error);
      throw new Error(error.message || 'Failed to create staff member');
    } finally {
      session.endSession();
    }
  }

  /**
   * Update staff member
   * @param {string} staffId - Staff ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated staff member
   */
  async updateStaff(staffId, updateData) {
    try {
      // Check if staff member exists
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return null;
      }
      
      // Update staff
      const updatedStaff = await Staff.findByIdAndUpdate(
        staffId,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedStaff) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: staff.userId,
        action: 'update',
        resource: 'staff',
        resourceId: staffId,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete staff member with user info
      return this.getStaffById(staffId);
    } catch (error) {
      console.error('Update staff error:', error);
      throw new Error('Failed to update staff member');
    }
  }

  /**
   * Update staff member by user ID
   * @param {string} userId - User ID
   * @param {Object} updateData - Data to update
   * @returns {Object} Updated staff member
   */
  async updateStaffByUserId(userId, updateData) {
    try {
      // Find staff member by user ID
      const staff = await Staff.findOne({ userId });
      if (!staff) {
        return null;
      }
      
      // Update staff
      const updatedStaff = await Staff.findByIdAndUpdate(
        staff._id,
        { $set: updateData },
        { new: true, runValidators: true }
      );
      
      if (!updatedStaff) {
        return null;
      }
      
      // Create audit log
      await AuditLog.create({
        userId: userId,
        action: 'update',
        resource: 'staff',
        resourceId: staff._id,
        details: {
          updatedFields: Object.keys(updateData)
        }
      });
      
      // Return complete staff member with user info
      return this.getStaffByUserId(userId);
    } catch (error) {
      console.error('Update staff by user ID error:', error);
      throw new Error('Failed to update staff member');
    }
  }

  /**
   * Delete staff member
   * @param {string} staffId - Staff ID to delete
   * @returns {boolean} Success status
   */
  async deleteStaff(staffId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the staff member first
      const staff = await Staff.findById(staffId);
      if (!staff) {
        return false;
      }
      
      // Delete the staff record
      await Staff.findByIdAndDelete(staffId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: staff.userId,
        action: 'delete',
        resource: 'staff',
        resourceId: staffId
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Delete staff error:', error);
      throw new Error('Failed to delete staff member');
    } finally {
      session.endSession();
    }
  }
}

export default new StaffService();