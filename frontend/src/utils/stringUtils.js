/**
 * Safely converts various types of ID representations to string format
 * This helps handle MongoDB ObjectID objects that might be passed around
 * 
 * @param {*} id - The ID to convert (Object, String, etc)
 * @returns {string|null} - String representation of the ID or null if invalid
 */
export const safeObjectId = (id) => {
  try {
    // Early exit for common scenarios to avoid unnecessary processing
    if (!id) return null;

    // Already a string, ensure it's a valid format for MongoDB ObjectID
    if (typeof id === 'string') {
      // If it's a valid MongoDB ObjectID format (24 hex chars), return as is
      if (/^[0-9a-fA-F]{24}$/.test(id)) {
        return id;
      } 
      // If it's a temp ID from our system, we should return null as backend won't accept it
      else if (id.startsWith('temp-')) {
        console.warn('Skipping temporary ID that will be rejected by backend:', id);
        return null;
      }
      return id; // Return the string ID even if not standard format
    }

    // For objects that might be MongoDB ObjectIds or similar
    if (typeof id === 'object' && id !== null) {
      // Log debug info to help diagnose issues
      console.log('Processing object ID, keys:', Object.keys(id));
      
      // Handle MongoDB ObjectID objects with toString method
      if (id.toString && typeof id.toString === 'function') {
        const str = id.toString();
        // Only return if it looks like a valid MongoDB ObjectID
        if (/^[0-9a-fA-F]{24}$/.test(str)) {
          return str;
        }
      }

      // Try common ID fields if present
      if (id._id) return safeObjectId(id._id);
      if (id.id) return safeObjectId(id.id);
      
      // If there's a buffer property (common in MongoDB ObjectID objects)
      if (id.buffer && typeof id.buffer === 'object') {
        // Try to extract a hex string if it has a toString method
        if (id.buffer.toString && typeof id.buffer.toString === 'function') {
          const hexString = id.buffer.toString();
          // Check if it's a valid hex string of correct length
          if (/^[0-9a-fA-F]{24}$/.test(hexString)) {
            return hexString;
          }
        }
      }
    }
    
    // If we get here, we couldn't extract a valid ID
    return null;
  } catch (error) {
    console.error('Error in safeObjectId:', error);
    return null;
  }
}; 