import mongoose from 'mongoose';
import BaseService from './base/baseService.mjs';
// Remove direct import of Prescription model
// import Prescription from '../models/prescriptionModel.mjs';
// Import all models from index.mjs
const { Patient, Prescription, Doctor, User } = await import('../models/index.mjs');

// Remove redundant imports since they're now included above
// const Doctor = mongoose.model('Doctor');
// const User = mongoose.model('User');

// Import AppError if needed for specific service errors
import { AppError } from '../utils/errorHandler.mjs';

/**
 * Prescription Management Service
 */
class PrescriptionService {
  /**
   * Create a new prescription
   * @param {Object} prescriptionData - Data for the new prescription
   * @param {Object} user - The user creating the prescription (for createdBy)
   * @returns {Object} The created prescription
   */
  async createPrescription(prescriptionData, user) {
    console.log("Prescription Data received in service:", prescriptionData);
    console.log("User creating prescription:", user._id);
    
    // Find the Doctor record corresponding to the logged-in user
    const doctor = await Doctor.findOne({ userId: user._id }).lean(); // Use lean for performance if only needing _id
    if (!doctor) {
        // Make sure role check already happened in route/controller
        throw new AppError('Doctor profile not found for the logged-in user. Cannot create prescription.', 404);
    }
    const doctorId = doctor._id; // Get the actual Doctor document ID

    // Ensure patientId is present
    if (!prescriptionData.patientId || !mongoose.Types.ObjectId.isValid(prescriptionData.patientId)) {
      throw new AppError('Invalid Patient ID format', 400);
    }
    // Ensure medications are present
    if (!prescriptionData.medications || prescriptionData.medications.length === 0) {
        throw new AppError('At least one medication is required', 400);
    }

    const newPrescription = await Prescription.create({
      ...prescriptionData,
      patientId: prescriptionData.patientId, // Ensure patientId from data is used
      doctorId: doctorId, // Use the looked-up Doctor ID
      createdBy: user._id, // Set creator
    });
    
    console.log("Prescription created successfully:", newPrescription._id);
    // TODO: Consider sending notifications here (e.g., to the patient)
    
    return newPrescription;
  }

  /**
   * Get all prescriptions for a specific patient
   * @param {String} patientId - The ID of the patient
   * @returns {Array} List of prescriptions
   */
  async getPrescriptionsByPatient(patientId) {
    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      throw new AppError('Invalid Patient ID format', 400);
    }
    
    // Find prescriptions and populate doctor details (name) for display
    const prescriptions = await Prescription.find({ patientId })
      .populate({
        path: 'doctorId',
        select: 'userId', // Select the userId field from Doctor
        populate: {
          path: 'userId',
          model: 'User',
          select: 'firstName lastName' // Select name fields from User
        }
      })
      .sort({ issueDate: -1 }); // Sort by most recent first
      
    // Clean up the populated data for frontend use
    return prescriptions.map(p => {
        const presJson = p.toJSON();
        
        // Safely access nested populated data
        const doctorUser = presJson.doctorId?.userId;
        // Construct name safely, trimming potential extra space if one name part is missing
        presJson.doctorName = doctorUser 
            ? `Dr. ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
            : 'Unknown Doctor';
            
        // Optionally remove the populated object if not needed by frontend
        // delete presJson.doctorId; 
        return presJson;
    });
  }

  /**
   * Get a single prescription by its ID
   * @param {String} id - The ID of the prescription
   * @returns {Object} The prescription object or null if not found
   */
  async getPrescriptionById(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Prescription ID format', 400);
    }
    
    const prescription = await Prescription.findById(id)
      .populate({ // Populate doctor details
        path: 'doctorId',
        select: 'userId specialization', 
        populate: { path: 'userId', model: 'User', select: 'firstName lastName' }
      })
      .populate({ // Populate patient details
        path: 'patientId',
        select: 'userId dateOfBirth gender', 
        populate: { path: 'userId', model: 'User', select: 'firstName lastName email phoneNumber' }
      });
      
     if (!prescription) return null;

    // Clean up populated data similar to getPrescriptionsByPatient if needed
     const presJson = prescription.toJSON();
     presJson.doctorName = presJson.doctorId?.userId 
         ? `Dr. ${presJson.doctorId.userId.firstName} ${presJson.doctorId.userId.lastName}` 
         : 'Unknown Doctor';
     presJson.doctorSpecialization = presJson.doctorId?.specialization || 'N/A';

     presJson.patientName = presJson.patientId?.userId
         ? `${presJson.patientId.userId.firstName} ${presJson.patientId.userId.lastName}`
         : 'Unknown Patient';
    presJson.patientEmail = presJson.patientId?.userId?.email || 'N/A';
    presJson.patientPhoneNumber = presJson.patientId?.userId?.phoneNumber || 'N/A';
    presJson.patientDOB = presJson.patientId?.dateOfBirth;
    presJson.patientGender = presJson.patientId?.gender;

     return presJson;
  }

  /**
   * Update a prescription
   * @param {String} id - The ID of the prescription to update
   * @param {Object} updates - The fields to update
   * @param {Object} user - The user performing the update (for updatedBy)
   * @returns {Object} The updated prescription object or null
   */
  async updatePrescription(id, updates, user) {
     if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Prescription ID format', 400);
    }
    
    // Prevent certain fields from being updated directly via this method if needed
    // e.g., delete updates.doctorId; delete updates.patientId;
    
    const updatedPrescription = await Prescription.findByIdAndUpdate(
      id,
      { 
          ...updates,
          updatedBy: user._id // Set updater
      },
      { new: true, runValidators: true } // Return the updated document and run schema validators
    );
    
    // TODO: Consider notifications on status changes (e.g., cancellation)
    
    return updatedPrescription;
  }

  /**
   * Delete a prescription by its ID
   * @param {String} id - The ID of the prescription to delete
   * @returns {Object} The deleted prescription object or null if not found
   */
  async deletePrescription(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError('Invalid Prescription ID format', 400);
    }
    const prescription = await Prescription.findByIdAndDelete(id);
    if (!prescription) {
      // Consider throwing a specific 'NotFound' error or just returning null
      return null;
    }
    return prescription; // Or return some confirmation
  }

  /**
   * Get all prescriptions for the currently logged-in patient user
   * @param {String} userId - The ID of the logged-in user
   * @returns {Array} List of prescriptions
   */
  async getMyPrescriptions(userId) {
    // 1. Find the patient record associated with the user ID
    const patient = await Patient.findOne({ userId }).select('_id').lean(); // Only need the patient's _id, use lean()
    if (!patient) {
      console.log(`getMyPrescriptions: Patient record not found for userId: ${userId}`);
      return []; // Return empty array if patient record doesn't exist
    }

    // 2. Find prescriptions for that patientId, populate doctor details
    const prescriptions = await Prescription.find({ patientId: patient._id })
      .populate({
          path: 'doctorId',
          select: 'specialization userId', // Correct: Select 'userId' and other needed Doctor fields
          populate: {
              path: 'userId', // Correct: Populate the field named 'userId'
              model: 'User', // Specify model for nested populate
              select: 'firstName lastName title' // Select necessary User fields
          }
      })
      .sort({ issueDate: -1 }); // Sort by most recent first

    // 3. Clean up and return plain objects (or use .lean() on the find query)
    return prescriptions.map(p => {
        const presJson = p.toJSON(); // Use toJSON to include virtuals if any
        const doctorUser = presJson.doctorId?.userId; // Correct: Access populated user via 'userId'
        const doctor = presJson.doctorId;
        presJson.doctorName = doctorUser 
            ? `${doctorUser.title || 'Dr.'} ${doctorUser.firstName || ''} ${doctorUser.lastName || ''}`.trim()
            : 'Unknown Doctor';
        presJson.doctorSpecialization = doctor?.specialization || 'N/A';
        // Optionally remove populated fields if not needed
        // delete presJson.doctorId;
        return presJson;
    });
  }
}

export default new PrescriptionService(); 