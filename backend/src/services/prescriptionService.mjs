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
    
    // Step 1: Find prescriptions for the patient, selecting necessary fields including doctorId
    const prescriptions = await Prescription.find({ patientId })
        .select('_id patientId doctorId medications status prescriptionDate createdAt updatedAt expirationDate verificationCode') // Select fields needed
        .sort({ prescriptionDate: -1 })
        .lean(); // Use lean for performance as we'll manually map

    if (!prescriptions || prescriptions.length === 0) {
      return [];
    }

    // Step 2: Collect unique doctor IDs
    const doctorIds = [...new Set(prescriptions.map(p => p.doctorId?.toString()).filter(id => id))];

    // Step 3: Fetch the corresponding Doctor documents and populate their User details
    const doctors = await Doctor.find({ '_id': { $in: doctorIds } })
        .select('_id userId specialization') // Select fields needed from Doctor
        .populate({ 
            path: 'userId', 
            model: 'User', 
            select: 'firstName lastName title' // Select fields needed from User
        })
        .lean(); // Use lean

    // Step 4: Create a lookup map for doctor details (doctorId -> { name, specialization })
    const doctorDetailsMap = doctors.reduce((map, doc) => {
        if (doc.userId) { // Check if population succeeded
            map[doc._id.toString()] = {
                name: `${doc.userId.title || 'Dr.'} ${doc.userId.firstName || ''} ${doc.userId.lastName || ''}`.trim(),
                specialization: doc.specialization || 'N/A'
            };
        } else {
             map[doc._id.toString()] = {
                name: 'Unknown Doctor (User not found)',
                specialization: doc.specialization || 'N/A'
            };
        }
        return map;
    }, {});
    
    console.log('[Service getPrescriptionsByPatient] Doctor Details Map:', doctorDetailsMap);

    // Step 5: Map prescriptions to the final format, adding doctor details from the map
    return prescriptions.map(p => {
        const doctorDetails = doctorDetailsMap[p.doctorId?.toString()] || { name: 'Unknown Doctor', specialization: 'N/A' };
        
        // Construct the final object
        const finalPrescription = {
            ...p, // Spread the original prescription fields
            issueDate: p.prescriptionDate, // Rename date field
            doctorName: doctorDetails.name,
            doctorSpecialization: doctorDetails.specialization,
            // Remove fields we don't need to send to frontend
            // delete p.prescriptionDate;
            // delete p.doctorId;
        };
        
        // Clean up fields before returning
        delete finalPrescription.prescriptionDate;
        delete finalPrescription.doctorId;
        
        console.log(`[Service getPrescriptionsByPatient] Mapped prescription for response:`, JSON.stringify(finalPrescription, null, 2));
        
        return finalPrescription;
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
    const patient = await Patient.findOne({ userId }).select('_id').lean();
    if (!patient) {
      console.log(`getMyPrescriptions: Patient record not found for userId: ${userId}`);
      return [];
    }

    // 2. Find prescriptions for that patientId, selecting necessary fields
    const prescriptions = await Prescription.find({ patientId: patient._id })
      .select('_id patientId doctorId medications status prescriptionDate createdAt updatedAt expirationDate verificationCode') // Select fields needed
      .sort({ prescriptionDate: -1 }) // Sort by original date field
      .lean(); // Use lean

    if (!prescriptions || prescriptions.length === 0) {
        return [];
    }

    // 3. Collect unique doctor IDs
    const doctorIds = [...new Set(prescriptions.map(p => p.doctorId?.toString()).filter(id => id))];

    // 4. Fetch corresponding Doctor documents and populate their User details
    const doctors = await Doctor.find({ '_id': { $in: doctorIds } })
        .select('_id userId specialization') // Select fields needed from Doctor
        .populate({ 
            path: 'userId', 
            model: 'User', 
            select: 'firstName lastName title' // Select fields needed from User
        })
        .lean();

    // 5. Create a lookup map for doctor details
    const doctorDetailsMap = doctors.reduce((map, doc) => {
        if (doc.userId) {
            map[doc._id.toString()] = {
                name: `${doc.userId.title || 'Dr.'} ${doc.userId.firstName || ''} ${doc.userId.lastName || ''}`.trim(),
                specialization: doc.specialization || 'N/A'
            };
        } else {
             map[doc._id.toString()] = {
                name: 'Unknown Doctor (User not found)',
                specialization: doc.specialization || 'N/A'
            };
        }
        return map;
    }, {});
    
    console.log('[Service getMyPrescriptions] Doctor Details Map:', doctorDetailsMap);

    // 6. Map prescriptions to the final format
    return prescriptions.map(p => {
        const doctorDetails = doctorDetailsMap[p.doctorId?.toString()] || { name: 'Unknown Doctor', specialization: 'N/A' };
        
        const finalPrescription = {
            ...p,
            issueDate: p.prescriptionDate, // Rename date field
            doctorName: doctorDetails.name,
            doctorSpecialization: doctorDetails.specialization,
        };
        
        // Clean up fields
        delete finalPrescription.prescriptionDate;
        delete finalPrescription.doctorId;
        
        console.log(`[Service getMyPrescriptions] Mapped prescription for response:`, JSON.stringify(finalPrescription, null, 2));

        return finalPrescription;
    });
  }
}

export default new PrescriptionService(); 