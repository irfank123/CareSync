import { validateObjectId, validateEmail, validateRequired } from '@src/utils/validation.mjs';
import mongoose from 'mongoose';

// Mock mongoose.Types.ObjectId.isValid
// We need to mock it before any describe/test blocks that use it.
jest.mock('mongoose', () => ({
  ...jest.requireActual('mongoose'), // Import and retain default behavior
  Types: {
    ...jest.requireActual('mongoose').Types,
    ObjectId: {
      ...jest.requireActual('mongoose').Types.ObjectId,
      isValid: jest.fn() // Mock only the isValid function
    }
  }
}));

describe('Validation Utilities', () => {
  describe('validateObjectId', () => {
    beforeEach(() => {
      // Reset the mock before each test if necessary, though for simple true/false it might not be.
      // mongoose.Types.ObjectId.isValid.mockClear(); // Or mockReset() if it was more complex
    });

    test('should return true for a valid ObjectId string', () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(true);
      expect(validateObjectId('507f1f77bcf86cd799439011')).toBe(true);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('507f1f77bcf86cd799439011');
    });

    test('should return false for an invalid ObjectId string', () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      expect(validateObjectId('invalid-id')).toBe(false);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('invalid-id');
    });

    test('should return false for an empty string', () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      expect(validateObjectId('')).toBe(false);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith('');
    });

    test('should return false for null or undefined', () => {
      mongoose.Types.ObjectId.isValid.mockReturnValue(false);
      expect(validateObjectId(null)).toBe(false);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(null);
      expect(validateObjectId(undefined)).toBe(false);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(undefined);
    });
  });

  describe('validateEmail', () => {
    test('should return true for valid email addresses', () => {
      expect(validateEmail('test@example.com')).toBe(true);
      expect(validateEmail('test.name@example.co.uk')).toBe(true);
      expect(validateEmail('test+alias@example.com')).toBe(true);
      expect(validateEmail('test@sub.example.com')).toBe(true);
    });

    test('should return false for invalid email addresses', () => {
      expect(validateEmail('test@')).toBe(false);
      expect(validateEmail('test@example')).toBe(false);
      expect(validateEmail('test.example.com')).toBe(false);
      expect(validateEmail('@example.com')).toBe(false);
      expect(validateEmail('plainaddress')).toBe(false);
      expect(validateEmail('')).toBe(false);
    });

    test('should handle email addresses with different cases (due to toLowerCase)', () => {
      expect(validateEmail('TEST@EXAMPLE.COM')).toBe(true);
    });

    test('should return false for null or undefined', () => {
      expect(validateEmail(null)).toBe(false);
      expect(validateEmail(undefined)).toBe(false);
    });
  });

  describe('validateRequired', () => {
    test('should return true for non-empty strings', () => {
      expect(validateRequired('test')).toBe(true);
      expect(validateRequired('  test  ')).toBe(true);
      expect(validateRequired('0')).toBe(true);
    });

    test('should return false for empty strings or strings with only whitespace', () => {
      expect(validateRequired('')).toBe(false);
      expect(validateRequired('   ')).toBe(false);
    });

    test('should return false for null or undefined', () => {
      expect(validateRequired(null)).toBe(false);
      expect(validateRequired(undefined)).toBe(false);
    });
  });
}); 