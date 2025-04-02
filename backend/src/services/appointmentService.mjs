// src/services/appointmentService.mjs

import { Appointment, TimeSlot, User, Patient, Doctor, Assessment, AuditLog, Notification } from '../models/index.mjs';
import emailService from './emailService.mjs';
import mongoose from 'mongoose';
import config from '../config/config.mjs';

/**
 * Appointment Management Service
 */
class AppointmentService {
  /**
   * Get all appointments with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Appointments and pagination info
   */
  async getAllAppointments(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'date',
        order = 'desc',
        status,
        type,
        doctorId,
        patientId,
        startDate,
        endDate,
        clinicId
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build the aggregation pipeline
      const pipeline = [];
      
      // Stage 1: Match conditions
      const matchConditions = {};
      
      // Filter by status if provided
      if (status) {
        matchConditions.status = status;
      }
      
      // Filter by type if provided
      if (type) {
        matchConditions.type = type;
      }
      
      // Filter by doctor if provided
      if (doctorId) {
        matchConditions.doctorId = mongoose.Types.ObjectId(doctorId);
      }
      
      // Filter by patient if provided
      if (patientId) {
        matchConditions.patientId = mongoose.Types.ObjectId(patientId);
      }
      
      // Filter by date range
      if (startDate || endDate) {
        matchConditions.date = {};
        
        if (startDate) {
          matchConditions.date.$gte = new Date(startDate);
        }
        
        if (endDate) {
          matchConditions.date.$lte = new Date(endDate);
        }
      }
      
      if (Object.keys(matchConditions).length > 0) {
        pipeline.push({ $match: matchConditions });
      }
      
      // Stage 2: Join with Patient model
      pipeline.push({
        $lookup: {
          from: 'patients',
          localField: 'patientId',
          foreignField: '_id',
          as: 'patient'
        }
      });
      
      // Stage 3: Join with Doctor model
      pipeline.push({
        $lookup: {
          from: 'doctors',
          localField: 'doctorId',
          foreignField: '_id',
          as: 'doctor'
        }
      });
      
      // Stage 4: Unwind the arrays (from lookup)
      pipeline.push({
        $unwind: {
          path: '$patient',
          preserveNullAndEmptyArrays: true
        }
      });
      
      pipeline.push({
        $unwind: {
          path: '$doctor',
          preserveNullAndEmptyArrays: true
        }
      });
      
      // Stage 5: Join with User model for patient
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'patient.userId',
          foreignField: '_id',
          as: 'patientUser'
        }
      });
      
      // Stage 6: Join with User model for doctor
      pipeline.push({
        $lookup: {
          from: 'users',
          localField: 'doctor.userId',
          foreignField: '_id',
          as: 'doctorUser'
        }
      });
      
      // Stage 7: Unwind the arrays (from lookup)
      pipeline.push({
        $unwind: {
          path: '$patientUser',
          preserveNullAndEmptyArrays: true
        }
      });
      
      pipeline.push({
        $unwind: {
          path: '$doctorUser',
          preserveNullAndEmptyArrays: true
        }
      });
      
      // Filter by clinic if provided
      if (clinicId) {
        pipeline.push({
          $match: {
            '$or': [
              { 'patientUser.clinicId': mongoose.Types.ObjectId(clinicId) },
              { 'doctorUser.clinicId': mongoose.Types.ObjectId(clinicId) }
            ]
          }
        });
      }
      
      // Add search functionality
      if (search) {
        pipeline.push({
          $match: {
            $or: [
              { 'patientUser.firstName': { $regex: search, $options: 'i' } },
              { 'patientUser.lastName': { $regex: search, $options: 'i' } },
              { 'doctorUser.firstName': { $regex: search, $options: 'i' } },
              { 'doctorUser.lastName': { $regex: search, $options: 'i' } },
              { reasonForVisit: { $regex: search, $options: 'i' } }
            ]
          }
        });
      }
      
      // Stage 8: Sort the results
      const sortDirection = order === 'desc' ? -1 : 1;
      
      const sortStage = {};
      sortStage[sort] = sortDirection;
      pipeline.push({ $sort: sortStage });
      
      // Stage 9: Count total documents (for pagination)
      const countPipeline = [...pipeline];
      countPipeline.push({ $count: 'total' });
      
      // Stage 10: Skip and limit for pagination
      pipeline.push({ $skip: skip });
      pipeline.push({ $limit: limit });
      
      // Stage 11: Project the fields we want to return
      pipeline.push({
        $project: {
          _id: 1,
          patientId: 1,
          doctorId: 1,
          timeSlotId: 1,
          date: 1,
          startTime: 1,
          endTime: 1,
          type: 1,
          status: 1,
          notes: 1,
          reasonForVisit: 1,
          preliminaryAssessmentId: 1,
          isVirtual: 1,
          videoConferenceLink: 1,
          createdAt: 1,
          updatedAt: 1,
          cancelledAt: 1,
          cancelReason: 1,
          remindersSent: 1,
          'patient._id': 1,
          'patient.userId': 1,
          'doctor._id': 1,
          'doctor.userId': 1,
          'patientUser._id': 1,
          'patientUser.firstName': 1,
          'patientUser.lastName': 1,
          'patientUser.email': 1,
          'patientUser.phoneNumber': 1,
          'doctorUser._id': 1,
          'doctorUser.firstName': 1,
          'doctorUser.lastName': 1,
          'doctorUser.email': 1,
          'doctorUser.phoneNumber': 1
        }
      });
      
      // Execute the aggregation pipeline
      const appointments = await Appointment.aggregate(pipeline);
      
      // Get the total count for pagination
      const countResult = await Appointment.aggregate(countPipeline);
      const total = countResult.length > 0 ? countResult[0].total : 0;
      
      return {
        appointments,
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      console.error('Get all appointments error:', error);
      throw new Error('Failed to retrieve appointments');
    }
  }
  
  /**
   * Get appointment by ID
   * @param {string} appointmentId - Appointment ID
   * @returns {Object} Appointment with related info
   */
  async getAppointmentById(appointmentId) {
    try {
      // Validate ObjectId
      if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
        throw new Error('Invalid appointment ID format');
      }
      
      // Use aggregation to get appointment with related data
      const appointment = await Appointment.aggregate([
        {
          $match: { _id: mongoose.Types.ObjectId(appointmentId) }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $unwind: {
            path: '$patient',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$doctor',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'patient.userId',
            foreignField: '_id',
            as: 'patientUser'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'doctor.userId',
            foreignField: '_id',
            as: 'doctorUser'
          }
        },
        {
          $unwind: {
            path: '$patientUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$doctorUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'assessments',
            localField: 'preliminaryAssessmentId',
            foreignField: '_id',
            as: 'assessment'
          }
        },
        {
          $project: {
            _id: 1,
            patientId: 1,
            doctorId: 1,
            timeSlotId: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            status: 1,
            notes: 1,
            reasonForVisit: 1,
            preliminaryAssessmentId: 1,
            isVirtual: 1,
            videoConferenceLink: 1,
            createdAt: 1,
            updatedAt: 1,
            cancelledAt: 1,
            cancelReason: 1,
            remindersSent: 1,
            'patient._id': 1,
            'patient.userId': 1,
            'patient.dateOfBirth': 1,
            'patient.gender': 1,
            'patient.allergies': 1,
            'patient.currentMedications': 1,
            'doctor._id': 1,
            'doctor.userId': 1,
            'doctor.specialties': 1,
            'doctor.licenseNumber': 1,
            'patientUser._id': 1,
            'patientUser.firstName': 1,
            'patientUser.lastName': 1,
            'patientUser.email': 1,
            'patientUser.phoneNumber': 1,
            'doctorUser._id': 1,
            'doctorUser.firstName': 1,
            'doctorUser.lastName': 1,
            'doctorUser.email': 1,
            'doctorUser.phoneNumber': 1,
            'assessment': 1
          }
        }
      ]);
      
      if (!appointment || appointment.length === 0) {
        return null;
      }
      
      return appointment[0];
    } catch (error) {
      console.error('Get appointment by ID error:', error);
      throw new Error(`Failed to retrieve appointment: ${error.message}`);
    }
  }
  
  /**
   * Create new appointment
   * @param {Object} appointmentData - Appointment data
   * @param {string} userId - User creating the appointment
   * @returns {Object} Created appointment
   */
  async createAppointment(appointmentData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Check if patient exists
      if (!appointmentData.patientId || !mongoose.Types.ObjectId.isValid(appointmentData.patientId)) {
        throw new Error('Valid patient ID is required');
      }
      
      const patient = await Patient.findById(appointmentData.patientId);
      if (!patient) {
        throw new Error('Patient not found');
      }
      
      // Check if doctor exists
      if (!appointmentData.doctorId || !mongoose.Types.ObjectId.isValid(appointmentData.doctorId)) {
        throw new Error('Valid doctor ID is required');
      }
      
      const doctor = await Doctor.findById(appointmentData.doctorId);
      if (!doctor) {
        throw new Error('Doctor not found');
      }
      
      // Check if time slot exists and is available
      if (!appointmentData.timeSlotId || !mongoose.Types.ObjectId.isValid(appointmentData.timeSlotId)) {
        throw new Error('Valid time slot ID is required');
      }
      
      const timeSlot = await TimeSlot.findById(appointmentData.timeSlotId);
      if (!timeSlot) {
        throw new Error('Time slot not found');
      }
      
      if (timeSlot.status !== 'available') {
        throw new Error('Time slot is not available');
      }
      
      // Create assessment if provided
      let assessmentId = null;
      if (appointmentData.assessment) {
        const assessment = await Assessment.create([{
          patientId: appointmentData.patientId,
          appointmentId: null, // Will be updated after appointment creation
          symptoms: appointmentData.assessment.symptoms || [],
          responses: appointmentData.assessment.responses || [],
          aiGeneratedReport: appointmentData.assessment.aiGeneratedReport,
          severity: appointmentData.assessment.severity || 'low',
          status: 'completed',
          completionDate: new Date()
        }], { session });
        
        assessmentId = assessment[0]._id;
      }
      
      // Create appointment
      const appointment = await Appointment.create([{
        patientId: appointmentData.patientId,
        doctorId: appointmentData.doctorId,
        timeSlotId: appointmentData.timeSlotId,
        date: timeSlot.date,
        startTime: timeSlot.startTime,
        endTime: timeSlot.endTime,
        type: appointmentData.type || 'virtual',
        status: 'scheduled',
        notes: appointmentData.notes || '',
        reasonForVisit: appointmentData.reasonForVisit,
        preliminaryAssessmentId: assessmentId,
        isVirtual: appointmentData.isVirtual !== false,
        videoConferenceLink: appointmentData.isVirtual ? this._generateVideoLink() : null
      }], { session });
      
      // Update assessment with appointment ID if needed
      if (assessmentId) {
        await Assessment.findByIdAndUpdate(
          assessmentId,
          { appointmentId: appointment[0]._id },
          { session }
        );
      }
      
      // Update time slot to booked
      await TimeSlot.findByIdAndUpdate(
        appointmentData.timeSlotId,
        { status: 'booked' },
        { session }
      );
      
      // Create audit log
      await AuditLog.create([{
        userId: userId,
        action: 'create',
        resource: 'appointment',
        resourceId: appointment[0]._id,
        details: {
          patientId: appointmentData.patientId,
          doctorId: appointmentData.doctorId,
          date: timeSlot.date,
          type: appointmentData.type || 'virtual'
        }
      }], { session });
      
      // Send notifications
      await this._sendAppointmentNotifications(
        appointment[0],
        patient,
        doctor,
        'created',
        session
      );
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Get the complete appointment with related data
      return await this.getAppointmentById(appointment[0]._id);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Create appointment error:', error);
      throw new Error(`Failed to create appointment: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Update appointment
   * @param {string} appointmentId - Appointment ID
   * @param {Object} updateData - Data to update
   * @param {string} userId - User updating the appointment
   * @returns {Object} Updated appointment
   */
  async updateAppointment(appointmentId, updateData, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        throw new Error('Appointment not found');
      }
      
      // Create update object
      const updateObj = {};
      
      // Process specific fields
      if (updateData.status) {
        // Validate status transition
        if (!this._isValidStatusTransition(appointment.status, updateData.status)) {
          throw new Error(`Invalid status transition from ${appointment.status} to ${updateData.status}`);
        }
        
        updateObj.status = updateData.status;
        
        // Handle cancellation
        if (updateData.status === 'cancelled') {
          updateObj.cancelledAt = new Date();
          updateObj.cancelReason = updateData.cancelReason || 'No reason provided';
        }
      }
      
      // Add other updateable fields
      ['notes', 'type', 'reasonForVisit', 'isVirtual'].forEach(field => {
        if (updateData[field] !== undefined) {
          updateObj[field] = updateData[field];
        }
      });
      
      // Update videoConferenceLink based on isVirtual change if needed
      if (updateData.isVirtual !== undefined && updateData.isVirtual !== appointment.isVirtual) {
        updateObj.videoConferenceLink = updateData.isVirtual ? this._generateVideoLink() : null;
      }
      
      // Handle time slot changes
      if (updateData.timeSlotId && updateData.timeSlotId !== appointment.timeSlotId.toString()) {
        // Validate new time slot
        const newTimeSlot = await TimeSlot.findById(updateData.timeSlotId);
        if (!newTimeSlot) {
          throw new Error('New time slot not found');
        }
        
        if (newTimeSlot.status !== 'available') {
          throw new Error('New time slot is not available');
        }
        
        // Update the appointment with new slot info
        updateObj.timeSlotId = updateData.timeSlotId;
        updateObj.date = newTimeSlot.date;
        updateObj.startTime = newTimeSlot.startTime;
        updateObj.endTime = newTimeSlot.endTime;
        
        // Update time slots
        await TimeSlot.findByIdAndUpdate(
          appointment.timeSlotId,
          { status: 'available' },
          { session }
        );
        
        await TimeSlot.findByIdAndUpdate(
          updateData.timeSlotId,
          { status: 'booked' },
          { session }
        );
      }
      
      // Update the appointment
      const updatedAppointment = await Appointment.findByIdAndUpdate(
        appointmentId,
        { $set: updateObj },
        { new: true, session }
      );
      
      // Create audit log
      await AuditLog.create([{
        userId: userId,
        action: 'update',
        resource: 'appointment',
        resourceId: appointmentId,
        details: {
          updatedFields: Object.keys(updateObj),
          previousStatus: appointment.status,
          newStatus: updateObj.status
        }
      }], { session });
      
      // Get patient and doctor for notifications
      const patient = await Patient.findById(appointment.patientId);
      const doctor = await Doctor.findById(appointment.doctorId);
      
      // Send notifications if status changed
      if (updateObj.status && updateObj.status !== appointment.status) {
        await this._sendAppointmentNotifications(
          updatedAppointment,
          patient,
          doctor,
          updateObj.status,
          session
        );
      }
      
      // Commit the transaction
      await session.commitTransaction();
      
      // Get the complete updated appointment with related data
      return await this.getAppointmentById(appointmentId);
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Update appointment error:', error);
      throw new Error(`Failed to update appointment: ${error.message}`);
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Delete appointment
   * @param {string} appointmentId - Appointment ID
   * @param {string} userId - User deleting the appointment
   * @returns {boolean} Success status
   */
  async deleteAppointment(appointmentId, userId) {
    const session = await mongoose.startSession();
    session.startTransaction();
    
    try {
      // Find the appointment
      const appointment = await Appointment.findById(appointmentId);
      if (!appointment) {
        return false;
      }
      
      // Free up the time slot
      await TimeSlot.findByIdAndUpdate(
        appointment.timeSlotId,
        { status: 'available' },
        { session }
      );
      
      // Delete the appointment
      await Appointment.findByIdAndDelete(appointmentId, { session });
      
      // Create audit log
      await AuditLog.create([{
        userId: userId,
        action: 'delete',
        resource: 'appointment',
        resourceId: appointmentId,
        details: {
          patientId: appointment.patientId,
          doctorId: appointment.doctorId,
          date: appointment.date,
          status: appointment.status
        }
      }], { session });
      
      // Commit the transaction
      await session.commitTransaction();
      
      return true;
    } catch (error) {
      // Abort transaction on error
      await session.abortTransaction();
      console.error('Delete appointment error:', error);
      throw new Error('Failed to delete appointment');
    } finally {
      session.endSession();
    }
  }
  
  /**
   * Get patient's upcoming appointments
   * @param {string} patientId - Patient ID
   * @returns {Array} Upcoming appointments
   */
  async getPatientUpcomingAppointments(patientId) {
    try {
      // Current date
      const currentDate = new Date();
      
      // Get appointments
      const appointments = await Appointment.find({
        patientId,
        date: { $gte: currentDate },
        status: { $in: ['scheduled', 'checked-in'] }
      })
      .sort({ date: 1, startTime: 1 })
      .populate({
        path: 'doctorId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      });
      
      return appointments;
    } catch (error) {
      console.error('Get patient upcoming appointments error:', error);
      throw new Error('Failed to retrieve upcoming appointments');
    }
  }
  
  /**
   * Get doctor's upcoming appointments
   * @param {string} doctorId - Doctor ID
   * @returns {Array} Upcoming appointments
   */
  async getDoctorUpcomingAppointments(doctorId) {
    try {
      // Current date
      const currentDate = new Date();
      
      // Get appointments
      const appointments = await Appointment.find({
        doctorId,
        date: { $gte: currentDate },
        status: { $in: ['scheduled', 'checked-in'] }
      })
      .sort({ date: 1, startTime: 1 })
      .populate({
        path: 'patientId',
        populate: {
          path: 'userId',
          select: 'firstName lastName email'
        }
      });
      
      return appointments;
    } catch (error) {
      console.error('Get doctor upcoming appointments error:', error);
      throw new Error('Failed to retrieve upcoming appointments');
    }
  }
  
  /**
   * Get today's appointments for clinic
   * @param {string} clinicId - Clinic ID
   * @returns {Array} Today's appointments
   */
  async getClinicTodayAppointments(clinicId) {
    try {
      // Get start and end of today
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      // Use aggregation to get appointments with clinic filter
      const appointments = await Appointment.aggregate([
        {
          $match: {
            date: { $gte: today, $lt: tomorrow },
            status: { $in: ['scheduled', 'checked-in', 'in-progress'] }
          }
        },
        {
          $lookup: {
            from: 'doctors',
            localField: 'doctorId',
            foreignField: '_id',
            as: 'doctor'
          }
        },
        {
          $lookup: {
            from: 'patients',
            localField: 'patientId',
            foreignField: '_id',
            as: 'patient'
          }
        },
        {
          $unwind: {
            path: '$doctor',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$patient',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'doctor.userId',
            foreignField: '_id',
            as: 'doctorUser'
          }
        },
        {
          $lookup: {
            from: 'users',
            localField: 'patient.userId',
            foreignField: '_id',
            as: 'patientUser'
          }
        },
        {
          $unwind: {
            path: '$doctorUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $unwind: {
            path: '$patientUser',
            preserveNullAndEmptyArrays: true
          }
        },
        {
          $match: {
            $or: [
              { 'doctorUser.clinicId': mongoose.Types.ObjectId(clinicId) },
              { 'patientUser.clinicId': mongoose.Types.ObjectId(clinicId) }
            ]
          }
        },
        {
          $sort: { startTime: 1 }
        },
        {
          $project: {
            _id: 1,
            patientId: 1,
            doctorId: 1,
            date: 1,
            startTime: 1,
            endTime: 1,
            type: 1,
            status: 1,
            reasonForVisit: 1,
            isVirtual: 1,
            'doctor._id': 1,
            'patient._id': 1,
            'doctorUser.firstName': 1,
            'doctorUser.lastName': 1,
            'patientUser.firstName': 1,
            'patientUser.lastName': 1
          }
        }
      ]);
      
      return appointments;
    } catch (error) {
      console.error('Get clinic today appointments error:', error);
      throw new Error('Failed to retrieve today\'s appointments');
    }
  }
  
  /**
   * Validate if a status transition is allowed
   * @param {string} currentStatus - Current appointment status
   * @param {string} newStatus - New appointment status
   * @returns {boolean} Is transition valid
   * @private
   */
  _isValidStatusTransition(currentStatus, newStatus) {
    const validTransitions = {
      'scheduled': ['checked-in', 'cancelled', 'no-show'],
      'checked-in': ['in-progress', 'cancelled'],
      'in-progress': ['completed', 'cancelled'],
      'completed': [],
      'cancelled': [],
      'no-show': []
    };
    
    return validTransitions[currentStatus] && validTransitions[currentStatus].includes(newStatus);
  }
  
  /**
   * Generate a unique video conference link
   * @returns {string} Video conference link
   * @private
   */
  _generateVideoLink() {
    const baseUrl = config.frontendUrl || 'http://localhost:3000';
    const uniqueId = Date.now().toString(36) + Math.random().toString(36).substr(2, 5);
    return `${baseUrl}/consultation/${uniqueId}`;
  }
  
  /**
   * Send notifications for appointment events
   * @param {Object} appointment - Appointment object
   * @param {Object} patient - Patient object
   * @param {Object} doctor - Doctor object
   * @param {string} eventType - Event type (created, cancelled, etc.)
   * @param {Object} session - Mongoose session
   * @private
   */
  async _sendAppointmentNotifications(appointment, patient, doctor, eventType, session) {
    try {
      // Get user data for notifications
      const patientUser = await User.findById(patient.userId);
      const doctorUser = await User.findById(doctor.userId);
      
      if (!patientUser || !doctorUser) {
        console.error('Failed to find users for appointment notifications');
        return;
      }
      
      // Determine notification content based on event type
      let title, patientMessage, doctorMessage;
      
      switch(eventType) {
        case 'created':
          title = 'New Appointment Scheduled';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been scheduled.`;
          doctorMessage = `New appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        case 'cancelled':
          title = 'Appointment Cancelled';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been cancelled.`;
          doctorMessage = `Appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been cancelled.`;
          break;
        case 'checked-in':
          title = 'Patient Checked In';
          patientMessage = `You have checked in for your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          doctorMessage = `${patientUser.firstName} ${patientUser.lastName} has checked in for the appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        case 'in-progress':
          title = 'Appointment In Progress';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} is now in progress.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} is now in progress.`;
          break;
        case 'completed':
          title = 'Appointment Completed';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been completed.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} has been completed.`;
          break;
        case 'no-show':
          title = 'Missed Appointment';
          patientMessage = `You missed your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          doctorMessage = `${patientUser.firstName} ${patientUser.lastName} did not show up for the appointment on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`;
          break;
        default:
          title = 'Appointment Update';
          patientMessage = `Your appointment with Dr. ${doctorUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been updated.`;
          doctorMessage = `Your appointment with ${patientUser.firstName} ${patientUser.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime} has been updated.`;
      }
      
      // Create in-app notification for patient
      await Notification.create([{
        userId: patient.userId,
        type: 'appointment',
        title,
        message: patientMessage,
        relatedTo: {
          model: 'Appointment',
          id: appointment._id
        },
        isRead: false,
        deliveryChannels: ['in-app'],
        deliveryStatus: [{
          channel: 'in-app',
          status: 'sent',
          sentAt: new Date()
        }]
      }], { session });
      
      // Create in-app notification for doctor
      await Notification.create([{
        userId: doctor.userId,
        type: 'appointment',
        title,
        message: doctorMessage,
        relatedTo: {
          model: 'Appointment',
          id: appointment._id
        },
        isRead: false,
        deliveryChannels: ['in-app'],
        deliveryStatus: [{
          channel: 'in-app',
          status: 'sent',
          sentAt: new Date()
        }]
      }], { session });
      
      // Send email notifications (outside of transaction to prevent rollback on email failure)
      if (eventType === 'created' || eventType === 'cancelled') {
        try {
          // Send appointment confirmation or cancellation email
          await emailService.sendAppointmentConfirmation({
            appointment,
            patient: {
              firstName: patientUser.firstName,
              lastName: patientUser.lastName,
              email: patientUser.email
            },
            doctor: {
              firstName: doctorUser.firstName,
              lastName: doctorUser.lastName
            },
            status: eventType
          });
        } catch (emailError) {
          console.error('Failed to send appointment notification email:', emailError);
          // Continue without failing the transaction
        }
      }
    } catch (error) {
      console.error('Send appointment notifications error:', error);
      // Don't throw here to prevent transaction rollback
    }
  }
  
  /**
   * Schedule appointment reminders
   * @returns {number} Number of reminders sent
   */
  async scheduleAppointmentReminders() {
    try {
      // Get appointments coming up in the next 24 hours that haven't had reminders sent
      const nextDay = new Date();
      nextDay.setHours(nextDay.getHours() + 24);
      
      const today = new Date();
      
      const upcomingAppointments = await Appointment.find({
        date: { $gte: today, $lte: nextDay },
        status: 'scheduled',
        'remindersSent.0': { $exists: false } // No reminders sent yet
      })
      .populate({
        path: 'patientId',
        populate: {
          path: 'userId'
        }
      })
      .populate({
        path: 'doctorId',
        populate: {
          path: 'userId'
        }
      });
      
      let remindersSent = 0;
      
      for (const appointment of upcomingAppointments) {
        try {
          const patientUser = appointment.patientId.userId;
          
          // Create in-app notification
          await Notification.create({
            userId: patientUser._id,
            type: 'reminder',
            title: 'Upcoming Appointment Reminder',
            message: `You have an appointment with Dr. ${appointment.doctorId.userId.lastName} on ${new Date(appointment.date).toLocaleDateString()} at ${appointment.startTime}.`,
            relatedTo: {
              model: 'Appointment',
              id: appointment._id
            },
            isRead: false,
            deliveryChannels: ['in-app', 'email'],
            deliveryStatus: [{
              channel: 'in-app',
              status: 'sent',
              sentAt: new Date()
            }]
          });
          
          // Send email reminder
          try {
            await emailService.sendAppointmentReminder(
              appointment, 
              {
                firstName: patientUser.firstName,
                lastName: patientUser.lastName,
                email: patientUser.email
              },
              {
                firstName: appointment.doctorId.userId.firstName,
                lastName: appointment.doctorId.userId.lastName
              }
            );
          } catch (emailError) {
            console.error('Failed to send reminder email:', emailError);
          }
          
          // Update appointment with reminder record
          await Appointment.findByIdAndUpdate(appointment._id, {
            $push: {
              remindersSent: {
                type: 'email',
                sentAt: new Date(),
                status: 'sent'
              }
            }
          });
          
          remindersSent++;
        } catch (reminderError) {
          console.error(`Failed to send reminder for appointment ${appointment._id}:`, reminderError);
        }
      }
      
      return remindersSent;
    } catch (error) {
      console.error('Schedule appointment reminders error:', error);
      throw new Error('Failed to schedule appointment reminders');
    }
  }
  
  /**
   * Handle no-show appointments
   * @returns {number} Number of appointments updated
   */
  async handleNoShowAppointments() {
    try {
      // Get appointments that were scheduled for earlier today but not checked in
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      
      // Appointments that were scheduled to start at least 30 minutes ago
      const thirtyMinutesAgo = new Date(now);
      thirtyMinutesAgo.setMinutes(now.getMinutes() - 30);
      
      // Convert time to HH:MM for comparison
      const currentTime = now.getHours().toString().padStart(2, '0') + ':' + 
                         now.getMinutes().toString().padStart(2, '0');
      
      // Find scheduled appointments that should have started already
      const overdueAppointments = await Appointment.find({
        date: { $gte: startOfDay, $lte: now },
        startTime: { $lte: currentTime },
        status: 'scheduled'
      });
      
      let noShowCount = 0;
      
      for (const appointment of overdueAppointments) {
        try {
          // If appointment start time was more than 30 minutes ago, mark as no-show
          const appointmentHour = parseInt(appointment.startTime.split(':')[0]);
          const appointmentMinute = parseInt(appointment.startTime.split(':')[1]);
          const appointmentDate = new Date(appointment.date);
          appointmentDate.setHours(appointmentHour, appointmentMinute);
          
          if (appointmentDate < thirtyMinutesAgo) {
            await this.updateAppointment(appointment._id, { 
              status: 'no-show' 
            }, 'system');
            
            noShowCount++;
          }
        } catch (updateError) {
          console.error(`Failed to update no-show appointment ${appointment._id}:`, updateError);
        }
      }
      
      return noShowCount;
    } catch (error) {
      console.error('Handle no-show appointments error:', error);
      throw new Error('Failed to handle no-show appointments');
    }
  }
}

export default new AppointmentService();