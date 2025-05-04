// src/controllers/appointmentController.mjs

import { validationResult } from 'express-validator';
import { check } from 'express-validator';
import { withServices, withServicesForController } from '../utils/controllerHelper.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';
import mongoose from 'mongoose';
import googleCalendarService from '../services/googleCalendarService.mjs';

/**
 * @desc    Get all appointments with filtering and pagination
 * @route   GET /api/appointments
 * @access  Private (Admin, Doctor, Staff)
 */
const getAppointments = async (req, res, next, { appointmentService }) => {
  // Extract query parameters for filtering and pagination
  const {
    page,
    limit,
    search,
    sort,
    order,
    status,
    type,
    doctorId,
    patientId,
    startDate,
    endDate
  } = req.query;
  
  // Determine if we should filter by clinic based on user role
  let clinicId = req.query.clinicId;
  if (req.userRole !== 'admin' && req.clinicId) {
    clinicId = req.clinicId;
  }
  
  // Check if user has permission to view all appointments
  if (!['admin', 'doctor', 'staff'].includes(req.userRole)) {
    // If patient, they can only see their own appointments
    if (req.userRole === 'patient') {
      const patientRecord = await getPatientForUser(req.user._id);
      if (!patientRecord) {
        return next(new AppError('Patient record not found', 404));
      }
      return res.redirect(`/api/appointments/patient/${patientRecord._id}`);
    }
    
    return next(new AppError('You are not authorized to view these appointments', 403));
  }

  const result = await appointmentService.getAllAppointments({
    page,
    limit,
    search,
    sort,
    order,
    status,
    type,
    doctorId,
    patientId,
    startDate,
    endDate,
    clinicId
  });
  
  // The service now formats the appointments, no need to map here
  // const formattedAppointments = result.appointments.map(appointment => 
  //   formatAppointmentForResponse(appointment)
  // );
  
  res.status(200).json({
    success: true,
    count: result.appointments.length, // Use length directly from service result
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.appointments // Use appointments directly from service result
  });
};

/**
 * Helper function to format date fields in appointment objects
 * @param {Object} appointment - Appointment object
 * @returns {Object} Appointment with formatted date
 */
const formatAppointmentDate = (appointment) => {
  if (!appointment) return appointment;
  
  // Create a copy of the appointment to avoid mutations
  const formattedAppointment = { ...appointment };
  
  // Format appointment date
  if (formattedAppointment.date) {
    // If date is an object (MongoDB date), format it as YYYY-MM-DD string
    if (typeof formattedAppointment.date === 'object') {
      // Check if it's a Date object
      if (formattedAppointment.date instanceof Date || 
          (formattedAppointment.date.constructor && formattedAppointment.date.constructor.name === 'Date')) {
        const date = new Date(formattedAppointment.date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          formattedAppointment.date = `${year}-${month}-${day}`;
        } else {
          formattedAppointment.date = ''; // Invalid date
        }
      }
      // If it's an empty object, set to empty string
      else if (Object.keys(formattedAppointment.date).length === 0) {
        formattedAppointment.date = '';
      }
    }
  }
  
  return formattedAppointment;
};

/**
 * @desc    Get single appointment
 * @route   GET /api/appointments/:id
 * @access  Private (Admin, Doctor, Staff, or Involved Patient)
 */
const getAppointment = async (req, res, next, { appointmentService }) => {
  let appointmentId = req.params.id;
  
  // Handle special cases where the ID might be '[object Object]' or similar
  if (appointmentId === '[object Object]' || appointmentId === '[object%20Object]') {
    return next(new AppError('Invalid appointment ID format: Object received instead of string ID', 400));
  }
  
  // Validate that the ID is a valid MongoDB ObjectId
  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return next(new AppError(`Invalid appointment ID format: ${appointmentId}`, 400));
  }
  
  const appointment = await appointmentService.getAppointmentById(appointmentId);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }
  
  // Check if user has permission to view this appointment
  const hasPermission = await checkAppointmentPermission(
    appointment, 
    req.user._id, 
    req.userRole
  );
  
  if (!hasPermission) {
    return next(new AppError('You are not authorized to view this appointment', 403));
  }
  
  // Format dates and ensure ObjectID fields are properly serialized
  const formattedAppointment = formatAppointmentForResponse(appointment);
  
  // Log the final object being sent in the response
  console.log('--- Final Appointment Data Sent to Frontend ---');
  console.log(JSON.stringify(formattedAppointment, null, 2));
  console.log('--- End Final Appointment Data ---');
  
  res.status(200).json({
    success: true,
    data: formattedAppointment
  });
};

/**
 * Helper function to format appointment object for API response
 * Ensures proper date formatting and ObjectID serialization
 * @param {Object} appointment - Appointment object
 * @returns {Object} Formatted appointment ready for API response
 */
const formatAppointmentForResponse = (appointment) => {
  if (!appointment) return null;
  
  // Create a proper serializable object
  let formattedAppointment;
  
  try {
    // First convert to plain object if it's a Mongoose document
    if (appointment.toObject && typeof appointment.toObject === 'function') {
      formattedAppointment = appointment.toObject();
    } else {
      // If it's already a plain object, create a fresh copy
      formattedAppointment = JSON.parse(JSON.stringify(appointment));
    }
    
    // Ensure _id is properly serialized as string
    if (formattedAppointment._id) {
      if (typeof formattedAppointment._id === 'object' && formattedAppointment._id !== null) {
        formattedAppointment._id = formattedAppointment._id.toString();
      }
    }
    
    // Ensure other ObjectID fields are serialized
    const objectIdFields = ['patientId', 'doctorId', 'timeSlotId', 'preliminaryAssessmentId'];
    objectIdFields.forEach(field => {
      if (formattedAppointment[field]) {
        if (typeof formattedAppointment[field] === 'object' && formattedAppointment[field] !== null) {
          formattedAppointment[field] = formattedAppointment[field].toString();
        }
      }
    });
    
    // Format date field
    if (formattedAppointment.date) {
      // If date is an object (MongoDB date), format it as YYYY-MM-DD string
      if (typeof formattedAppointment.date === 'object') {
        // Check if it's a Date object
        if (formattedAppointment.date instanceof Date || 
            (formattedAppointment.date.constructor && formattedAppointment.date.constructor.name === 'Date')) {
          const date = new Date(formattedAppointment.date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            formattedAppointment.date = `${year}-${month}-${day}`;
          } else {
            formattedAppointment.date = ''; // Invalid date
          }
        }
        // If it's an empty object, set to empty string
        else if (Object.keys(formattedAppointment.date).length === 0) {
          formattedAppointment.date = '';
        }
      }
    }
    
    // Ensure nested objects also have their IDs serialized
    if (formattedAppointment.patient && formattedAppointment.patient._id) {
      formattedAppointment.patient._id = formattedAppointment.patient._id.toString();
    }
    
    if (formattedAppointment.doctor && formattedAppointment.doctor._id) {
      formattedAppointment.doctor._id = formattedAppointment.doctor._id.toString();
    }
    
    if (formattedAppointment.patientUser && formattedAppointment.patientUser._id) {
      formattedAppointment.patientUser._id = formattedAppointment.patientUser._id.toString();
    }
    
    if (formattedAppointment.doctorUser && formattedAppointment.doctorUser._id) {
      formattedAppointment.doctorUser._id = formattedAppointment.doctorUser._id.toString();
    }
    
    return formattedAppointment;
  } catch (error) {
    console.error('Error formatting appointment response:', error);
    // Return original appointment as fallback
    return appointment;
  }
};

/**
 * @desc    Create new appointment
 * @route   POST /api/appointments
 * @access  Private (Admin, Staff, or Patient)
 */
const createAppointment = async (req, res, next, { appointmentService, patientService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  let appointmentData = { ...req.body }; // Clone request body

  // If the user is a patient creating their own appointment,
  // make sure patientId matches their own record
  if (req.userRole === 'patient') {
    const patientRecord = await patientService.getByUserId(req.user._id);
    if (!patientRecord) {
      return next(new AppError('Patient record not found', 404));
    }
    // Override patientId in request body
    appointmentData.patientId = patientRecord._id;
  }

  try {
    const { Types } = mongoose;
    const { Doctor } = await import('../models/index.mjs');

    // --- Doctor ID Handling ---
    const doctorIdentifier = appointmentData.doctorId;
    let actualDoctorId = null;

    if (!doctorIdentifier) {
      return next(new AppError('Doctor ID is required', 400));
    }

    if (Types.ObjectId.isValid(doctorIdentifier)) {
      actualDoctorId = doctorIdentifier;
      // Verify doctor exists
      const doctorExists = await Doctor.findById(actualDoctorId);
      if (!doctorExists) {
        return next(new AppError('Doctor not found with the provided ID', 404));
      }
    } else {
      // If not a valid ObjectId, assume it's a license number
      console.log(`Appointment Creation: Identifier ${doctorIdentifier} is not ObjectId, trying as licenseNumber`);
      const doctor = await Doctor.findOne({ licenseNumber: doctorIdentifier });
      if (!doctor) {
        return next(new AppError('Doctor not found with the provided license number', 404));
      }
      actualDoctorId = doctor._id;
      console.log(`Appointment Creation: Found doctor with ID ${actualDoctorId} using licenseNumber`);
    }
    // Update the appointmentData with the actual ObjectId
    appointmentData.doctorId = actualDoctorId;
    // --- End Doctor ID Handling ---

    // Ensure timeSlotId is a valid ObjectId
    if (!appointmentData.timeSlotId || !Types.ObjectId.isValid(appointmentData.timeSlotId)) {
      return next(new AppError('Invalid or missing time slot ID format', 400));
    }
    // Convert timeSlotId to ObjectId type
    appointmentData.timeSlotId = new Types.ObjectId(appointmentData.timeSlotId);

    // Ensure patientId is a valid ObjectId (it should be after the override above)
    if (!appointmentData.patientId || !Types.ObjectId.isValid(appointmentData.patientId)) {
        // If patientId is still invalid here, something went wrong with patient lookup
        return next(new AppError('Invalid or missing patient ID format', 400));
    }
    // Convert patientId to ObjectId type
    appointmentData.patientId = new Types.ObjectId(appointmentData.patientId);

    // Create the appointment using the modified data
    const appointment = await appointmentService.createAppointment(
      appointmentData,
      req.user._id
    );
    
    res.status(201).json({
      success: true,
      data: appointment
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return next(new AppError(`Invalid ${error.path}: ${error.value}`, 400));
    }
    console.error('Appointment Creation Error:', error);
    return next(error);
  }
};

/**
 * @desc    Update appointment
 * @route   PUT /api/appointments/:id
 * @access  Private (Admin, Staff, Doctor involved, or Patient involved)
 */
const updateAppointment = async (req, res, next, { appointmentService, patientService }) => {
  // Check for validation errors
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json(formatValidationErrors(errors.array()));
  }
  
  const appointmentId = req.params.id;
  
  // Get the appointment to check permissions
  const appointment = await appointmentService.getAppointmentById(appointmentId);
  
  if (!appointment) {
    return next(new AppError('Appointment not found', 404));
  }
  
  // Check if user has permission to update this appointment
  const hasPermission = await checkAppointmentPermission(
    appointment, 
    req.user._id, 
    req.userRole
  );
  
  if (!hasPermission) {
    return next(new AppError('You are not authorized to update this appointment', 403));
  }
  
  // Restrict what patients can update
  if (req.userRole === 'patient') {
    // Patients can only cancel or check-in to their appointments
    const allowedUpdates = ['status'];
    const allowedStatus = ['cancelled', 'checked-in'];
    
    if (req.body.status && !allowedStatus.includes(req.body.status)) {
      return next(new AppError(`Patients can only ${allowedStatus.join(' or ')} appointments`, 403));
    }
    
    // Filter update data
    const filteredUpdate = {};
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined) {
        filteredUpdate[field] = req.body[field];
      }
    });
    
    req.body = filteredUpdate;
  }
  
  // Update the appointment
  const updatedAppointment = await appointmentService.updateAppointment(
    appointmentId,
    req.body,
    req.user._id
  );
  
  res.status(200).json({
    success: true,
    data: updatedAppointment
  });
};

/**
 * @desc    Delete appointment
 * @route   DELETE /api/appointments/:id
 * @access  Private (Admin only)
 */
const deleteAppointment = async (req, res, next, { appointmentService }) => {
  // Only admins can delete appointments
  if (req.userRole !== 'admin') {
    return next(new AppError('Only administrators can delete appointments', 403));
  }
  
  const appointmentId = req.params.id;
  
  const deleted = await appointmentService.deleteAppointment(
    appointmentId,
    req.user._id
  );
  
  if (!deleted) {
    return next(new AppError('Appointment not found', 404));
  }
  
  res.status(200).json({
    success: true,
    message: 'Appointment deleted successfully'
  });
};

/**
 * @desc    Get patient's appointments
 * @route   GET /api/appointments/patient/:patientId
 * @access  Private (Admin, Doctor, Staff, or Patient themselves)
 */
const getPatientAppointments = async (req, res, next, { appointmentService, patientService }) => {
  const patientId = req.params.patientId;
  
  // If patient is accessing, verify it's their own record
  if (req.userRole === 'patient') {
    const patientRecord = await patientService.getByUserId(req.user._id);
    
    if (!patientRecord || patientRecord._id.toString() !== patientId) {
      return next(new AppError('You can only view your own appointments', 403));
    }
  }
  
  // Extract query parameters
  const {
    page = 1,
    limit = 10,
    sort = 'date',
    order = 'desc',
    status,
    startDate,
    endDate
  } = req.query;
  
  const result = await appointmentService.getAllAppointments({
    page,
    limit,
    sort,
    order,
    status,
    patientId,
    startDate,
    endDate
  });
  
  // Service handles formatting
  // const formattedAppointments = result.appointments.map(appointment => 
  //   formatAppointmentForResponse(appointment)
  // );
  
  res.status(200).json({
    success: true,
    count: result.appointments.length,
    total: result.total,
    totalPages: result.totalPages,
    currentPage: result.currentPage,
    data: result.appointments
  });
};

/**
 * @desc    Get doctor's appointments
 * @route   GET /api/appointments/doctor/:doctorId
 * @access  Private (Admin, Staff, or Doctor themselves)
 */
const getDoctorAppointments = async (req, res, next, { appointmentService, doctorService }) => {
  try {
    console.log('GET doctor appointments request:', {
      doctorId: req.params.doctorId,
      userId: req.user?._id,
      role: req.userRole
    });
    
    const doctorId = req.params.doctorId;
    
    // Validate doctorId format
    if (!mongoose.Types.ObjectId.isValid(doctorId)) {
      console.log('Invalid doctorId format:', doctorId);
      return res.status(400).json({
        success: false,
        message: 'Invalid doctor ID format'
      });
    }
    
    // If doctor is accessing, verify it's their own record
    if (req.userRole === 'doctor') {
      const doctorRecord = await doctorService.getByUserId(req.user._id);
      
      if (!doctorRecord) {
        console.log('Doctor record not found for user:', req.user._id);
        return res.status(404).json({
          success: false,
          message: 'Doctor record not found for this user'
        });
      }
      
      if (doctorRecord._id.toString() !== doctorId) {
        console.log('Permission denied: Doctor trying to access another doctor\'s appointments');
        return res.status(403).json({
          success: false,
          message: 'You can only view your own appointments'
        });
      }
    }
    
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      sort = 'date',
      order = 'desc',
      status,
      startDate,
      endDate
    } = req.query;
    
    console.log('Fetching appointments for doctor:', doctorId);
    
    const result = await appointmentService.getAllAppointments({
      page,
      limit,
      sort,
      order,
      status,
      doctorId,
      startDate,
      endDate
    });
    
    console.log(`Found ${result.appointments?.length || 0} appointments for doctor ${doctorId}`);
    
    // Service handles formatting
    // const formattedAppointments = (result.appointments || []).map(appointment => 
    //   formatAppointmentForResponse(appointment)
    // );
    
    res.status(200).json({
      success: true,
      count: result.appointments?.length || 0, // Use length directly
      total: result.total || 0,
      totalPages: result.totalPages || 1,
      currentPage: result.currentPage || 1,
      data: result.appointments || [] // Use data directly
    });
  } catch (err) {
    console.error('Error fetching doctor appointments:', err);
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve appointments',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * @desc    Get upcoming appointments for the current user
 * @route   GET /api/appointments/upcoming
 * @access  Private
 */
const getUpcomingAppointments = async (req, res, next, { appointmentService, patientService, doctorService }) => {
  try {
    console.log('GET upcoming appointments request:', {
      userId: req.user._id,
      role: req.userRole
    });
    
    let appointments = [];
    
    // Find the appointments based on user role
    if (req.userRole === 'patient') {
      const patientRecord = await patientService.getByUserId(req.user._id);
      if (!patientRecord) {
        return res.status(404).json({
          success: false,
          message: 'Patient record not found'
        });
      }
      
      const result = await appointmentService.getAllAppointments({
        patientId: patientRecord._id.toString(),
        status: 'scheduled', // Filter for upcoming
        sort: 'date',
        order: 'asc',
        limit: 10 // Limit results if desired
      });
      
      appointments = result.appointments || [];
    } 
    else if (req.userRole === 'doctor') {
      const doctorRecord = await doctorService.getByUserId(req.user._id);
      if (!doctorRecord) {
        return res.status(404).json({
          success: false,
          message: 'Doctor record not found'
        });
      }
      
      const result = await appointmentService.getAllAppointments({
        doctorId: doctorRecord._id.toString(),
        status: 'scheduled', // Filter for upcoming
        sort: 'date',
        order: 'asc',
        limit: 10 // Limit results if desired
      });
      
      appointments = result.appointments || [];
    }
    
    // The service already handles formatting, including populated user data
    // const formattedAppointments = appointments.map(appointment => 
    //   formatAppointmentForResponse(appointment)
    // );
    
    return res.status(200).json({
      success: true,
      count: appointments.length, // Use length from service result
      data: appointments // Use data directly from service result
    });
  } catch (err) {
    console.error('Error fetching upcoming appointments:', err);
    return res.status(500).json({
      success: false,
      message: 'Failed to retrieve upcoming appointments',
      error: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
};

/**
 * Helper function to get patient record for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Patient record or null
 */
const getPatientForUser = async (userId) => {
  try {
    // Assuming you have a Patient model with a userId field
    const { Patient } = await import('../models/index.mjs');
    return await Patient.findOne({ userId });
  } catch (error) {
    console.error('Error getting patient record:', error);
    return null;
  }
};

/**
 * Helper function to get doctor record for a user
 * @param {string} userId - User ID
 * @returns {Object|null} Doctor record or null
 */
const getDoctorForUser = async (userId) => {
  try {
    // Assuming you have a Doctor model with a userId field
    const { Doctor } = await import('../models/index.mjs');
    return await Doctor.findOne({ userId });
  } catch (error) {
    console.error('Error getting doctor record:', error);
    return null;
  }
};

/**
 * Helper function to check if a user has permission to access an appointment
 * @param {Object} appointment - Appointment object (potentially with ObjectIds)
 * @param {string} userId - User ID of the person requesting access
 * @param {string} userRole - User role of the person requesting access
 * @returns {boolean} Has permission
 */
const checkAppointmentPermission = async (appointment, userId, userRole) => {
  try {
    console.log('--- checkAppointmentPermission Start ---');
    console.log('Requested by userId:', userId, 'Role:', userRole);
    console.log('Appointment Data (raw):', JSON.stringify(appointment, null, 2));
    
    // Admins and staff have access to all appointments
    if (userRole === 'admin' || userRole === 'staff') {
      console.log('Permission granted: User is admin or staff.');
      return true;
    }
    
    // Ensure appointment IDs are strings for comparison
    const appointmentDoctorIdStr = appointment.doctorId?.toString();
    const appointmentPatientIdStr = appointment.patientId?.toString();
    console.log('Comparing against Appt Doctor ID:', appointmentDoctorIdStr);
    console.log('Comparing against Appt Patient ID:', appointmentPatientIdStr);
    
    // For doctors, check if they are the assigned doctor
    if (userRole === 'doctor') {
      const doctorRecord = await getDoctorForUser(userId);
      console.log('Doctor Record Found:', JSON.stringify(doctorRecord, null, 2));
      const hasAccess = doctorRecord && doctorRecord._id.toString() === appointmentDoctorIdStr;
      console.log('Doctor Permission Check Result:', hasAccess);
      console.log('--- checkAppointmentPermission End ---');
      return hasAccess;
    }
    
    // For patients, check if they are the patient for this appointment
    if (userRole === 'patient') {
      const patientRecord = await getPatientForUser(userId);
      console.log('Patient Record Found:', JSON.stringify(patientRecord, null, 2));
      const hasAccess = patientRecord && patientRecord._id.toString() === appointmentPatientIdStr;
      console.log('Patient Permission Check Result:', hasAccess);
      console.log('--- checkAppointmentPermission End ---');
      return hasAccess;
    }
    
    console.log('Permission denied: Role not recognized or no match found.');
    console.log('--- checkAppointmentPermission End ---');
    return false;
  } catch (error) {
    console.error('Error checking appointment permission:', error);
    console.log('--- checkAppointmentPermission End (Error) ---');
    return false;
  }
};

/**
 * @desc    Get timeslot for an appointment
 * @route   GET /api/appointments/timeslot/:id
 * @access  Private
 */
export const getAppointmentTimeslot = asyncHandler(async (req, res, next) => {
  const timeslotId = req.params.id;
  
  if (!timeslotId || !mongoose.Types.ObjectId.isValid(timeslotId)) {
    return next(new AppError('Invalid timeslot ID format', 400));
  }
  
  try {
    // Import the availability service directly
    const availabilityService = (await import('../services/availabilityService.mjs')).default;
    
    // Use the service to get the timeslot with formatted date
    const timeslot = await availabilityService.getTimeSlotWithFormattedDate(timeslotId);
    
    if (!timeslot) {
      return next(new AppError('Timeslot not found', 404));
    }
    
    console.log('getAppointmentTimeslot: Retrieved timeslot:', JSON.stringify(timeslot));
    
    // Ensure date is properly formatted even if the service method didn't do it
    if (timeslot.date && typeof timeslot.date === 'object') {
      console.log('getAppointmentTimeslot: Date is still an object, formatting manually');
      
      // If it's a Date object
      if (timeslot.date instanceof Date || 
          (timeslot.date.constructor && timeslot.date.constructor.name === 'Date')) {
        const date = new Date(timeslot.date);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          timeslot.date = `${year}-${month}-${day}`;
        } else {
          timeslot.date = ''; // Invalid date
        }
      }
      // If it's an empty object, set to empty string
      else if (Object.keys(timeslot.date).length === 0) {
        timeslot.date = '';
      }
    }
    
    console.log('getAppointmentTimeslot: Sending response with formatted date:', 
      timeslot.date, 'type:', typeof timeslot.date);
    
    res.status(200).json({
      success: true,
      data: timeslot
    });
  } catch (error) {
    console.error('Get appointment timeslot error:', error);
    return next(new AppError(`Failed to retrieve timeslot: ${error.message}`, 500));
  }
});

/**
 * @desc    Get appointments for the currently logged-in user (patient or doctor)
 * @route   GET /api/appointments/me
 * @access  Private (Patient, Doctor)
 */
const getMyAppointments = async (req, res, next, { patientService, doctorService, appointmentService }) => {
  try {
    console.log('GET my appointments request:', {
      userId: req.user._id,
      role: req.userRole
    });
    
    let participantId = null;
    
    // Determine the participant ID based on role
    if (req.userRole === 'patient') {
      const patientRecord = await patientService.getByUserId(req.user._id);
      if (!patientRecord) {
        return res.status(404).json({
          success: false,
          message: 'Patient profile not found for this user'
        });
      }
      participantId = patientRecord._id.toString();
    } else if (req.userRole === 'doctor') {
      const doctorRecord = await doctorService.getByUserId(req.user._id);
      if (!doctorRecord) {
        return res.status(404).json({
          success: false,
          message: 'Doctor profile not found for this user'
        });
      }
      participantId = doctorRecord._id.toString();
    }
    
    if (!participantId) {
      return res.status(400).json({
        success: false,
        message: 'Could not determine participant ID for user role'
      });
    }
    
    // Use the existing service method to fetch and format appointments
    const options = {
      [req.userRole === 'patient' ? 'patientId' : 'doctorId']: participantId,
      page: req.query.page || 1,
      limit: req.query.limit || 100, // Fetch more by default for 'my' list?
      sort: req.query.sort || 'date',
      order: req.query.order || 'desc'
    };
    
    console.log(`Using appointmentService.getAllAppointments with options:`, options);
    const result = await appointmentService.getAllAppointments(options);
    
    // The service already formats the data, including ObjectIDs
    res.status(200).json({
      success: true,
      count: result.appointments.length,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      data: result.appointments
    });
  } catch (err) {
    console.error('Error fetching my appointments:', err);
    // Use next(err) for centralized error handling
    next(new AppError('Error fetching appointments', 500, err)); 
  }
};

// Define the dependencies for each controller method
const dependencies = {
  getAppointments: ['appointmentService'],
  getAppointment: ['appointmentService'],
  createAppointment: ['appointmentService', 'patientService'],
  updateAppointment: ['appointmentService', 'patientService'],
  deleteAppointment: ['appointmentService'],
  getPatientAppointments: ['appointmentService', 'patientService'],
  getDoctorAppointments: ['appointmentService', 'doctorService'],
  getUpcomingAppointments: ['appointmentService', 'patientService', 'doctorService'],
  getMyAppointments: ['patientService', 'doctorService', 'appointmentService']
  // generateMeetingLink doesn't need DI as it uses dynamic imports
};

// Create the controller object with all methods
const appointmentController = {
  getAppointments,
  getAppointment,
  createAppointment,
  updateAppointment,
  deleteAppointment,
  getPatientAppointments,
  getDoctorAppointments,
  getUpcomingAppointments,
  getMyAppointments,
  // generateMeetingLink,
  // generateMeetLink
};

// Apply DI to the controller
const enhancedController = withServicesForController(appointmentController, dependencies);

// Validation middleware
const createAppointmentValidation = [
  check('patientId', 'Patient ID is required').not().isEmpty(),
  check('doctorId', 'Doctor ID is required').not().isEmpty(),
  check('timeSlotId', 'Time slot ID is required').not().isEmpty(),
  check('reasonForVisit', 'Reason for visit is required').not().isEmpty(),
  check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
    .optional()
    .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
  check('isVirtual', 'isVirtual must be a boolean').optional().isBoolean()
];

const updateAppointmentValidation = [
  check('status', 'Status must be one of: scheduled, checked-in, in-progress, completed, cancelled, no-show')
    .optional()
    .isIn(['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show']),
  check('type', 'Type must be one of: initial, follow-up, virtual, in-person')
    .optional()
    .isIn(['initial', 'follow-up', 'virtual', 'in-person']),
  check('notes', 'Notes must be a string').optional().isString(),
  check('reasonForVisit', 'Reason for visit must be a string').optional().isString(),
  check('isVirtual', 'isVirtual must be a boolean').optional().isBoolean(),
  check('timeSlotId', 'Time slot ID must be a valid ID').optional().isMongoId(),
  check('cancelReason', 'Cancel reason is required when status is cancelled')
    .if(check('status').equals('cancelled'))
    .not()
    .isEmpty()
];

// Export the enhanced controller methods
export const {
  getAppointments: getAppointmentsWithDI,
  getAppointment: getAppointmentWithDI,
  createAppointment: createAppointmentWithDI,
  updateAppointment: updateAppointmentWithDI,
  deleteAppointment: deleteAppointmentWithDI,
  getPatientAppointments: getPatientAppointmentsWithDI,
  getDoctorAppointments: getDoctorAppointmentsWithDI,
  getUpcomingAppointments: getUpcomingAppointmentsWithDI,
  getMyAppointments: getMyAppointmentsWithDI
} = enhancedController;

// Export the validation middleware
export {
  createAppointmentValidation,
  updateAppointmentValidation,
  // generateMeetLink
};

// Default export for compatibility
export default {
  getAppointments: getAppointmentsWithDI,
  getAppointment: getAppointmentWithDI,
  createAppointment: createAppointmentWithDI,
  updateAppointment: updateAppointmentWithDI,
  deleteAppointment: deleteAppointmentWithDI,
  getPatientAppointments: getPatientAppointmentsWithDI,
  getDoctorAppointments: getDoctorAppointmentsWithDI,
  getUpcomingAppointments: getUpcomingAppointmentsWithDI,
  getMyAppointments: getMyAppointmentsWithDI,
  getAppointmentTimeslot,
  createAppointmentValidation,
  updateAppointmentValidation,
  // generateMeetLink
};