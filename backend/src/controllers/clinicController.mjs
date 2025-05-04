import { check, validationResult } from 'express-validator';
import { withServicesForController } from '../utils/controllerHelper.mjs';

/**
 * @desc    Create a new clinic profile
 * @route   POST /api/clinics
 * @access  Private (Authenticated Admin User without a clinic)
 */
const createClinic = async (req, res, next, { clinicService }) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ success: false, errors: errors.array() });
  }

  try {
    // Authorization is handled by middleware (authMiddleware.authorizeClinicAdminCreation)
    const userId = req.user._id;
    const clinicData = req.body;

    // Call service to create clinic and link user
    const { clinic, user } = await clinicService.createClinicAndLinkAdmin(userId, clinicData);

    res.status(201).json({
      success: true,
      message: 'Clinic created successfully',
      clinic,
      user // Send back updated user potentially?
    });

  } catch (error) {
    console.error('Create clinic error:', error);
    res.status(500).json({ success: false, message: error.message || 'Failed to create clinic' });
  }
};

// Validation rules for creating a clinic
export const createClinicValidation = [
  check('name', 'Clinic name is required').not().isEmpty().trim(),
  // Temporarily relax phone validation to just check if not empty
  check('phone', 'Phone number is required').not().isEmpty(), 
  // check('phone', 'Valid phone number is required').isMobilePhone(), // Original stricter validation
  check('address.street', 'Street address is required').not().isEmpty(),
  check('address.city', 'City is required').not().isEmpty(),
  check('address.state', 'State is required').not().isEmpty(),
  check('address.zipCode', 'ZIP code is required').not().isEmpty(),
  check('address.country', 'Country is required').not().isEmpty(),
  // Add validation for other fields as needed
];

// --- Controller Object and DI --- //
const clinicController = {
  createClinic,
  // Add other controller methods (getClinic, updateClinic etc.) later
};

const dependencies = {
  createClinic: ['clinicService'], // Requires a clinic service
  // Define dependencies for other methods
};

const enhancedController = withServicesForController(clinicController, dependencies);

export const { 
  createClinic: createClinicWithDI,
  // Export other methods
} = enhancedController;

export default enhancedController; 