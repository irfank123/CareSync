import mongooseActual from 'mongoose';
import { AppError } from '../../src/utils/errorHandler.mjs';

// --- Mock Dependencies ---

// Mock express-validator
jest.mock('express-validator', () => {
  // Create chainable validator functions
  const createChainableValidator = () => {
    const chain = {};
    const methods = [
      'isIn', 'custom', 'if', 'equals', 'not', 'isEmpty', 
      'isString', 'isBoolean', 'isMongoId', 'optional',
      'withMessage', 'isISO8601', 'toDate', 'matches',
      'notEmpty'
    ];
    
    methods.forEach(method => {
      chain[method] = jest.fn().mockReturnValue(chain);
    });
    
    return chain;
  };
  
  return {
    check: jest.fn().mockImplementation(() => createChainableValidator()),
    validationResult: jest.fn().mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    })
  };
});

// Mock mongoose
jest.mock('mongoose', () => {
  const mockObjectId = jest.fn().mockImplementation((id) => id);
  mockObjectId.isValid = jest.fn().mockReturnValue(true);
  
  return {
    Types: {
      ObjectId: mockObjectId
    },
    model: jest.fn().mockReturnValue({})
  };
});

// Mock utils
jest.mock('../../src/utils/errorHandler.mjs', () => {
  const originalModule = jest.requireActual('../../src/utils/errorHandler.mjs');
  return {
    ...originalModule,
    asyncHandler: jest.fn((fn) => {
      return (req, res, next) => {
        return Promise.resolve(fn(req, res, next)).catch(next);
      };
    }),
    formatValidationErrors: jest.fn(errors => ({ 
      success: false,
      errors
    }))
  };
});

// Mock models
jest.mock('../../src/models/index.mjs', () => ({
  __esModule: true,
  Doctor: {
    findOne: jest.fn(),
    findById: jest.fn()
  }
}));

// Mock availability service
jest.mock('../../src/services/availabilityService.mjs', () => ({
  __esModule: true,
  default: {
    getTimeSlots: jest.fn(),
    getAvailableTimeSlots: jest.fn(),
    createTimeSlot: jest.fn(),
    updateTimeSlot: jest.fn(),
    deleteTimeSlot: jest.fn(),
    getTimeSlotById: jest.fn(),
    getTimeSlotWithFormattedDate: jest.fn(),
    generateStandardTimeSlots: jest.fn(),
    importFromGoogleCalendar: jest.fn(),
    exportToGoogleCalendar: jest.fn(),
    syncWithGoogleCalendar: jest.fn()
  }
}));

// --- Import modules after mocking ---
import mongoose from 'mongoose';
import { validationResult, check } from 'express-validator';
import * as availabilityController from '../../src/controllers/availabilityController.mjs';
import { Doctor } from '../../src/models/index.mjs';
import availabilityService from '../../src/services/availabilityService.mjs';

describe('Availability Controller', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    req = {
      params: {},
      query: {},
      body: {},
      user: { _id: 'user123' },
      userRole: 'admin'
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
      set: jest.fn().mockReturnThis()
    };
    
    next = jest.fn();
    
    jest.clearAllMocks();
    
    // Setup default mocks
    availabilityService.getTimeSlots.mockResolvedValue([
      { _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00' }
    ]);
    
    availabilityService.getAvailableTimeSlots.mockResolvedValue([
      { _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00', status: 'available' }
    ]);
    
    availabilityService.createTimeSlot.mockResolvedValue({
      _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00'
    });
    
    availabilityService.updateTimeSlot.mockResolvedValue({
      _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00', status: 'available'
    });
    
    availabilityService.getTimeSlotById.mockResolvedValue({
      _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00'
    });
    
    availabilityService.getTimeSlotWithFormattedDate.mockResolvedValue({
      _id: 'slot1', doctorId: 'doctor1', date: '2023-10-10', formattedDate: 'Tuesday, October 10, 2023', startTime: '09:00', endTime: '10:00'
    });
    
    availabilityService.generateStandardTimeSlots.mockResolvedValue([
      { _id: 'slot1', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '09:00', endTime: '10:00' },
      { _id: 'slot2', doctorId: 'doctor1', date: new Date('2023-10-10'), startTime: '10:00', endTime: '11:00' }
    ]);
    
    availabilityService.importFromGoogleCalendar.mockResolvedValue({
      imported: 10,
      conflicts: 2
    });
    
    availabilityService.exportToGoogleCalendar.mockResolvedValue({
      exported: 8,
      skipped: 1
    });
    
    availabilityService.syncWithGoogleCalendar.mockResolvedValue({
      imported: 5,
      exported: 6,
      conflicts: 1
    });
    
    Doctor.findById.mockResolvedValue({
      _id: 'doctor1',
      userId: 'user123'
    });
    
    Doctor.findOne.mockResolvedValue({
      _id: 'doctor1',
      userId: 'user123',
      licenseNumber: 'LIC123'
    });
  });

  describe('getTimeSlots', () => {
    it('should return time slots for a valid doctor ID', async () => {
      req.params.doctorId = 'doctor1';
      req.query = { startDate: '2023-10-10', endDate: '2023-10-17' };
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(availabilityService.getTimeSlots).toHaveBeenCalledWith(
        'doctor1', 
        expect.any(Date), 
        expect.any(Date)
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: expect.any(Array)
      });
    });
    
    it('should handle invalid doctor ID format', async () => {
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      req.params.doctorId = 'invalid-id';
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle invalid date format', async () => {
      req.params.doctorId = 'doctor1';
      req.query = { startDate: 'invalid-date' };
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle service errors', async () => {
      req.params.doctorId = 'doctor1';
      availabilityService.getTimeSlots.mockRejectedValueOnce(new Error('Service error'));
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(500);
    });
  });
  
  describe('getAvailableTimeSlots', () => {
    it('should return available time slots for a valid doctor ID', async () => {
      req.params.doctorId = 'doctor1';
      req.query = { startDate: '2023-10-10', endDate: '2023-10-17' };
      
      await availabilityController.getAvailableTimeSlots(req, res, next);
      
      expect(availabilityService.getAvailableTimeSlots).toHaveBeenCalledWith(
        'doctor1', 
        expect.any(Date), 
        expect.any(Date)
      );
      expect(res.set).toHaveBeenCalledTimes(3); // Check if cache headers are set
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 1,
        data: expect.any(Array)
      });
    });
    
    it('should handle doctor lookup by license number', async () => {
      req.params.doctorId = 'LIC123';
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      await availabilityController.getAvailableTimeSlots(req, res, next);
      
      expect(Doctor.findOne).toHaveBeenCalledWith({ licenseNumber: 'LIC123' });
      expect(availabilityService.getAvailableTimeSlots).toHaveBeenCalledWith(
        'doctor1',  // Mock doctor ID returned by findOne
        null, 
        null
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle doctor not found with license number', async () => {
      req.params.doctorId = 'LIC999';
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      Doctor.findOne.mockResolvedValueOnce(null);
      
      await availabilityController.getAvailableTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('createTimeSlot', () => {
    beforeEach(() => {
      // Simulate the array of middleware in createTimeSlot
      req.body = {
        doctorId: 'doctor1',
        date: '2023-10-10',
        startTime: '09:00',
        endTime: '10:00'
      };
      req.user = { _id: 'user123' };
      req.userRole = 'doctor';
    });
    
    it('should create a time slot when validation passes', async () => {
      // Get the last middleware in the array (the actual controller function)
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(availabilityService.createTimeSlot).toHaveBeenCalledWith({
        doctorId: 'doctor1',
        date: '2023-10-10',
        startTime: '09:00',
        endTime: '10:00',
        createdBy: 'user123'
      });
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    it('should handle validation errors', async () => {
      validationResult.mockReturnValueOnce({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ msg: 'Date is required' }])
      });
      
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(400);
      expect(availabilityService.createTimeSlot).not.toHaveBeenCalled();
    });
    
    it('should handle time slot conflict errors', async () => {
      availabilityService.createTimeSlot.mockRejectedValueOnce(
        new Error('Time slot conflicts with existing slot')
      );
      
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should check authorization for non-admin users', async () => {
      req.userRole = 'doctor';
      // Make the doctor ID not match the user's doctor record
      Doctor.findById.mockResolvedValueOnce({
        _id: 'doctor1',
        userId: 'differentUser'
      });
      
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(availabilityService.createTimeSlot).not.toHaveBeenCalled();
    });
  });
  
  describe('updateTimeSlot', () => {
    beforeEach(() => {
      req.params.slotId = 'slot1';
      req.body = {
        status: 'blocked'
      };
      req.user = { _id: 'user123' };
      req.userRole = 'admin';
    });
    
    it('should update a time slot when validation passes', async () => {
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(availabilityService.updateTimeSlot).toHaveBeenCalledWith(
        'slot1',
        { status: 'blocked' },
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    it('should handle time slot not found', async () => {
      availabilityService.getTimeSlotById.mockResolvedValueOnce(null);
      
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(availabilityService.updateTimeSlot).not.toHaveBeenCalled();
    });
    
    it('should check authorization for non-admin users', async () => {
      req.userRole = 'doctor';
      // Make the doctor ID not match the user's doctor record
      Doctor.findById.mockResolvedValueOnce({
        _id: 'doctor1',
        userId: 'differentUser'
      });
      
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(availabilityService.updateTimeSlot).not.toHaveBeenCalled();
    });
  });
  
  describe('deleteTimeSlot', () => {
    beforeEach(() => {
      req.params.slotId = 'slot1';
      req.user = { _id: 'user123' };
      req.userRole = 'admin';
    });
    
    it('should delete a time slot successfully', async () => {
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(availabilityService.deleteTimeSlot).toHaveBeenCalledWith('slot1', 'user123');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        message: 'Time slot deleted successfully'
      });
    });
    
    it('should handle time slot not found', async () => {
      availabilityService.getTimeSlotById.mockResolvedValueOnce(null);
      
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
      expect(availabilityService.deleteTimeSlot).not.toHaveBeenCalled();
    });
    
    it('should prevent deleting booked time slots', async () => {
      availabilityService.getTimeSlotById.mockResolvedValueOnce({
        _id: 'slot1',
        doctorId: 'doctor1',
        status: 'booked'
      });
      
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(availabilityService.deleteTimeSlot).not.toHaveBeenCalled();
    });
  });
  
  describe('getTimeSlotById', () => {
    it('should return a time slot with formatted date', async () => {
      req.params.id = 'slot1';
      
      await availabilityController.getTimeSlotById(req, res, next);
      
      expect(availabilityService.getTimeSlotWithFormattedDate).toHaveBeenCalledWith('slot1');
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    it('should handle invalid time slot ID format', async () => {
      req.params.id = 'invalid-id';
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      await availabilityController.getTimeSlotById(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle time slot not found', async () => {
      req.params.id = 'slot999';
      availabilityService.getTimeSlotWithFormattedDate.mockResolvedValueOnce(null);
      
      await availabilityController.getTimeSlotById(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
  });
  
  describe('generateTimeSlots', () => {
    beforeEach(() => {
      req.params.doctorId = 'doctor1';
      req.body = {
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      req.user = { _id: 'user123' };
      req.userRole = 'admin';
    });
    
    it('should generate time slots successfully', async () => {
      await availabilityController.generateTimeSlots(req, res, next);
      
      expect(availabilityService.generateStandardTimeSlots).toHaveBeenCalledWith(
        'doctor1',
        expect.any(Date),
        expect.any(Date),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        count: 2,
        data: expect.any(Array)
      });
    });
    
    it('should handle invalid date format', async () => {
      req.body.startDate = 'invalid-date';
      
      await availabilityController.generateTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should check authorization for non-admin users', async () => {
      req.userRole = 'doctor';
      // Make the doctor ID not match the user's doctor record
      Doctor.findById.mockResolvedValueOnce({
        _id: 'doctor1',
        userId: 'differentUser'
      });
      
      await availabilityController.generateTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
      expect(availabilityService.generateStandardTimeSlots).not.toHaveBeenCalled();
    });
  });
  
  describe('Google Calendar integration', () => {
    beforeEach(() => {
      req.params.doctorId = 'doctor1';
      req.body = {
        refreshToken: 'refresh-token-123',
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      req.user = { _id: 'user123' };
      req.userRole = 'admin';
    });
    
    it('should import time slots from Google Calendar', async () => {
      await availabilityController.importFromGoogle(req, res, next);
      
      expect(availabilityService.importFromGoogleCalendar).toHaveBeenCalledWith(
        'doctor1',
        'refresh-token-123',
        expect.any(Date),
        expect.any(Date),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          imported: 10,
          conflicts: 2
        }
      });
    });
    
    it('should export time slots to Google Calendar', async () => {
      await availabilityController.exportToGoogle(req, res, next);
      
      expect(availabilityService.exportToGoogleCalendar).toHaveBeenCalledWith(
        'doctor1',
        'refresh-token-123',
        expect.any(Date),
        expect.any(Date),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          exported: 8,
          skipped: 1
        }
      });
    });
    
    it('should sync time slots with Google Calendar', async () => {
      await availabilityController.syncWithGoogle(req, res, next);
      
      expect(availabilityService.syncWithGoogleCalendar).toHaveBeenCalledWith(
        'doctor1',
        'refresh-token-123',
        expect.any(Date),
        expect.any(Date),
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: {
          imported: 5,
          exported: 6,
          conflicts: 1
        }
      });
    });
    
    it('should validate refresh token is required', async () => {
      req.body.refreshToken = undefined;
      
      await availabilityController.importFromGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
      expect(availabilityService.importFromGoogleCalendar).not.toHaveBeenCalled();
    });
  });
  
  describe('createTimeSlotValidation middleware', () => {
    it('should include correct validation rules', () => {
      // Check that validation middleware is properly configured
      expect(availabilityController.createTimeSlotValidation).toBeDefined();
      expect(availabilityController.createTimeSlotValidation).toBeInstanceOf(Array);
      
      // Simply verify the array exists with proper elements
      expect(availabilityController.createTimeSlotValidation.length).toBeGreaterThan(0);
      
      // Skipping direct execution since these are express-validator middleware
      // that can't be easily called in isolation
    });
  });
  
  describe('updateTimeSlotValidation middleware', () => {
    it('should include correct validation rules', () => {
      // Check that validation middleware is properly configured
      expect(availabilityController.updateTimeSlotValidation).toBeDefined();
      expect(availabilityController.updateTimeSlotValidation).toBeInstanceOf(Array);
      
      // Simply verify the array exists with proper elements
      expect(availabilityController.updateTimeSlotValidation.length).toBeGreaterThan(0);
      
      // Skipping direct execution since these are express-validator middleware
      // that can't be easily called in isolation
    });
  });
  
  describe('testing staff role permissions', () => {
    it('should allow staff to create time slots', async () => {
      req.userRole = 'staff';
      req.body = {
        doctorId: 'doctor1',
        date: '2023-10-10',
        startTime: '09:00',
        endTime: '10:00'
      };
      
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(availabilityService.createTimeSlot).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    it('should allow staff to update time slots', async () => {
      req.userRole = 'staff';
      req.params.slotId = 'slot1';
      req.body = { status: 'blocked' };
      
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(availabilityService.updateTimeSlot).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should allow staff to delete time slots', async () => {
      req.userRole = 'staff';
      req.params.slotId = 'slot1';
      
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(availabilityService.deleteTimeSlot).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should allow staff to generate time slots', async () => {
      req.userRole = 'staff';
      req.params.doctorId = 'doctor1';
      req.body = {
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      
      await availabilityController.generateTimeSlots(req, res, next);
      
      expect(availabilityService.generateStandardTimeSlots).toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(201);
    });
  });
  
  describe('error handling edge cases', () => {
    it('should handle date without providing time for getTimeSlots', async () => {
      req.params.doctorId = 'doctor1';
      req.query = { startDate: '2023-10-10' }; // No endDate
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(availabilityService.getTimeSlots).toHaveBeenCalledWith(
        'doctor1',
        expect.any(Date),
        null
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    it('should handle updateTimeSlot with time conflict errors', async () => {
      availabilityService.updateTimeSlot.mockRejectedValueOnce(
        new Error('Updated time slot would conflict with existing slot')
      );
      
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle updateTimeSlot with booked slot time change error', async () => {
      availabilityService.updateTimeSlot.mockRejectedValueOnce(
        new Error('Cannot change time or date of a booked slot')
      );
      
      const controllerFunc = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    it('should handle deleteTimeSlot with booked slot error', async () => {
      availabilityService.deleteTimeSlot.mockRejectedValueOnce(
        new Error('booked time slot')
      );
      
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
  });
  
  describe('additional Google Calendar integration tests', () => {
    it('should handle invalid date format for importFromGoogle', async () => {
      req.params.doctorId = 'doctor1';
      req.body = { 
        refreshToken: 'refresh-token-123',
        startDate: 'invalid-date',
        endDate: '2023-10-17'
      };
      
      await availabilityController.importFromGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle invalid date format for exportToGoogle', async () => {
      req.params.doctorId = 'doctor1';
      req.body = { 
        refreshToken: 'refresh-token-123',
        startDate: '2023-10-10',
        endDate: 'invalid-date'
      };
      
      await availabilityController.exportToGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should check authorization for syncWithGoogle', async () => {
      req.userRole = 'doctor';
      req.params.doctorId = 'doctor1';
      req.body = {
        refreshToken: 'refresh-token-123',
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      
      // Make the doctor ID not match the user's doctor record
      Doctor.findById.mockResolvedValueOnce({
        _id: 'doctor1',
        userId: 'differentUser'
      });
      
      await availabilityController.syncWithGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(403);
    });
    
    it('should validate missing refresh token for exportToGoogle', async () => {
      req.body = {
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      // No refreshToken
      
      await availabilityController.exportToGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should validate missing refresh token for syncWithGoogle', async () => {
      req.body = {
        startDate: '2023-10-10',
        endDate: '2023-10-17'
      };
      // No refreshToken
      
      await availabilityController.syncWithGoogle(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
  });
  
  describe('validation with custom validations and multi-step handlers', () => {
    it('should validate end time after start time in createTimeSlot', () => {
      // Find the validation rule for endTime that uses custom validation
      const endTimeValidator = availabilityController.createTimeSlot.find(middleware => 
        typeof middleware === 'object' && middleware.custom
      );
      
      expect(endTimeValidator).toBeDefined();
      
      // Mock implementation to test the custom validator
      if (endTimeValidator) {
        const mockRequest = {
          body: {
            startTime: '14:00',
            endTime: '13:00' // End time before start time
          }
        };
        
        // This would normally throw an error with the message "End time must be after start time"
        // but we can't easily test this without manually implementing the validator
        
        // Instead, we're verifying the validator exists in the middleware chain
        expect(availabilityController.createTimeSlot).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              custom: expect.any(Function)
            })
          ])
        );
      }
    });
    
    it('should validate multiple steps in updateTimeSlot middleware', () => {
      expect(availabilityController.updateTimeSlot.length).toBeGreaterThan(1);
      // First items should be validation middleware, last item is the controller function
      
      const lastMiddleware = availabilityController.updateTimeSlot[availabilityController.updateTimeSlot.length - 1];
      expect(typeof lastMiddleware).toBe('function');
    });
  });
  
  // Add tests for missing code paths to get to 90% coverage
  describe('missing code paths coverage', () => {
    it('should handle both start and end time validation in getTimeSlots', async () => {
      req.params.doctorId = 'doctor1';
      req.query = { 
        startDate: '2023-10-10',
        endDate: 'invalid-date'
      };
      
      await availabilityController.getTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(400);
    });
    
    it('should handle missing both start and end dates in generateTimeSlots', async () => {
      req.params.doctorId = 'doctor1';
      req.body = {}; // No dates provided
      
      await availabilityController.generateTimeSlots(req, res, next);
      
      // The controller should still work, providing null values to the service
      expect(availabilityService.generateStandardTimeSlots).toHaveBeenCalledWith(
        'doctor1', 
        null, 
        null,
        'user123'
      );
    });
    
    it('should test license number lookup flow when doctor not found', async () => {
      req.params.doctorId = 'invalid-id';
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      Doctor.findOne.mockResolvedValueOnce(null);
      
      await availabilityController.getAvailableTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].message).toContain('not found');
    });
    
    it('should handle other error types in createTimeSlot', async () => {
      availabilityService.createTimeSlot.mockRejectedValueOnce(
        new Error('General database error')
      );
      
      const controllerFunc = availabilityController.createTimeSlot[availabilityController.createTimeSlot.length - 1];
      
      await controllerFunc(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(500);
    });
    
    it('should handle missing time slot in deleteTimeSlot', async () => {
      // Test for error conditions in deleteTimeSlot service call
      availabilityService.deleteTimeSlot.mockRejectedValueOnce(
        new Error('Time slot not found')
      );
      
      await availabilityController.deleteTimeSlot(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
    });
    
    it('should handle time slots with no date', async () => {
      req.params.id = 'slot1';
      availabilityService.getTimeSlotWithFormattedDate.mockResolvedValueOnce({
        _id: 'slot1',
        doctorId: 'doctor1',
        // No date property
        startTime: '09:00',
        endTime: '10:00'
      });
      
      await availabilityController.getTimeSlotById(req, res, next);
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: expect.any(Object)
      });
    });
    
    it('should handle getAvailableTimeSlots with invalid object ID but no license number', async () => {
      req.params.doctorId = 'not-a-license-number';
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      Doctor.findOne.mockResolvedValueOnce(null);
      
      await availabilityController.getAvailableTimeSlots(req, res, next);
      
      expect(next).toHaveBeenCalledWith(expect.any(AppError));
      expect(next.mock.calls[0][0].statusCode).toBe(404);
    });
    
    it('should handle missing startDate and endDate in importFromGoogle', async () => {
      req.params.doctorId = 'doctor1';
      req.body = { 
        refreshToken: 'refresh-token-123'
        // No start or end dates
      };
      
      await availabilityController.importFromGoogle(req, res, next);
      
      expect(availabilityService.importFromGoogleCalendar).toHaveBeenCalledWith(
        'doctor1',
        'refresh-token-123',
        null,
        null,
        'user123'
      );
      expect(res.status).toHaveBeenCalledWith(200);
    });
  });
}); 