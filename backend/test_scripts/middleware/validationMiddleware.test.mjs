import { check } from 'express-validator';
import validationMiddleware from '../../src/middleware/validation/validationMiddleware.mjs';
import { formatValidationErrors } from '../../src/utils/errorHandler.mjs';

// Mock dependencies
jest.mock('express-validator', () => {
  const originalModule = jest.requireActual('express-validator');
  
  return {
    ...originalModule,
    validationResult: jest.fn(),
    check: jest.fn().mockImplementation((field, message) => {
      return {
        not: jest.fn().mockReturnThis(),
        isEmpty: jest.fn().mockReturnThis(),
        trim: jest.fn().mockReturnThis(),
        isEmail: jest.fn().mockReturnThis(),
        normalizeEmail: jest.fn().mockReturnThis(),
        isLength: jest.fn().mockReturnThis(),
        matches: jest.fn().mockReturnThis(),
        isIn: jest.fn().mockReturnThis(),
        isArray: jest.fn().mockReturnThis(),
        notEmpty: jest.fn().mockReturnThis(),
        isNumeric: jest.fn().mockReturnThis(),
        isISO8601: jest.fn().mockReturnThis(),
        toDate: jest.fn().mockReturnThis(),
        optional: jest.fn().mockReturnThis(),
        isMongoId: jest.fn().mockReturnThis(),
        withMessage: jest.fn().mockReturnThis(),
        run: jest.fn().mockResolvedValue(undefined)
      };
    })
  };
});

jest.mock('../../src/utils/errorHandler.mjs', () => ({
  formatValidationErrors: jest.fn().mockReturnValue({
    success: false,
    errors: [{ param: 'test', msg: 'Test error' }]
  })
}));

describe('validationMiddleware', () => {
  let req;
  let res;
  let next;
  
  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Mock Express request, response and next function
    req = {
      body: {},
      params: {}
    };
    
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    
    next = jest.fn();
    
    // Mock validationResult default behavior (no errors)
    const { validationResult } = require('express-validator');
    validationResult.mockReturnValue({
      isEmpty: jest.fn().mockReturnValue(true),
      array: jest.fn().mockReturnValue([])
    });
  });

  describe('validate', () => {
    it('should call next() when there are no validation errors', async () => {
      const validations = [check('email')];
      
      const middleware = validationMiddleware.validate(validations);
      await middleware(req, res, next);
      
      expect(next).toHaveBeenCalled();
      expect(res.status).not.toHaveBeenCalled();
      expect(res.json).not.toHaveBeenCalled();
    });

    it('should return 400 with formatted errors when validation fails', async () => {
      const validations = [check('email')];
      
      // Mock validation errors
      const { validationResult } = require('express-validator');
      validationResult.mockReturnValue({
        isEmpty: jest.fn().mockReturnValue(false),
        array: jest.fn().mockReturnValue([{ param: 'email', msg: 'Invalid email' }])
      });
      
      const middleware = validationMiddleware.validate(validations);
      await middleware(req, res, next);
      
      expect(next).not.toHaveBeenCalled();
      expect(res.status).toHaveBeenCalledWith(400);
      expect(formatValidationErrors).toHaveBeenCalledWith([{ param: 'email', msg: 'Invalid email' }]);
      expect(res.json).toHaveBeenCalled();
    });
  });

  describe('rules', () => {
    it('should have user validation rules', () => {
      expect(validationMiddleware.rules.user).toBeDefined();
      expect(validationMiddleware.rules.user.firstName).toBeDefined();
      expect(validationMiddleware.rules.user.lastName).toBeDefined();
      expect(validationMiddleware.rules.user.email).toBeDefined();
      expect(validationMiddleware.rules.user.password).toBeDefined();
      expect(validationMiddleware.rules.user.phoneNumber).toBeDefined();
      expect(validationMiddleware.rules.user.role).toBeDefined();
    });

    it('should have patient validation rules', () => {
      expect(validationMiddleware.rules.patient).toBeDefined();
      expect(validationMiddleware.rules.patient.dateOfBirth).toBeDefined();
      expect(validationMiddleware.rules.patient.gender).toBeDefined();
    });

    it('should have doctor validation rules', () => {
      expect(validationMiddleware.rules.doctor).toBeDefined();
      expect(validationMiddleware.rules.doctor.specialties).toBeDefined();
      expect(validationMiddleware.rules.doctor.licenseNumber).toBeDefined();
      expect(validationMiddleware.rules.doctor.appointmentFee).toBeDefined();
    });

    it('should have staff validation rules', () => {
      expect(validationMiddleware.rules.staff).toBeDefined();
      expect(validationMiddleware.rules.staff.position).toBeDefined();
      expect(validationMiddleware.rules.staff.department).toBeDefined();
    });

    it('should have appointment validation rules', () => {
      expect(validationMiddleware.rules.appointment).toBeDefined();
      expect(validationMiddleware.rules.appointment.patientId).toBeDefined();
      expect(validationMiddleware.rules.appointment.doctorId).toBeDefined();
      expect(validationMiddleware.rules.appointment.timeSlotId).toBeDefined();
      expect(validationMiddleware.rules.appointment.reasonForVisit).toBeDefined();
      expect(validationMiddleware.rules.appointment.type).toBeDefined();
      expect(validationMiddleware.rules.appointment.status).toBeDefined();
    });

    it('should have time slot validation rules', () => {
      expect(validationMiddleware.rules.timeSlot).toBeDefined();
      expect(validationMiddleware.rules.timeSlot.date).toBeDefined();
      expect(validationMiddleware.rules.timeSlot.startTime).toBeDefined();
      expect(validationMiddleware.rules.timeSlot.endTime).toBeDefined();
    });

    it('should have ID parameter validation', () => {
      expect(validationMiddleware.rules.id).toBeDefined();
    });

    it('should have param validation factory', () => {
      expect(validationMiddleware.rules.param).toBeDefined();
      expect(typeof validationMiddleware.rules.param).toBe('function');
      
      const paramValidator = validationMiddleware.rules.param('userId');
      expect(paramValidator).toBeDefined();
    });
  });

  describe('chains', () => {
    it('should have registerUser validation chain', () => {
      expect(validationMiddleware.chains.registerUser).toBeDefined();
      expect(Array.isArray(validationMiddleware.chains.registerUser)).toBe(true);
      expect(validationMiddleware.chains.registerUser.length).toBeGreaterThan(0);
    });

    it('should have createPatient validation chain', () => {
      expect(validationMiddleware.chains.createPatient).toBeDefined();
      expect(Array.isArray(validationMiddleware.chains.createPatient)).toBe(true);
      expect(validationMiddleware.chains.createPatient.length).toBeGreaterThan(0);
    });

    it('should have createDoctor validation chain', () => {
      expect(validationMiddleware.chains.createDoctor).toBeDefined();
      expect(Array.isArray(validationMiddleware.chains.createDoctor)).toBe(true);
      expect(validationMiddleware.chains.createDoctor.length).toBeGreaterThan(0);
    });

    it('should have createAppointment validation chain', () => {
      expect(validationMiddleware.chains.createAppointment).toBeDefined();
      expect(Array.isArray(validationMiddleware.chains.createAppointment)).toBe(true);
      expect(validationMiddleware.chains.createAppointment.length).toBeGreaterThan(0);
    });

    it('should have login validation chain', () => {
      expect(validationMiddleware.chains.login).toBeDefined();
      expect(Array.isArray(validationMiddleware.chains.login)).toBe(true);
      expect(validationMiddleware.chains.login.length).toBeGreaterThan(0);
    });
  });
}); 