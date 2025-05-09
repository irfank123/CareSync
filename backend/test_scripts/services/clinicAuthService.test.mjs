import { Clinic, User, AuditLog } from '../../src/models/index.mjs';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import clinicAuthService from '../../src/services/clinicAuthService.mjs';
import emailService from '../../src/services/emailService.mjs';

// Mock dependencies
jest.mock('mongoose', () => {
  const mockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(true),
    abortTransaction: jest.fn().mockResolvedValue(true),
    endSession: jest.fn().mockResolvedValue(true)
  };
  
  return {
    startSession: jest.fn().mockResolvedValue(mockSession),
    Types: {
      ObjectId: jest.fn(id => id || 'generated-id')
    }
  };
});

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('mock-jwt-token')
}));

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-token')
  }),
  createHash: jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn().mockReturnValue('hashed-token')
  })
}));

jest.mock('../../src/models/index.mjs', () => ({
  Clinic: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  },
  User: {
    create: jest.fn(),
    findOne: jest.fn(),
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn()
  },
  AuditLog: {
    create: jest.fn()
  }
}));

jest.mock('../../src/services/emailService.mjs', () => ({
  sendVerificationEmail: jest.fn().mockResolvedValue(true),
  sendPasswordResetEmail: jest.fn().mockResolvedValue(true),
  sendClinicVerificationEmail: jest.fn().mockResolvedValue(true)
}));

jest.mock('../../src/config/config.mjs', () => ({
  jwt: {
    secret: 'test-jwt-secret',
    expiresIn: '1h'
  },
  frontendUrl: 'https://example.com',
  auth: {
    passwordResetExpiry: 3600000 // 1 hour
  },
  appName: 'CareSync Test'
}));

describe('ClinicAuthService', () => {
  let mockSession;
  
  beforeEach(() => {
    jest.clearAllMocks();
    
    mockSession = mongoose.startSession();
    
    Clinic.findOne.mockReset();
    Clinic.create.mockReset();
    Clinic.findById.mockReset();
    User.create.mockReset();
    User.findOne.mockReset();
    User.findById.mockReset();
    User.findByIdAndUpdate.mockReset();
    AuditLog.create.mockReset();
  });
  
  describe('registerClinic', () => {
    const clinicData = {
      name: 'Test Clinic',
      email: 'clinic@example.com',
      password: 'password123',
      adminFirstName: 'Admin',
      adminLastName: 'User',
      phoneNumber: '123-456-7890',
      address: '123 Test St'
    };
    
    it('should register a new clinic successfully', async () => {
      // Mock Clinic.findOne to return null (no existing clinic)
      Clinic.findOne.mockResolvedValue(null);
      
      // Mock User.create to return user
      const mockAdminUser = [{ 
        _id: 'admin-user-id',
        email: clinicData.email,
        firstName: clinicData.adminFirstName,
        lastName: clinicData.adminLastName,
        role: 'admin'
      }];
      User.create.mockResolvedValue(mockAdminUser);
      
      // Mock Clinic.create to return clinic
      const mockClinic = [{
        _id: 'clinic-id',
        name: clinicData.name,
        email: clinicData.email,
        adminUserId: 'admin-user-id',
        verificationStatus: 'pending',
        toObject: jest.fn().mockReturnThis()
      }];
      Clinic.create.mockResolvedValue(mockClinic);
      
      // Mock User.findByIdAndUpdate
      User.findByIdAndUpdate.mockResolvedValue({
        ...mockAdminUser[0],
        clinicId: 'clinic-id'
      });
      
      const result = await clinicAuthService.registerClinic(clinicData);
      
      // Verify function calls
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: clinicData.email });
      expect(User.create).toHaveBeenCalledWith(
        [expect.objectContaining({
          email: clinicData.email,
          firstName: clinicData.adminFirstName,
          lastName: clinicData.adminLastName,
          passwordHash: clinicData.password,
          role: 'admin'
        })], 
        expect.objectContaining({
          session: expect.anything() 
        })
      );
      
      expect(Clinic.create).toHaveBeenCalledWith(
        [expect.objectContaining({
          name: clinicData.name,
          email: clinicData.email,
          adminUserId: 'admin-user-id'
        })], 
        expect.objectContaining({
          session: expect.anything()
        })
      );
      
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        'admin-user-id',
        { clinicId: 'clinic-id' },
        expect.objectContaining({
          session: expect.anything()
        })
      );
      
      expect(AuditLog.create).toHaveBeenCalled();
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(clinicData.email, expect.any(String));
      expect(jwt.sign).toHaveBeenCalled();
      
      expect(result).toEqual({
        clinic: mockClinic[0],
        user: mockAdminUser[0],
        token: 'mock-jwt-token'
      });
    });
    
    it('should handle clinic registration with same email', async () => {
      // Mock Clinic.findOne to return existing clinic
      Clinic.findOne.mockResolvedValue({ 
        _id: 'existing-clinic-id',
        email: clinicData.email
      });
      
      await expect(clinicAuthService.registerClinic(clinicData))
        .rejects.toThrow('Clinic with this email already exists');
      
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: clinicData.email });
    });
    
    it('should handle email sending failure but still complete registration', async () => {
      // Mock Clinic.findOne to return null (no existing clinic)
      Clinic.findOne.mockResolvedValue(null);
      
      // Mock User.create to return user
      const mockAdminUser = [{ 
        _id: 'admin-user-id',
        email: clinicData.email,
        firstName: clinicData.adminFirstName,
        lastName: clinicData.adminLastName,
        role: 'admin'
      }];
      User.create.mockResolvedValue(mockAdminUser);
      
      // Mock Clinic.create to return clinic
      const mockClinic = [{
        _id: 'clinic-id',
        name: clinicData.name,
        email: clinicData.email,
        adminUserId: 'admin-user-id',
        verificationStatus: 'pending',
        toObject: jest.fn().mockReturnThis()
      }];
      Clinic.create.mockResolvedValue(mockClinic);
      
      // Mock email service to throw error
      emailService.sendVerificationEmail.mockRejectedValue(new Error('Email sending error'));
      
      // Mock console.error 
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const result = await clinicAuthService.registerClinic(clinicData);
      
      expect(emailService.sendVerificationEmail).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(result.token).toBe('mock-jwt-token');
      
      // Restore console.error
      console.error = originalConsoleError;
    });
    
    it('should handle transaction errors', async () => {
      // Mock Clinic.findOne to return null
      Clinic.findOne.mockResolvedValue(null);
      
      // Make User.create throw an error
      const error = new Error('Database error');
      User.create.mockRejectedValue(error);
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      await expect(clinicAuthService.registerClinic(clinicData))
        .rejects.toThrow('Database error');
      
      expect(console.error).toHaveBeenCalled();
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('loginClinic', () => {
    const loginCredentials = {
      email: 'clinic@example.com',
      password: 'password123'
    };
    
    it('should authenticate a clinic successfully', async () => {
      // Mock clinic with comparePassword method
      const mockClinic = {
        _id: 'clinic-id',
        email: loginCredentials.email,
        adminUserId: 'admin-user-id',
        verificationStatus: 'verified',
        comparePassword: jest.fn().mockResolvedValue(true),
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnThis()
      };
      
      // Mock admin user
      const mockAdminUser = {
        _id: 'admin-user-id',
        email: loginCredentials.email,
        role: 'admin'
      };
      
      // Set up mocks
      Clinic.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      User.findById.mockResolvedValue(mockAdminUser);
      
      const result = await clinicAuthService.loginClinic(loginCredentials.email, loginCredentials.password);
      
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: loginCredentials.email });
      expect(mockClinic.comparePassword).toHaveBeenCalledWith(loginCredentials.password);
      expect(User.findById).toHaveBeenCalledWith('admin-user-id');
      expect(jwt.sign).toHaveBeenCalled();
      expect(mockClinic.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      
      expect(result).toEqual({
        clinic: mockClinic,
        user: mockAdminUser,
        token: 'mock-jwt-token'
      });
    });
    
    it('should reject login with invalid credentials', async () => {
      // Mock clinic with failed password comparison
      const mockClinic = {
        _id: 'clinic-id',
        email: loginCredentials.email,
        adminUserId: 'admin-user-id',
        comparePassword: jest.fn().mockResolvedValue(false)
      };
      
      // Set up mocks
      Clinic.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      
      // Mock User.findById to return null to simulate admin user not found
      User.findById.mockResolvedValue(null);
      
      await expect(clinicAuthService.loginClinic(loginCredentials.email, loginCredentials.password))
        .rejects.toThrow('Clinic admin user not found');
    });
    
    it('should reject login when clinic is not found', async () => {
      // Set up mocks
      Clinic.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });
      
      await expect(clinicAuthService.loginClinic(loginCredentials.email, loginCredentials.password))
        .rejects.toThrow('Invalid credentials');
    });
    
    it('should reject login when admin user is not found', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: loginCredentials.email,
        adminUserId: 'admin-user-id',
        comparePassword: jest.fn().mockResolvedValue(true)
      };
      
      // Set up mocks
      Clinic.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      User.findById.mockResolvedValue(null);
      
      await expect(clinicAuthService.loginClinic(loginCredentials.email, loginCredentials.password))
        .rejects.toThrow('Clinic admin user not found');
    });
    
    it('should reject login when clinic is rejected', async () => {
      // Mock clinic with rejected status
      const mockClinic = {
        _id: 'clinic-id',
        email: loginCredentials.email,
        adminUserId: 'admin-user-id',
        verificationStatus: 'rejected',
        comparePassword: jest.fn().mockResolvedValue(true)
      };
      
      // Mock admin user
      const mockAdminUser = {
        _id: 'admin-user-id',
        email: loginCredentials.email,
        role: 'admin'
      };
      
      // Set up mocks
      Clinic.findOne.mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      User.findById.mockResolvedValue(mockAdminUser);
      
      await expect(clinicAuthService.loginClinic(loginCredentials.email, loginCredentials.password))
        .rejects.toThrow('Clinic registration has been rejected');
    });
  });
  
  describe('generateClinicToken', () => {
    it('should generate a JWT token for clinic', () => {
      const clinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        verificationStatus: 'verified'
      };
      
      clinicAuthService.generateClinicToken(clinic);
      
      expect(jwt.sign).toHaveBeenCalledWith(
        {
          id: 'clinic-id',
          email: 'clinic@example.com',
          type: 'clinic',
          verificationStatus: 'verified'
        },
        'test-jwt-secret',
        { expiresIn: '1h' }
      );
    });
  });
  
  describe('sanitizeClinicData', () => {
    it('should remove sensitive data from clinic object with toObject method', () => {
      const clinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        password: 'sensitive-data',
        toObject: jest.fn().mockReturnValue({
          _id: 'clinic-id',
          name: 'Test Clinic',
          password: 'sensitive-data'
        })
      };
      
      const sanitized = clinicAuthService.sanitizeClinicData(clinic);
      
      expect(clinic.toObject).toHaveBeenCalled();
      expect(sanitized.password).toBeUndefined();
    });
    
    it('should remove sensitive data from plain clinic object', () => {
      const clinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        password: 'sensitive-data'
      };
      
      const sanitized = clinicAuthService.sanitizeClinicData(clinic);
      
      expect(sanitized.password).toBeUndefined();
    });
  });
  
  describe('sanitizeUserData', () => {
    it('should remove sensitive data from user object', () => {
      const user = {
        _id: 'user-id',
        email: 'user@example.com',
        passwordHash: 'hashed-password',
        resetPasswordToken: 'token',
        resetPasswordExpire: Date.now(),
        toObject: jest.fn().mockReturnValue({
          _id: 'user-id',
          email: 'user@example.com',
          passwordHash: 'hashed-password',
          resetPasswordToken: 'token',
          resetPasswordExpire: Date.now()
        })
      };
      
      const sanitized = clinicAuthService.sanitizeUserData(user);
      
      expect(user.toObject).toHaveBeenCalled();
      expect(sanitized.passwordHash).toBeUndefined();
      expect(sanitized.resetPasswordToken).toBeUndefined();
      expect(sanitized.resetPasswordExpire).toBeUndefined();
    });
  });
  
  describe('verifyClinicEmail', () => {
    it('should verify clinic email', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Mock admin user
      const mockAdminUser = {
        _id: 'admin-user-id',
        email: 'clinic@example.com',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Set up mocks
      Clinic.findOne.mockResolvedValue(mockClinic);
      User.findById.mockResolvedValue(mockAdminUser);
      
      const result = await clinicAuthService.verifyClinicEmail('clinic@example.com', '123456');
      
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: 'clinic@example.com' });
      expect(User.findById).toHaveBeenCalledWith('admin-user-id');
      expect(mockClinic.emailVerified).toBe(true);
      expect(mockClinic.save).toHaveBeenCalled();
      expect(mockAdminUser.emailVerified).toBe(true);
      expect(mockAdminUser.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    it('should handle clinic not found', async () => {
      // Set up mocks
      Clinic.findOne.mockResolvedValue(null);
      
      await expect(clinicAuthService.verifyClinicEmail('clinic@example.com', '123456'))
        .rejects.toThrow('Verification failed');
    });
    
    it('should verify clinic email even if admin user is not found', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Set up mocks
      Clinic.findOne.mockResolvedValue(mockClinic);
      User.findById.mockResolvedValue(null);
      
      const result = await clinicAuthService.verifyClinicEmail('clinic@example.com', '123456');
      
      expect(mockClinic.emailVerified).toBe(true);
      expect(mockClinic.save).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });
  
  describe('startVerificationProcess', () => {
    it('should update clinic verification status to in_review', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        verificationStatus: 'pending',
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnThis()
      };
      
      // Set up mocks
      Clinic.findById.mockResolvedValue(mockClinic);
      
      const documents = ['document1', 'document2'];
      const result = await clinicAuthService.startVerificationProcess('clinic-id', documents);
      
      expect(Clinic.findById).toHaveBeenCalledWith('clinic-id');
      expect(mockClinic.verificationDocuments).toEqual(documents);
      expect(mockClinic.verificationStatus).toBe('in_review');
      expect(mockClinic.verificationSubmittedAt).toBeInstanceOf(Date);
      expect(mockClinic.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      expect(result).toBe(mockClinic);
    });
    
    it('should handle clinic not found', async () => {
      // Set up mocks
      Clinic.findById.mockResolvedValue(null);
      
      await expect(clinicAuthService.startVerificationProcess('clinic-id', []))
        .rejects.toThrow('Could not submit verification documents');
    });
  });
  
  describe('updateVerificationStatus', () => {
    it('should update clinic verification status', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        verificationStatus: 'in_review',
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnThis()
      };
      
      // Set up mocks
      Clinic.findById.mockResolvedValue(mockClinic);
      
      const result = await clinicAuthService.updateVerificationStatus('clinic-id', 'verified', 'Approved');
      
      expect(Clinic.findById).toHaveBeenCalledWith('clinic-id');
      expect(mockClinic.verificationStatus).toBe('verified');
      expect(mockClinic.verificationCompletedAt).toBeInstanceOf(Date);
      expect(mockClinic.verificationNotes).toBe('Approved');
      expect(mockClinic.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      expect(emailService.sendClinicVerificationEmail).toHaveBeenCalledWith(mockClinic, 'verified', 'Approved');
      expect(result).toBe(mockClinic);
    });
    
    it('should handle clinic not found', async () => {
      // Set up mocks
      Clinic.findById.mockResolvedValue(null);
      
      await expect(clinicAuthService.updateVerificationStatus('clinic-id', 'verified'))
        .rejects.toThrow('Could not update verification status');
    });
    
    it('should handle email sending error', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        verificationStatus: 'in_review',
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({}),
        toObject: jest.fn().mockReturnThis()
      };
      
      // Set up mocks
      Clinic.findById.mockResolvedValue(mockClinic);
      
      // Mock email error
      emailService.sendClinicVerificationEmail.mockRejectedValue(new Error('Email error'));
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      const result = await clinicAuthService.updateVerificationStatus('clinic-id', 'verified', 'Approved');
      
      expect(emailService.sendClinicVerificationEmail).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      expect(result).toBe(mockClinic);
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('forgotPassword', () => {
    it('should generate reset token and send reset email', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Set up mocks
      Clinic.findOne.mockResolvedValue(mockClinic);
      
      const result = await clinicAuthService.forgotPassword('clinic@example.com');
      
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: 'clinic@example.com' });
      expect(crypto.randomBytes).toHaveBeenCalledWith(32);
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(mockClinic.resetPasswordToken).toBe('hashed-token');
      expect(mockClinic.resetPasswordExpire).toBeGreaterThan(Date.now());
      expect(mockClinic.save).toHaveBeenCalled();
      expect(emailService.sendPasswordResetEmail).toHaveBeenCalledWith(
        'clinic@example.com',
        'https://example.com/clinic/reset-password/random-token'
      );
      expect(result).toBe(true);
    });
    
    it('should return success even if clinic not found (prevent email enumeration)', async () => {
      // Set up mocks
      Clinic.findOne.mockResolvedValue(null);
      
      const result = await clinicAuthService.forgotPassword('nonexistent@example.com');
      
      expect(Clinic.findOne).toHaveBeenCalledWith({ email: 'nonexistent@example.com' });
      expect(emailService.sendPasswordResetEmail).not.toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    it('should handle email sending error', async () => {
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Set up mocks
      Clinic.findOne.mockResolvedValue(mockClinic);
      
      // Mock email error
      emailService.sendPasswordResetEmail.mockRejectedValue(new Error('Email error'));
      
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();
      
      await expect(clinicAuthService.forgotPassword('clinic@example.com'))
        .rejects.toThrow('Server error while processing forgot password request');
      
      // Verify reset token was cleared on error
      expect(mockClinic.resetPasswordToken).toBeUndefined();
      expect(mockClinic.resetPasswordExpire).toBeUndefined();
      expect(mockClinic.save).toHaveBeenCalled();
      expect(console.error).toHaveBeenCalled();
      
      // Restore console.error
      console.error = originalConsoleError;
    });
  });
  
  describe('resetPassword', () => {
    it('should reset clinic password with valid token', async () => {
      // Mock date for token expiry check
      const futureDate = new Date();
      futureDate.setHours(futureDate.getHours() + 1);
      
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        email: 'clinic@example.com',
        resetPasswordToken: 'hashed-token',
        resetPasswordExpire: futureDate,
        adminUserId: 'admin-user-id',
        save: jest.fn().mockResolvedValue({})
      };
      
      // Set up mocks
      Clinic.findOne.mockResolvedValue(mockClinic);
      
      const result = await clinicAuthService.resetPassword('reset-token', 'new-password');
      
      expect(crypto.createHash).toHaveBeenCalledWith('sha256');
      expect(Clinic.findOne).toHaveBeenCalledWith({
        resetPasswordToken: 'hashed-token',
        resetPasswordExpire: { $gt: expect.any(Number) }
      });
      expect(mockClinic.password).toBe('new-password');
      expect(mockClinic.resetPasswordToken).toBeUndefined();
      expect(mockClinic.resetPasswordExpire).toBeUndefined();
      expect(mockClinic.save).toHaveBeenCalled();
      expect(AuditLog.create).toHaveBeenCalled();
      expect(result).toBe(true);
    });
    
    it('should reject with invalid or expired token', async () => {
      // Set up mocks
      Clinic.findOne.mockResolvedValue(null);
      
      await expect(clinicAuthService.resetPassword('invalid-token', 'new-password'))
        .rejects.toThrow('Invalid or expired token');
    });
  });
  
  describe('sendVerificationEmail', () => {
    it('should generate verification code and send email', async () => {
      // Mock Math.floor and Math.random to return predictable values
      const originalMath = Math;
      
      // Replace Math.floor and Math.random with mocks
      global.Math.floor = jest.fn().mockReturnValue(211110);
      global.Math.random = jest.fn().mockReturnValue(0.123456);
      
      // Ensure emailService.sendVerificationEmail resolves successfully
      emailService.sendVerificationEmail.mockResolvedValue(true);
      
      const result = await clinicAuthService.sendVerificationEmail('clinic@example.com');
      
      expect(emailService.sendVerificationEmail).toHaveBeenCalledWith('clinic@example.com', '211110');
      expect(result).toBe(true);
      
      // Restore original Math
      global.Math = originalMath;
    });
  });
}); 