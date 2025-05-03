import { withServices } from '../utils/controllerHelper.mjs';
import { asyncHandler, AppError, formatValidationErrors } from '../utils/errorHandler.mjs';
import { validationResult } from 'express-validator';
import mongoose from 'mongoose';

// --- Controller Functions --- //

/**
 * @desc    Create new prescription
 * @route   POST /api/prescriptions
 * @access  Private (Doctor)
 */
const createPrescription = async (req, res, next, { prescriptionService }) => {
  // Validation (add express-validator checks later)
  // const errors = validationResult(req);
  // if (!errors.isEmpty()) {
  //   return res.status(400).json(formatValidationErrors(errors.array()));
  // }

  const prescriptionData = req.body;
  const doctorId = req.user.id; // Assuming doctor's user ID is in req.user
  // We might need to find the Doctor record ID from the user ID
  // const doctorRecord = await Doctor.findOne({ userId: doctorId });
  // if (!doctorRecord) return next(new AppError('Doctor profile not found', 404));

  // TODO: Add logic to confirm doctorId in request body or use logged-in doctor
  // TODO: Ensure patientId is provided and valid
  
  const prescription = await prescriptionService.createPrescription(
      prescriptionData,
      // doctorRecord._id, // Pass actual doctor record ID 
      req.user // Pass user for createdBy field
  );
  
  res.status(201).json({
    success: true,
    data: prescription
  });
};

/**
 * @desc    Get prescriptions for a specific patient
 * @route   GET /api/prescriptions/patient/:patientId
 * @access  Private (Doctor or Patient)
 */
const getPatientPrescriptions = async (req, res, next, { prescriptionService }) => {
  const { patientId } = req.params;
  
  // TODO: Add permission check: is logged-in user the patient OR a doctor?
  
  const prescriptions = await prescriptionService.getPrescriptionsByPatient(patientId);
  
  res.status(200).json({
    success: true,
    count: prescriptions.length,
    data: prescriptions
  });
};

/**
 * @desc    Get single prescription by ID
 * @route   GET /api/prescriptions/:id
 * @access  Private (Doctor or Patient involved)
 */
const getPrescriptionById = async (req, res, next, { prescriptionService }) => {
  const { id } = req.params;
  
  const prescription = await prescriptionService.getPrescriptionById(id);
  
  if (!prescription) {
    return next(new AppError('Prescription not found', 404));
  }
  
  // TODO: Add permission check: is user the doctor who prescribed or the patient?
  
  res.status(200).json({
    success: true,
    data: prescription
  });
};

/**
 * @desc    Update prescription (e.g., status)
 * @route   PUT /api/prescriptions/:id
 * @access  Private (Doctor)
 */
const updatePrescription = async (req, res, next, { prescriptionService }) => {
  const { id } = req.params;
  const updates = req.body;
  
  // TODO: Add more specific permission check? (Only prescribing doctor?)
  
  const updatedPrescription = await prescriptionService.updatePrescription(
      id, 
      updates, 
      req.user // Pass user for updatedBy field
  );
  
  if (!updatedPrescription) {
    return next(new AppError('Prescription not found or could not be updated', 404));
  }
  
  res.status(200).json({
    success: true,
    data: updatedPrescription
  });
};

/**
 * @desc    Get prescriptions for the logged-in patient
 * @route   GET /api/prescriptions/me
 * @access  Private (Patient)
 */
const getMyPrescriptions = async (req, res, next, { prescriptionService }) => {
  try {
    // User ID should be available from authMiddleware
    const userId = req.user?._id;
    if (!userId) {
      // This shouldn't happen if authMiddleware is used, but good practice to check
      return res.status(401).json({ success: false, message: 'Authentication required.' });
    }

    console.log(`Controller: Fetching prescriptions for user ID: ${userId}`);
    const prescriptions = await prescriptionService.getMyPrescriptions(userId);
    console.log(`Controller: Found ${prescriptions.length} prescriptions for user ID: ${userId}`);

    res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    console.error('Error in getMyPrescriptions controller:', error);
    next(error); // Pass error to the global error handler
  }
};

// --- Dependency Injection Wrappers --- //

// Use withServices for individual function wrapping
const createPrescriptionWithDI = withServices(createPrescription, ['prescriptionService']);
export const getPatientPrescriptionsWithDI = withServices(getPatientPrescriptions, ['prescriptionService']);
const getPrescriptionByIdWithDI = withServices(getPrescriptionById, ['prescriptionService']);
const updatePrescriptionWithDI = withServices(updatePrescription, ['prescriptionService']);
// Convert to use standard withServices
const getMyPrescriptionsWithDI = withServices(getMyPrescriptions, ['prescriptionService']);

// TODO: Add validation exports if needed 

// Make sure to export the new function
export {
  createPrescriptionWithDI,
  // getAllPrescriptionsWithDI, // Comment out or remove this export until we define it
  getPrescriptionByIdWithDI,
  updatePrescriptionWithDI,
  // deletePrescriptionWithDI, // Comment out or remove this export until we define it
  // getPrescriptionsByPatientWithDI, // Comment out or remove this export until we define it
  getMyPrescriptionsWithDI,
}; 