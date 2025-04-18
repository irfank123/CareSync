/**
 * Utility functions for handling MongoDB ObjectIds in the frontend
 */

/**
 * Safely extracts the MongoDB ObjectId from a document
 * @param {Object} document - Document that contains _id field
 * @returns {string} - The _id as a string, or null if not available
 */
export const extractObjectId = (document) => {
  if (!document) return null;
  
  // Handle string IDs (but check if it's the BAD string)
  if (typeof document._id === 'string') {
    if (document._id === '[object Object]') {
      console.warn('ObjectIdHelper: Received literal string "[object Object]" as _id');
      // Attempt fallback to licenseNumber if possible
      if (document.licenseNumber) {
        console.warn('ObjectIdHelper: Falling back to licenseNumber due to bad string _id');
        return document.licenseNumber;
      }
      return null; // Cannot use '[object Object]' string
    }
    return document._id; // It's a normal string ID
  }
  
  // Handle ObjectId instances with toString method
  if (document._id && typeof document._id.toString === 'function') {
    return document._id.toString();
  }
  
  // Handle plain object _id with stringable property (MongoDB sends these sometimes)
  if (document._id && typeof document._id === 'object') {
    // Try to access a common property MongoDB uses
    if (document._id.$oid) {
      return document._id.$oid;
    }
    
    // If it has an id property, use that
    if (document._id.id) {
      return document._id.id;
    }
  }
  
  // Fallback: if there's a licenseNumber (unique), use that for doctors
  // This is now primarily handled in the component, but acts as a last resort here
  if (document.licenseNumber) {
    console.warn('ObjectIdHelper: Falling back to licenseNumber (final attempt)');
    return document.licenseNumber;
  }
  
  // If _id is in a different format or missing, return null
  console.warn('ObjectIdHelper: Could not extract ObjectId from document:', document);
  return null;
};

/**
 * Validates if a string appears to be a valid MongoDB ObjectId
 * @param {string} id - The id to validate
 * @returns {boolean} - Whether the id is valid
 */
export const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  
  // MongoDB ObjectIds are 24 character hex strings
  return /^[0-9a-fA-F]{24}$/.test(id);
}; 