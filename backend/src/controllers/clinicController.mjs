import { validationResult, check } from 'express-validator';
import { withServicesForController } from '../utils/controllerHelper.mjs';
import { formatValidationErrors } from '../utils/errorHandler.mjs';

/**
 * @desc    Create a new clinic profile for the logged-in user
 * @route   POST /api/clinics
 * @access  Private (Admin user without a clinic)
 */
const createClinic = async (req, res, next, { clinicService }) => {
  // Validation would happen via middleware before this
  try {
    // TODO: Add validation checks if not done via middleware

    // The authenticated user ID should be available from authMiddleware
    const userId = req.user._id; 
    const clinicData = req.body;

    console.log(`[DEBUG] Attempting to create clinic for user ${userId}`);

    const { clinic, user } = await clinicService.createClinicAndLinkUser(userId, clinicData);

    res.status(201).json({
      success: true,
      message: 'Clinic created successfully',
      data: { clinic, user } // Return updated user and clinic data
    });

  } catch (error) {
    console.error('Create clinic error:', error);
    // Use next to pass error to global handler, or send specific response
    res.status(error.statusCode || 400).json({
      success: false,
      message: error.message || 'Failed to create clinic'
    });
    // next(error); // Alternative: use global error handler
  }
};

// Validation rules for creating a clinic
export const createClinicValidation = [
  check('name', 'Clinic name is required').not().isEmpty().trim(),
  check('phone', 'Valid phone number is required').isMobilePhone(), // Use appropriate validation
  check('address.street', 'Street address is required').not().isEmpty(),
  check('address.city', 'City is required').not().isEmpty(),
  check('address.state', 'State is required').not().isEmpty(),
  check('address.zipCode', 'ZIP code is required').not().isEmpty(),
  check('address.country', 'Country is required').not().isEmpty(),
  // Add validation for other fields as needed
];

// Controller methods object
const clinicController = {
  createClinic,
  // TODO: Add other clinic operations (get, update, etc.) later
};

// Service dependencies for each method
const dependencies = {
  createClinic: ['clinicService'],
};

// Apply DI to the controller
const enhancedController = withServicesForController(clinicController, dependencies);

// Export individual methods with DI
export const {
  createClinic: createClinicWithDI,
} = enhancedController;

// Default export (optional)
export default enhancedController; 