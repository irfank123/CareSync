// src/middleware/permission/permissionMiddleware.mjs

import { AppError } from '../../utils/errorHandler.mjs';
import mongoose from 'mongoose';

/**
 * Middleware for handling permissions and access control
 */
const permissionMiddleware = {
  /**
   * Check if user has one of the required roles
   * @param  {...string} roles - Roles allowed to access the route
   * @returns {Function} Middleware function
   */
  hasRole: (...roles) => {
    return (req, res, next) => {
      if (!req.user || !req.userRole) {
        return res.status(401).json({ 
          success: false,
          message: 'Authentication required'
        });
      }
      
      if (!roles.includes(req.userRole)) {
        return res.status(403).json({ 
          success: false,
          message: 'You do not have permission to perform this action'
        });
      }
      
      next();
    };
  },
  
  /**
   * Check if user owns a resource or has admin/staff role
   * @param {Function} getResourceOwnerIdFn - Function to get resource owner ID
   * @param {string} paramIdField - Request parameter containing resource ID
   * @returns {Function} Middleware function
   */
  isOwnerOrAdmin: (getResourceOwnerIdFn, paramIdField = 'id') => {
    return async (req, res, next) => {
      try {
        // Admins and staff bypass ownership check
        if (['admin', 'staff'].includes(req.userRole)) {
          return next();
        }
        
        const resourceId = req.params[paramIdField];
        
        // Validate MongoDB ID format
        if (!mongoose.Types.ObjectId.isValid(resourceId)) {
          return next(new AppError('Invalid ID format', 400));
        }
        
        // Get owner ID
        const ownerId = await getResourceOwnerIdFn(resourceId);
        
        // Check if user is owner
        const isOwner = ownerId && req.user._id.toString() === ownerId.toString();
        
        if (!isOwner) {
          return next(new AppError('You do not have permission to access this resource', 403));
        }
        
        next();
      } catch (error) {
        next(new AppError('Error checking resource ownership', 500));
      }
    };
  },
  
  /**
   * Check if user belongs to the same clinic as the resource
   * @param {Function} getResourceClinicIdFn - Function to get resource clinic ID
   * @param {string} paramIdField - Request parameter containing resource ID
   * @returns {Function} Middleware function
   */
  isSameClinic: (getResourceClinicIdFn, paramIdField = 'id') => {
    return async (req, res, next) => {
      try {
        // Global admins bypass clinic check
        if (req.userRole === 'admin' && !req.clinicId) {
          return next();
        }
        
        const resourceId = req.params[paramIdField];
        
        // Validate MongoDB ID format
        if (!mongoose.Types.ObjectId.isValid(resourceId)) {
          return next(new AppError('Invalid ID format', 400));
        }
        
        // Get resource clinic ID
        const resourceClinicId = await getResourceClinicIdFn(resourceId);
        
        // Check if user belongs to the same clinic
        const isSameClinic = 
          resourceClinicId && 
          req.clinicId && 
          resourceClinicId.toString() === req.clinicId.toString();
        
        if (!isSameClinic) {
          return next(new AppError('You do not have permission to access resources from another clinic', 403));
        }
        
        next();
      } catch (error) {
        next(new AppError('Error checking clinic association', 500));
      }
    };
  },
  
  /**
   * Check specific permissions for patients
   */
  patient: {
    /**
     * Ensure requesting user can access the patient's data
     * @param {Function} getPatientUserIdFn - Function to get patient's user ID
     * @param {string} paramIdField - Request parameter containing patient ID
     * @returns {Function} Middleware function
     */
    canAccess: (getPatientUserIdFn, paramIdField = 'patientId') => {
      return async (req, res, next) => {
        try {
          // Admin, doctor, staff can access all patients
          if (['admin', 'doctor', 'staff'].includes(req.userRole)) {
            return next();
          }
          
          const patientId = req.params[paramIdField];
          
          // Validate MongoDB ID format
          if (!mongoose.Types.ObjectId.isValid(patientId)) {
            return next(new AppError('Invalid patient ID format', 400));
          }
          
          // Get patient's user ID
          const patientUserId = await getPatientUserIdFn(patientId);
          
          // Check if requesting user is the patient
          const isSelf = patientUserId && req.user._id.toString() === patientUserId.toString();
          
          if (!isSelf) {
            return next(new AppError('You are not authorized to access this patient data', 403));
          }
          
          next();
        } catch (error) {
          next(new AppError('Error checking patient access permission', 500));
        }
      };
    }
  },
  
  /**
   * Check specific permissions for doctors
   */
  doctor: {
    /**
     * Ensure requesting user can access the doctor's data
     * @param {Function} getDoctorUserIdFn - Function to get doctor's user ID
     * @param {string} paramIdField - Request parameter containing doctor ID
     * @returns {Function} Middleware function
     */
    canAccess: (getDoctorUserIdFn, paramIdField = 'doctorId') => {
      return async (req, res, next) => {
        try {
          // Admin and staff can access all doctors
          if (['admin', 'staff'].includes(req.userRole)) {
            return next();
          }
          
          const doctorId = req.params[paramIdField];
          
          // Validate MongoDB ID format
          if (!mongoose.Types.ObjectId.isValid(doctorId)) {
            return next(new AppError('Invalid doctor ID format', 400));
          }
          
          // Get doctor's user ID
          const doctorUserId = await getDoctorUserIdFn(doctorId);
          
          // Check if requesting user is the doctor
          const isSelf = doctorUserId && req.user._id.toString() === doctorUserId.toString();
          
          if (!isSelf) {
            return next(new AppError('You are not authorized to access this doctor data', 403));
          }
          
          next();
        } catch (error) {
          next(new AppError('Error checking doctor access permission', 500));
        }
      };
    }
  },
  
  /**
   * Check specific permissions for appointments
   */
  appointment: {
    /**
     * Ensure requesting user can access the appointment
     * @param {Function} getAppointmentDetailsFn - Function to get appointment details
     * @param {string} paramIdField - Request parameter containing appointment ID
     * @returns {Function} Middleware function
     */
    canAccess: (getAppointmentDetailsFn, paramIdField = 'id') => {
      return async (req, res, next) => {
        try {
          // Admin and staff can access all appointments
          if (['admin', 'staff'].includes(req.userRole)) {
            return next();
          }
          
          const appointmentId = req.params[paramIdField];
          
          // Validate MongoDB ID format
          if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
            return next(new AppError('Invalid appointment ID format', 400));
          }
          
          // Get appointment details
          const { patientUserId, doctorUserId } = await getAppointmentDetailsFn(appointmentId);
          
          // Check if requesting user is the patient or doctor involved
          const isInvolved = 
            (patientUserId && req.user._id.toString() === patientUserId.toString()) ||
            (doctorUserId && req.user._id.toString() === doctorUserId.toString());
          
          if (!isInvolved) {
            return next(new AppError('You are not authorized to access this appointment', 403));
          }
          
          next();
        } catch (error) {
          next(new AppError('Error checking appointment access permission', 500));
        }
      };
    }
  }
};

export default permissionMiddleware;