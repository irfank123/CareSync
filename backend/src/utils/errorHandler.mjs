// src/utils/errorHandler.mjs

/**
 * custom error class for API errors
 */
class AppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
  
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  /**
   * Handle validation errors from express-validator
   * @param {Object} validationErrors - Validation errors from express-validator
   * @returns {Object} Formatted error object
   */
  const formatValidationErrors = (validationErrors) => {
    const errors = {};
    
    validationErrors.forEach(error => {
      errors[error.param] = error.msg;
    });
    
    return {
      success: false,
      status: 'fail',
      statusCode: 400,
      message: 'Validation failed',
      errors
    };
  };
  
  /**
   * Handle JWT errors
   * @param {Error} err - JWT error
   * @returns {Object} Formatted error object
   */
  const handleJwtError = (err) => {
    let message = 'Authentication error';
    
    if (err.name === 'JsonWebTokenError') {
      message = 'Invalid token. Please log in again.';
    } else if (err.name === 'TokenExpiredError') {
      message = 'Your token has expired. Please log in again.';
    }
    
    return new AppError(message, 401);
  };
  
  /**
   * Handle MongoDB validation errors
   * @param {Error} err - MongoDB validation error
   * @returns {Object} Formatted error object
   */
  const handleValidationError = (err) => {
    const errors = Object.values(err.errors).map(el => el.message);
    const message = `Invalid input data. ${errors.join('. ')}`;
    return new AppError(message, 400);
  };
  
  /**
   * Handle MongoDB duplicate key errors
   * @param {Error} err - MongoDB duplicate key error
   * @returns {Object} Formatted error object
   */
  const handleDuplicateKeyError = (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate field value: ${value}. Please use another value for ${field}.`;
    return new AppError(message, 400);
  };
  
  /**
   * Development environment error handler
   * @param {Error} err - Error object
   * @param {Object} res - Express response object
   */
  const sendDevError = (err, res) => {
    res.status(err.statusCode || 500).json({
      success: false,
      message: err.message,
      error: err,
      stack: err.stack
    });
  };
  
  /**
   * Production environment error handler
   * @param {Error} err - Error object
   * @param {Object} res - Express response object
   */
  const sendProdError = (err, res) => {
    // Operational, trusted errors: send message to client
    if (err.isOperational) {
      res.status(err.statusCode).json({
        success: false,
        message: err.message
      });
    } 
    // Programming or unknown errors: don't leak error details
    else {
      // Log error
      console.error('ERROR 💥', err);
      
      // Send generic message
      res.status(500).json({
        success: false,
        message: 'Something went wrong'
      });
    }
  };
  
  /**
   * Global error handling middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  const globalErrorHandler = (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    
    // Add request ID if available
    const requestId = req.id || '';
    
    // Log error details
    console.error(`[${new Date().toISOString()}][${requestId}] Error:`, {
      message: err.message,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: req.user ? req.user._id : 'unauthenticated'
    });
    
    // Handle specific error types
    let error = { ...err };
    error.message = err.message;
    
    if (err.name === 'CastError') {
      error = new AppError(`Invalid ${err.path}: ${err.value}`, 400);
    }
    
    if (err.name === 'ValidationError') {
      error = handleValidationError(err);
    }
    
    if (err.code === 11000) {
      error = handleDuplicateKeyError(err);
    }
    
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      error = handleJwtError(err);
    }
    
    // Send appropriate error response based on environment
    if (process.env.NODE_ENV === 'development') {
      sendDevError(error, res);
    } else {
      sendProdError(error, res);
    }
  };
  
  // Async handler to eliminate try/catch blocks
  const asyncHandler = (fn) => {
    return (req, res, next) => {
      fn(req, res, next).catch(next);
    };
  };
  
  export {
    AppError,
    formatValidationErrors,
    globalErrorHandler,
    asyncHandler
  };