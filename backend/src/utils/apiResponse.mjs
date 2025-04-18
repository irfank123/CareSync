/**
 * Standard API response format
 */
class ApiResponse {
  /**
   * Create a standard API response
   * @param {boolean} success - Response success status
   * @param {string} message - Response message
   * @param {any} data - Response data
   */
  constructor(success, message, data = null) {
    this.success = success;
    this.message = message;
    this.data = data;
    this.timestamp = new Date();
  }
}

/**
 * API Error for consistent error handling
 * @extends Error
 */
class ApiError extends Error {
  /**
   * Create an API error
   * @param {string} message - Error message
   * @param {number} statusCode - HTTP status code
   * @param {Array} errors - Additional error details
   */
  constructor(message, statusCode = 500, errors = []) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

export { ApiResponse, ApiError }; 