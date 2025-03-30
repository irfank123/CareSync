// src/controllers/adminController.mjs

import mongoose from 'mongoose';
import { check, validationResult } from 'express-validator';
import { User, AuditLog } from '../models/index.mjs';
import clinicAuthService from '../services/clinicAuthService.mjs';
import emailService from '../services/emailService.mjs';

// Get Clinic model from mongoose
const Clinic = mongoose.model('Clinic');

/**
 * @desc    Get all clinics
 * @route   GET /api/admin/clinics
 * @access  Private (Admin Only)
 */
export const getClinics = async (req, res) => {
  try {
    // Add pagination
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const startIndex = (page - 1) * limit;
    
    // Add filtering
    const filter = {};
    
    if (req.query.status) {
      filter.verificationStatus = req.query.status;
    }
    
    if (req.query.search) {
      filter.$or = [
        { name: { $regex: req.query.search, $options: 'i' } },
        { email: { $regex: req.query.search, $options: 'i' } }
      ];
    }
    
    // Execute query
    const clinics = await Clinic.find(filter)
      .skip(startIndex)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    // Get total count
    const total = await Clinic.countDocuments(filter);
    
    // Sanitize clinic data
    const sanitizedClinics = clinics.map(clinic => clinicAuthService.sanitizeClinicData(clinic));
    
    res.status(200).json({
      success: true,
      count: clinics.length,
      total,
      totalPages: Math.ceil(total / limit),
      currentPage: page,
      data: sanitizedClinics
    });
  } catch (error) {
    console.error('Get clinics error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clinics'
    });
  }
};

/**
 * @desc    Get single clinic
 * @route   GET /api/admin/clinics/:id
 * @access  Private (Admin Only)
 */
export const getClinic = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Get admin user
    const adminUser = await User.findById(clinic.adminUserId);
    
    res.status(200).json({
      success: true,
      data: {
        clinic: clinicAuthService.sanitizeClinicData(clinic),
        adminUser: adminUser ? {
          _id: adminUser._id,
          firstName: adminUser.firstName,
          lastName: adminUser.lastName,
          email: adminUser.email,
          phoneNumber: adminUser.phoneNumber,
          role: adminUser.role
        } : null
      }
    });
  } catch (error) {
    console.error('Get clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clinic'
    });
  }
};

/**
 * @desc    Update clinic verification status
 * @route   PUT /api/admin/clinics/:id/verification
 * @access  Private (Admin Only)
 */
export const updateClinicVerification = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ 
        success: false, 
        errors: errors.array() 
      });
    }
    
    const { status, notes } = req.body;
    
    if (!['pending', 'in_review', 'verified', 'rejected'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification status'
      });
    }
    
    const clinic = await clinicAuthService.updateVerificationStatus(
      req.params.id,
      status,
      notes
    );
    
    // Create audit log
    await AuditLog.create({
      userId: req.user._id,
      action: 'update',
      resource: 'clinic',
      resourceId: req.params.id,
      details: {
        field: 'verificationStatus',
        oldValue: clinic.verificationStatus,
        newValue: status,
        notes
      }
    });
    
    res.status(200).json({
      success: true,
      data: clinic
    });
  } catch (error) {
    console.error('Update clinic verification error:', error);
    res.status(400).json({ 
      success: false,
      message: error.message || 'Could not update verification status' 
    });
  }
};

/**
 * @desc    Get clinic verification documents
 * @route   GET /api/admin/clinics/:id/documents
 * @access  Private (Admin Only)
 */
export const getClinicDocuments = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    res.status(200).json({
      success: true,
      data: clinic.verificationDocuments || []
    });
  } catch (error) {
    console.error('Get clinic documents error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clinic documents'
    });
  }
};

/**
 * @desc    Get clinic staff members
 * @route   GET /api/admin/clinics/:id/staff
 * @access  Private (Admin Only)
 */
export const getClinicStaff = async (req, res) => {
  try {
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Get all staff associated with this clinic
    const staffUsers = await User.find({
      clinicId: clinic._id,
      role: { $in: ['admin', 'staff'] }
    }).select('-passwordHash');
    
    res.status(200).json({
      success: true,
      count: staffUsers.length,
      data: staffUsers
    });
  } catch (error) {
    console.error('Get clinic staff error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while fetching clinic staff'
    });
  }
};

/**
 * @desc    Suspend clinic
 * @route   PUT /api/admin/clinics/:id/suspend
 * @access  Private (Admin Only)
 */
export const suspendClinic = async (req, res) => {
  try {
    const { reason } = req.body;
    
    const clinic = await Clinic.findById(req.params.id);
    
    if (!clinic) {
      return res.status(404).json({
        success: false,
        message: 'Clinic not found'
      });
    }
    
    // Toggle suspension status
    const wasSuspended = clinic.isActive === false;
    clinic.isActive = !wasSuspended;
    
    await clinic.save();
    
    // Create audit log
    await AuditLog.create({
      userId: req.user._id,
      action: wasSuspended ? 'unsuspend' : 'suspend',
      resource: 'clinic',
      resourceId: req.params.id,
      details: {
        reason: reason || 'No reason provided'
      }
    });
    
    // Send notification to clinic
    if (!wasSuspended) {
      try {
        await emailService.sendEmail({
          to: clinic.email,
          subject: 'Account Suspension Notice',
          html: `
            <h1>Account Suspension</h1>
            <p>Your clinic account has been suspended for the following reason:</p>
            <p>${reason || 'Violation of terms of service'}</p>
            <p>Please contact support for more information.</p>
          `
        });
      } catch (emailError) {
        console.error('Suspension notification email error:', emailError);
      }
    }
    
    res.status(200).json({
      success: true,
      isSuspended: !wasSuspended,
      message: wasSuspended ? 'Clinic has been reactivated' : 'Clinic has been suspended'
    });
  } catch (error) {
    console.error('Suspend clinic error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error while suspending clinic'
    });
  }
};

// Export validation rules
export const updateVerificationValidation = [
  check('status', 'Status is required').isIn(['pending', 'in_review', 'verified', 'rejected']),
  check('notes', 'Notes are required when rejecting').custom((notes, { req }) => {
    if (req.body.status === 'rejected' && (!notes || notes.trim() === '')) {
      throw new Error('Notes are required when rejecting verification');
    }
    return true;
  })
];