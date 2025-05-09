// src/services/base/baseService.mjs

import mongoose from 'mongoose';
import { AppError } from '../../utils/errorHandler.mjs';

/**
 * Base Service class with common CRUD operations
 * that can be extended by specific resource services
 */
class BaseService {
  /**
   * Create a new BaseService
   * @param {Object} model - Mongoose model
   * @param {string} modelName - Name of the model (for error messages)
   * @param {Object} options - Additional options
   */
  constructor(model, modelName, options = {}) {
    this.model = model;
    this.modelName = modelName;
    this.options = {
      populateFields: [],
      searchFields: ['name', 'email'],
      ...options
    };
    
    // Flag indicating if this service supports clinic associations
    this.supportsClinic = options.supportsClinic || false;
  }
  
  /**
   * Get all resources with filtering and pagination
   * @param {Object} options - Query options
   * @returns {Object} Resources and pagination info
   */
  async getAll(options) {
    try {
      const {
        page = 1,
        limit = 10,
        search,
        sort = 'createdAt',
        order = 'desc',
        ...filters
      } = options;
      
      const skip = (page - 1) * limit;
      
      // Build query with filters
      const query = this._buildQuery(filters, search);
      
      // Create sort object
      const sortOptions = {};
      sortOptions[sort] = order === 'desc' ? -1 : 1;
      
      // Execute query with pagination
      const data = await this.model.find(query)
        .populate(this.options.populateFields)
        .sort(sortOptions)
        .skip(skip)
        .limit(limit)
        .lean();
      
      // Get total count for pagination
      const total = await this.model.countDocuments(query);
      
      return {
        data: this._serializeIds(data),
        total,
        totalPages: Math.ceil(total / limit),
        currentPage: page
      };
    } catch (error) {
      this._handleError(error, `Failed to retrieve ${this.modelName.toLowerCase()}s`);
    }
  }
  
  /**
   * Get a single resource by ID
   * @param {string} id - Resource ID
   * @returns {Object} Resource
   */
  async getById(id) {
    try {
      this._validateId(id);
      
      const resource = await this.model.findById(id)
        .populate(this.options.populateFields)
        .lean();
      
      // Ensure ObjectIds are serialized correctly
      return this._serializeIds(resource);
    } catch (error) {
      this._handleError(error, `Failed to retrieve ${this.modelName.toLowerCase()}`);
    }
  }
  
  /**
   * Create a new resource
   * @param {Object} data - Resource data
   * @param {string} createdBy - User ID creating the resource
   * @returns {Object} Created resource
   */
  async create(data, createdBy) {
    try {
      const resource = await this.model.create(data);
      
      // If populateFields is specified, fetch the complete resource with populated fields
      if (this.options.populateFields.length > 0) {
        const populatedResource = await this.model.findById(resource._id)
          .populate(this.options.populateFields)
          .lean();
        return this._serializeIds(populatedResource);
      }
      
      return this._serializeIds(resource.toObject());
    } catch (error) {
      this._handleError(error, `Failed to create ${this.modelName.toLowerCase()}`);
    }
  }
  
  /**
   * Update a resource
   * @param {string} id - Resource ID
   * @param {Object} data - Update data
   * @param {string} updatedBy - User ID updating the resource
   * @returns {Object} Updated resource
   */
  async update(id, data, updatedBy) {
    try {
      this._validateId(id);
      
      const resource = await this.model.findByIdAndUpdate(
        id,
        { $set: data },
        { new: true, runValidators: true }
      ).populate(this.options.populateFields).lean();
      
      return this._serializeIds(resource);
    } catch (error) {
      this._handleError(error, `Failed to update ${this.modelName.toLowerCase()}`);
    }
  }
  
  /**
   * Delete a resource
   * @param {string} id - Resource ID
   * @param {string} deletedBy - User ID deleting the resource
   * @returns {boolean} Success status
   */
  async delete(id, deletedBy) {
    try {
      this._validateId(id);
      
      const result = await this.model.findByIdAndDelete(id);
      
      return !!result;
    } catch (error) {
      this._handleError(error, `Failed to delete ${this.modelName.toLowerCase()}`);
    }
  }
  
  /**
   * Get a resource by field value
   * @param {string} field - Field name
   * @param {*} value - Field value
   * @returns {Object} Resource
   */
  async getByField(field, value) {
    try {
      const query = { [field]: value };
      
      const resource = await this.model.findOne(query)
        .populate(this.options.populateFields)
        .lean();
      
      // Ensure _id is a string before returning
      if (resource && resource._id) {
        if (typeof resource._id.toString === 'function') {
          resource._id = resource._id.toString();
        } else {
          resource._id = String(resource._id); // Fallback
        }
      }

      return this._serializeIds(resource);
    } catch (error) {
      this._handleError(error, `Failed to retrieve ${this.modelName.toLowerCase()} by ${field}`);
    }
  }
  
  /**
   * Get a resource by user ID
   * @param {string} userId - User ID
   * @returns {Object} Resource
   */
  async getByUserId(userId) {
    try {
      this._validateId(userId);
      
      return await this.getByField('userId', userId);
    } catch (error) {
      this._handleError(error, `Failed to retrieve ${this.modelName.toLowerCase()} by user ID`);
    }
  }
  
  /**
   * Update a resource by user ID
   * @param {string} userId - User ID
   * @param {Object} data - Update data
   * @returns {Object} Updated resource
   */
  async updateByUserId(userId, data) {
    try {
      this._validateId(userId);
      
      const resource = await this.model.findOne({ userId });
      
      if (!resource) {
        return null;
      }
      
      return await this.update(resource._id, data, userId);
    } catch (error) {
      this._handleError(error, `Failed to update ${this.modelName.toLowerCase()} by user ID`);
    }
  }
  
  /**
   * Start a MongoDB session for transactions
   * @returns {Object} MongoDB session
   */
  async startSession() {
    return await mongoose.startSession();
  }
  
  /**
   * Helper method to ensure consistent serialization of MongoDB ObjectIds
   * @param {Object|Array} data - Data to process
   * @returns {Object|Array} Processed data with serialized ObjectIds
   * @protected
   */
  _serializeIds(data) {
    if (!data) return data;
    
    const processObject = (obj) => {
      if (!obj || typeof obj !== 'object') return obj;
      
      const result = Array.isArray(obj) ? [...obj] : { ...obj };
      
      Object.keys(result).forEach(key => {
        const value = result[key];
        
        // Convert ObjectId to string
        if (value && value._bsontype === 'ObjectID') {
          result[key] = value.toString();
        } 
        // Process nested objects and arrays
        else if (value && typeof value === 'object') {
          result[key] = processObject(value);
        }
      });
      
      // Handle _id specifically if it exists and is an ObjectId
      if (result._id && typeof result._id.toString === 'function') {
        result._id = result._id.toString();
      }
      
      return result;
    };
    
    return processObject(data);
  }
  
  /**
   * Validate MongoDB ObjectId
   * @param {string} id - ID to validate
   * @throws {AppError} If ID is invalid
   * @private
   */
  _validateId(id) {
    if (!mongoose.Types.ObjectId.isValid(id)) {
      throw new AppError(`Invalid ${this.modelName.toLowerCase()} ID: ${id}`, 400);
    }
  }
  
  /**
   * Build query object for MongoDB
   * @param {Object} filters - Filter criteria
   * @param {string} search - Search term
   * @returns {Object} MongoDB query object
   * @private
   */
  _buildQuery(filters, search) {
    const query = {};
    
    // Apply filters
    Object.keys(filters).forEach(key => {
      if (filters[key] !== undefined && filters[key] !== '') {
        query[key] = filters[key];
      }
    });
    
    // Add search functionality if search term provided
    if (search && this.options.searchFields.length > 0) {
      query.$or = this.options.searchFields.map(field => ({
        [field]: { $regex: search, $options: 'i' }
      }));
    }
    
    return query;
  }
  
  /**
   * Standardized error handling for service methods
   * @param {Error} error - Error object
   * @param {string} defaultMessage - Default error message
   * @throws {AppError} Standardized error
   * @private
   */
  _handleError(error, defaultMessage) {
    console.error(`${this.modelName} service error:`, error);
    
    // Handle different types of errors
    if (error instanceof AppError) {
      // Pass through AppErrors
      throw error;
    } else if (error.name === 'ValidationError') {
      // Mongoose validation errors
      const messages = Object.values(error.errors).map(err => err.message).join(', ');
      throw new AppError(`Validation error: ${messages}`, 400);
    } else if (error.name === 'CastError') {
      // Mongoose cast errors
      throw new AppError(`Invalid ${error.path}: ${error.value}`, 400);
    } else if (error.code === 11000) {
      // MongoDB duplicate key errors
      const field = Object.keys(error.keyValue)[0];
      const value = error.keyValue[field];
      throw new AppError(`Duplicate value for ${field}: ${value}`, 400);
    } else {
      // Generic errors
      throw new AppError(defaultMessage, 500);
    }
  }
}

export default BaseService;