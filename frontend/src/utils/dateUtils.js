import { format, parseISO, isValid } from 'date-fns';

/**
 * Validates if the given string is a valid date
 * @param {string} dateString - Date string to validate
 * @returns {boolean} - Whether the date is valid
 */
export const isValidDate = (dateString) => {
  if (!dateString) return false;
  
  try {
    // Try to parse as ISO string first
    let date = parseISO(dateString);
    if (isValid(date)) return true;
    
    // If not ISO format, try as regular date
    date = new Date(dateString);
    return date instanceof Date && !isNaN(date);
  } catch (error) {
    console.error("Error validating date:", error);
    return false;
  }
};

/**
 * Validates if the given string is a valid time in HH:MM format
 * @param {string} timeString - Time string to validate (HH:MM)
 * @returns {boolean} - Whether the time format is valid
 */
export const isValidTime = (timeString) => {
  if (!timeString) return false;
  
  // Check if it matches a valid time format (HH:MM)
  const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9])$/;
  return timeRegex.test(timeString);
};

/**
 * Formats a date string with fallback for invalid dates
 * @param {string} dateString - Date string to format
 * @param {string} formatStr - Format string for date-fns
 * @param {string} fallback - Fallback text if date is invalid
 * @returns {string} - Formatted date or fallback string
 */
export const formatDate = (dateString, formatStr = 'PPP', fallback = 'Invalid date') => {
  if (!isValidDate(dateString)) return fallback;
  
  try {
    // Try to parse as ISO string first
    let date = parseISO(dateString);
    if (!isValid(date)) {
      // If not ISO format, try as regular date
      date = new Date(dateString);
    }
    
    return format(date, formatStr);
  } catch (error) {
    console.error("Error formatting date:", error);
    return fallback;
  }
};

/**
 * Formats a date and time together with validation
 * @param {string} dateString - Date string
 * @param {string} timeString - Time string
 * @param {string} dateFormat - Format for the date part
 * @returns {string} - Formatted date and time or error message
 */
export const formatDateAndTime = (dateString, timeString, dateFormat = 'MMMM dd, yyyy') => {
  if (!isValidDate(dateString)) return 'Invalid date';
  
  const formattedDate = formatDate(dateString, dateFormat);
  
  if (!isValidTime(timeString)) {
    return `${formattedDate} at Invalid time`;
  }
  
  return `${formattedDate} at ${timeString}`;
}; 