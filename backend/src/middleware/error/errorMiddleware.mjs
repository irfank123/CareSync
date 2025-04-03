// src/middleware/error/errorMiddleware.mjs

import { AppError, formatValidationErrors } from '../../utils/errorHandler.mjs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';

/**
 * Middleware for standardized error handling
 */
const errorMiddleware = {
  /**
   * Catch async errors and forward to error handler
   * @param {Function} fn - Async function to wrap
   * @returns {Function} Middleware function with error handling
   */
  catchAsync: (fn) => {
    return (req, res, next) => {
      Promise.resolve(fn(req, res, next)).catch(next);
    };
  },
  
  /**
   * Handle MongoDB casting errors (e.g., invalid ObjectId)
   * @param {Error} err - Error object
   * @returns {AppError} Standardized app error
   */
  handleCastError: (err) => {
    const message = `Invalid ${err.path}: ${err.value}`;
    return new AppError(message, 400);
  },
  
  /**
   * Handle Mongoose validation errors
   * @param {Error} err - Error object
   * @returns {AppError} Standardized app error
   */
  handleValidationError: (err) => {
    const errors = Object.values(err.errors).map(error => error.message);
    const message = `Invalid input data: ${errors.join('. ')}`;
    return new AppError(message, 400);
  },
  
  /**
   * Handle MongoDB duplicate key errors
   * @param {Error} err - Error object
   * @returns {AppError} Standardized app error
   */
  handleDuplicateKeyError: (err) => {
    const field = Object.keys(err.keyValue)[0];
    const value = err.keyValue[field];
    const message = `Duplicate value for '${field}': ${value}. Please use another value.`;
    return new AppError(message, 400);
  },
  
  /**
   * Handle JWT errors
   * @param {Error} err - Error object
   * @returns {AppError} Standardized app error
   */
  handleJwtError: (err) => {
    let message = 'Authentication failed';
    
    if (err.name === 'JsonWebTokenError') {
      message = 'Invalid authentication token. Please log in again.';
    } else if (err.name === 'TokenExpiredError') {
      message = 'Your authentication token has expired. Please log in again.';
    }
    
    return new AppError(message, 401);
  },
  
  /**
   * Handle errors for development environment
   * @param {Error} err - Error object
   * @param {Object} res - Express response object
   */
  sendErrorDev: (err, res) => {
    const statusCode = err.statusCode || 500;
    
    res.status(statusCode).json({
      success: false,
      status: err.status || 'error',
      message: err.message,
      stack: err.stack,
      error: err
    });
  },
  
  /**
   * Handle errors for production environment
   * @param {Error} err - Error object
   * @param {Object} res - Express response object
   */
  sendErrorProd: (err, res) => {
    const statusCode = err.statusCode || 500;
    
    // Operational, trusted errors: send message to client
    if (err.isOperational) {
      res.status(statusCode).json({
        success: false,
        status: err.status || 'error',
        message: err.message
      });
    } 
    // Programming or unknown errors: don't leak error details
    else {
      // Log error for server admin
      console.error('ERROR:', err);
      
      // Send generic message to client
      res.status(500).json({
        success: false,
        status: 'error',
        message: 'Something went wrong on the server'
      });
    }
  },
  
  /**
   * Global error handler middleware
   * @param {Error} err - Error object
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  globalErrorHandler: (err, req, res, next) => {
    err.statusCode = err.statusCode || 500;
    err.status = err.status || 'error';
    
    // Add request ID if available for correlation in logs
    const requestId = req.id || '';
    
    // Log error details for server monitoring
    console.error(`[${new Date().toISOString()}][${requestId}] Error:`, {
      message: err.message,
      statusCode: err.statusCode,
      path: req.originalUrl,
      method: req.method,
      ip: req.ip,
      user: req.user ? req.user._id : 'unauthenticated'
    });
    
    // Process different types of errors to create consistent error responses
    let error = { ...err };
    error.message = err.message;
    error.name = err.name;
    error.code = err.code;
    
    // Handle specific types of errors
    if (error.name === 'CastError') {
      error = errorMiddleware.handleCastError(error);
    } else if (error.name === 'ValidationError') {
      error = errorMiddleware.handleValidationError(error);
    } else if (error.code === 11000) {
      error = errorMiddleware.handleDuplicateKeyError(error);
    } else if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      error = errorMiddleware.handleJwtError(error);
    }
    
    // Send appropriate error response based on environment
    if (process.env.NODE_ENV === 'development') {
      errorMiddleware.sendErrorDev(error, res);
    } else {
      errorMiddleware.sendErrorProd(error, res);
    }
  },
  
  /**
   * Handle 404 errors for routes that don't exist
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  notFound: (req, res, next) => {
    const error = new AppError(`Cannot find ${req.method} ${req.originalUrl} on this server`, 404);
    next(error);
  },
  
  /**
   * Handle payload too large errors
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  payloadTooLarge: (err, req, res, next) => {
    if (err.type === 'entity.too.large') {
      const error = new AppError('Request entity too large', 413);
      return next(error);
    }
    next(err);
  }
};

export default errorMiddleware;