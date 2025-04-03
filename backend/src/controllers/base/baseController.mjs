// src/controllers/base/baseController.mjs

import { AppError } from '../../utils/errorHandler.mjs';
import { errorMiddleware } from '../../middleware/index.mjs';

/**
 * Base controller class with common CRUD operations
 * that can be extended by specific resource controllers
 */
class BaseController {
  /**
   * Create a new BaseController
   * @param {Object} service - Service for handling business logic
   * @param {string} resourceName - Name of the resource (for error messages)
   */
  constructor(service, resourceName) {
    this.service = service;
    this.resourceName = resourceName;
    
    // Bind methods to ensure 'this' context
    this.getAll = this.getAll.bind(this);
    this.getOne = this.getOne.bind(this);
    this.create = this.create.bind(this);
    this.update = this.update.bind(this);
    this.delete = this.delete.bind(this);
    
    // Wrap methods with error handling
    this.getAll = errorMiddleware.catchAsync(this.getAll);
    this.getOne = errorMiddleware.catchAsync(this.getOne);
    this.create = errorMiddleware.catchAsync(this.create);
    this.update = errorMiddleware.catchAsync(this.update);
    this.delete = errorMiddleware.catchAsync(this.delete);
  }
  
  /**
   * Get all resources with pagination and filtering
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getAll(req, res, next) {
    // Extract query parameters
    const {
      page = 1,
      limit = 10,
      search,
      sort = 'createdAt',
      order = 'desc',
      ...filters
    } = req.query;
    
    // Call service method
    const result = await this.service.getAll({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      search,
      sort,
      order,
      ...filters
    });
    
    // Send response
    res.status(200).json({
      success: true,
      count: result.data.length,
      total: result.total,
      totalPages: result.totalPages,
      currentPage: result.currentPage,
      data: result.data
    });
  }
  
  /**
   * Get a single resource by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async getOne(req, res, next) {
    const id = req.params.id;
    
    const data = await this.service.getById(id);
    
    if (!data) {
      return next(new AppError(`${this.resourceName} not found`, 404));
    }
    
    res.status(200).json({
      success: true,
      data
    });
  }
  
  /**
   * Create a new resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async create(req, res, next) {
    // Handle clinic ID for resources with clinic association
    if (req.clinicId && this.service.supportsClinic) {
      req.body.clinicId = req.clinicId;
    }
    
    const data = await this.service.create(req.body, req.user._id);
    
    res.status(201).json({
      success: true,
      data
    });
  }
  
  /**
   * Update a resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async update(req, res, next) {
    const id = req.params.id;
    
    const data = await this.service.update(id, req.body, req.user._id);
    
    if (!data) {
      return next(new AppError(`${this.resourceName} not found`, 404));
    }
    
    res.status(200).json({
      success: true,
      data
    });
  }
  
  /**
   * Delete a resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  async delete(req, res, next) {
    const id = req.params.id;
    
    const success = await this.service.delete(id, req.user._id);
    
    if (!success) {
      return next(new AppError(`${this.resourceName} not found`, 404));
    }
    
    res.status(200).json({
      success: true,
      message: `${this.resourceName} deleted successfully`
    });
  }
  
  /**
   * Create standard route handler with additional permission check
   * @param {Function} handlerFn - Route handler function
   * @param {Function} permissionCheckFn - Permission check function
   * @returns {Function} Route handler with permission check
   */
  withPermissionCheck(handlerFn, permissionCheckFn) {
    return errorMiddleware.catchAsync(async (req, res, next) => {
      // Check permission
      const hasPermission = await permissionCheckFn(req);
      
      if (!hasPermission) {
        return next(new AppError('You do not have permission to perform this action', 403));
      }
      
      // Call original handler
      return handlerFn(req, res, next);
    });
  }
  
  /**
   * Get the current user's own resource (e.g., /me endpoints)
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  getOwnResource = errorMiddleware.catchAsync(async (req, res, next) => {
    if (!this.service.getByUserId) {
      return next(new AppError('This resource does not support user-specific retrieval', 501));
    }
    
    const data = await this.service.getByUserId(req.user._id);
    
    if (!data) {
      return next(new AppError(`${this.resourceName} not found for current user`, 404));
    }
    
    res.status(200).json({
      success: true,
      data
    });
  });
  
  /**
   * Update the current user's own resource
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next function
   */
  updateOwnResource = errorMiddleware.catchAsync(async (req, res, next) => {
    if (!this.service.updateByUserId) {
      return next(new AppError('This resource does not support user-specific updates', 501));
    }
    
    const data = await this.service.updateByUserId(req.user._id, req.body);
    
    if (!data) {
      return next(new AppError(`${this.resourceName} not found for current user`, 404));
    }
    
    res.status(200).json({
      success: true,
      data
    });
  });
}

export default BaseController;