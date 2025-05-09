import mongooseActual from 'mongoose'; // Keep for Types
import jwt from 'jsonwebtoken'; // Will be mocked
import bcrypt from 'bcryptjs'; // Will be mocked
import crypto from 'crypto'; // Will be mocked potentially
import loadAndValidateConfig from '../../src/config/config.mjs'; // Will be mocked
import { AppError } from '../../src/utils/errorHandler.mjs'; // Actual
import AuthService from '../../src/services/authService.mjs'; // Actual service class

// --- Mock Dependencies ---

// Mock Config
jest.mock('../../src/config/config.mjs', () => ({
  // Provide default mock config values
  auth: {
    jwtSecret: 'test-secret',
    jwtExpiresIn: '1h',
    refreshTokenSecret: 'test-refresh-secret',
    refreshTokenExpiresIn: '7d',
    passwordResetTokenExpiresIn: 3600000, // 1 hour in ms
  },
  security: {
    bcryptRounds: 10,
  },
  // Add other necessary mocked config properties
}));

// Mock jsonwebtoken
jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(),
  verify: jest.fn(), // Mock verify if needed for refresh/reset tokens later
}));

// Mock bcryptjs (Hoisting Fix)
jest.mock('bcryptjs', () => ({
  // Define the mocks inside the factory
  genSalt: jest.fn().mockResolvedValue('test-salt'),
  hash: jest.fn(), // Define mock function directly
  compare: jest.fn(), // Define mock function directly
}));

// Mock crypto (if needed for password reset or MFA later)
const mockRandomBytes = jest.fn();
const mockCreateHash = jest.fn().mockReturnValue({
    update: jest.fn().mockReturnThis(),
    digest: jest.fn(),
});
// Uncomment or adjust if crypto is used
// jest.mock('crypto', () => ({
//   ...jest.requireActual('crypto'),
//   randomBytes: mockRandomBytes,
//   createHash: mockCreateHash,
// }));

// Mock Mongoose Models and Session (Hoisting Fix)
jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');

  // --- Define Mocks INSIDE the factory ---
  const mockSessionObj = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn().mockResolvedValue(true),
    abortTransaction: jest.fn().mockResolvedValue(true),
    endSession: jest.fn(),
  };
  
  const modelMocks = {
    User: {
      findOne: jest.fn(),
      create: jest.fn(),
      findById: jest.fn(),
      startSession: jest.fn().mockResolvedValue(mockSessionObj),
      // Add save mock IF it's used as a static method (unlikely)
    },
    Doctor: { findOne: jest.fn(), create: jest.fn() },
    Patient: { findOne: jest.fn(), create: jest.fn() },
    Staff: { findOne: jest.fn(), create: jest.fn() },
    AuditLog: { create: jest.fn() },
    Clinic: { findOne: jest.fn() }, 
  };
  // --- End defining mocks inside ---

  return {
    ...originalMongoose,
    Types: originalMongoose.Types,
    Schema: originalMongoose.Schema,
    // Return the correct mock from the inner scope, or a generic object
    model: jest.fn((modelName) => {
      if (modelMocks[modelName]) {
        return modelMocks[modelName];
      }
      // Return generic object for indirectly imported models not explicitly mocked
      // This prevents MissingSchemaError during module loading
      // console.warn(`[Mongoose Mock] Unmocked model requested: ${modelName}. Returning {}.`);
      return {}; 
    }),
    models: modelMocks, 
  };
});

// Mock Email Service
const mockEmailService = {
  sendMfaEmail: jest.fn(),
  sendPasswordResetEmail: jest.fn(),
  // Add other methods if AuthService uses them
};

// --- Retrieve Mocks After Mocking --- 
// Need to import mongoose *after* the mock is defined
import mongoose from 'mongoose'; 
const userModelMock = mongoose.model('User');
const doctorModelMock = mongoose.model('Doctor');
const patientModelMock = mongoose.model('Patient');
const staffModelMock = mongoose.model('Staff');
const auditLogModelMock = mongoose.model('AuditLog');
const clinicModelMock = mongoose.model('Clinic');

// Import bcrypt *after* the mock is set up to get the mocked version
import bcryptMock from 'bcryptjs'; 

// Corrected and consolidated mock for config.mjs (default export)
jest.mock('../../src/config/config.mjs', () => {
  const mockLoadAndValidateConfig = jest.fn(() => ({
    NODE_ENV: 'test',
    PORT: '3001',
    jwt: {
      secret: 'test-secret',
      expiresIn: '1h',
      refreshTokenSecret: 'test-refresh-secret',
      refreshTokenExpiresIn: '7d',
      // Add cookieOptions if needed by authService directly
    },
    auth: {
      mfaTokenExpiry: 10 * 60 * 1000, // 10 minutes in ms
      passwordResetTokenExpiresIn: 3600000, // 1 hour in ms
      // Add other auth properties from original config if used by AuthService
      // e.g., clinicRestrictedRoutes, tokenBlacklistTTL, maxLoginAttempts, etc.
      // For now, only adding what seems directly related to current errors or typical auth flows.
    },
    security: {
      bcryptRounds: 10,
    },
    email: {
      service: 'test-service',
      host: 'test-host',
      port: '587',
      secure: false,
      auth: {
        user: 'test-user',
        pass: 'test-pass',
      },
      defaultFrom: '"Test App" <noreply@test.com>',
    }
    // Add other top-level config properties if needed by AuthService
  }));
  return {
    __esModule: true, 
    default: mockLoadAndValidateConfig
  };
});

// --- Test Suite ---
describe('AuthService', () => {
  let authService;
  let mockSession; // To hold the resolved mock session for assertions

  beforeEach(async () => {
    jest.clearAllMocks(); 

    mockSession = {
        startTransaction: jest.fn(),
        commitTransaction: jest.fn().mockResolvedValue(true),
        abortTransaction: jest.fn().mockResolvedValue(true),
        endSession: jest.fn().mockResolvedValue(true),
    };

    // Reset all methods on all mocked Mongoose models to a clean state
    Object.values(mongoose.models).forEach(mockModel => {
        if (mockModel && typeof mockModel === 'object') { // Check if mockModel is an object
            Object.keys(mockModel).forEach(key => { // Iterate over keys to get all methods
                if (jest.isMockFunction(mockModel[key])) {
                    mockModel[key].mockReset();
                }
            });
        }
    });

    // --- Set up specific default mock behaviors for the test suite AFTER generic reset ---
    
    // User model specific mocks
    if (userModelMock && userModelMock.startSession) { 
        userModelMock.startSession.mockResolvedValue(mockSession);
    }
    // Default create/findOne for User
    const mockDefaultUser = { _id: 'user-default', toObject: jest.fn(function() { return this; }) }; // Ensure toObject exists
    if (userModelMock && userModelMock.create) { userModelMock.create.mockResolvedValue([mockDefaultUser]); } 
    if (userModelMock && userModelMock.findOne) { 
        userModelMock.findOne.mockReturnValue({ 
            select: jest.fn().mockReturnThis(), 
            exec: jest.fn().mockResolvedValue(null) // Default findOne resolves to null
        });
    }

    // Clinic model specific mocks
    const mockClinicData = { _id: 'clinic-123', name: 'Test Clinic' };
    const mockClinicQuery = {
      session: jest.fn().mockReturnThis(),
      exec: jest.fn().mockResolvedValue(mockClinicData)
    };
    if (clinicModelMock && clinicModelMock.findOne) { 
        clinicModelMock.findOne.mockReturnValue(mockClinicQuery); // Default successful find for clinic
    }
    
    // Patient model default mocks
    const mockDefaultPatient = { _id: 'patient-default', toObject: jest.fn(function() { return this; }) }; // Ensure toObject exists
    if (patientModelMock && patientModelMock.create) { patientModelMock.create.mockResolvedValue([mockDefaultPatient]); }
    if (patientModelMock && patientModelMock.findOne) { patientModelMock.findOne.mockResolvedValue(null); }

    // Doctor model default mocks
    const mockDefaultDoctor = { _id: 'doctor-default', toObject: jest.fn(function() { return this; }) }; // Ensure toObject exists
    if (doctorModelMock && doctorModelMock.create) { doctorModelMock.create.mockResolvedValue([mockDefaultDoctor]); }
    // ... add other model default setups as needed (Staff, AuditLog)
    const mockDefaultStaff = { _id: 'staff-default', toObject: jest.fn(function() { return this; }) };
    if (mongoose.models.Staff && mongoose.models.Staff.create) { mongoose.models.Staff.create.mockResolvedValue([mockDefaultStaff]); }
    
    const mockDefaultAuditLog = { _id: 'audit-default', toObject: jest.fn(function() { return this; }) };
    if (auditLogModelMock && auditLogModelMock.create) { auditLogModelMock.create.mockResolvedValue([mockDefaultAuditLog]); } 

    // bcryptjs default mocks
    bcryptMock.hash.mockResolvedValue('hashed-password');
    bcryptMock.compare.mockResolvedValue(true); 
    
    // jsonwebtoken default mocks
    jwt.sign.mockReturnValue('test-jwt-token');

    // EmailService default mocks
    mockEmailService.sendMfaEmail.mockClear(); // Already clear from jest.clearAllMocks, but explicit is fine
    mockEmailService.sendPasswordResetEmail.mockClear();

    // Instantiate the service 
    authService = new AuthService(mockEmailService);
  });

  // --- Test Cases ---

  describe('registerUser', () => {
    const baseUserData = {
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        password: 'password123',
        // Role-specific fields added in tests
    };
    const clinicId = 'clinic-123';

    test('should register a patient successfully', async () => {
        const patientSpecificData = { gender: 'Other', dateOfBirth: new Date('1990-01-01') };
        const userData = { ...baseUserData, ...patientSpecificData };
        const mockCreatedUser = { 
            _id: 'user-p1', 
            ...baseUserData, 
            passwordHash: 'hashed-password', 
            role: 'patient',
            clinicId: undefined, // Patients aren't directly linked in this logic
            toObject: function() { return this; } // Add toObject if _sanitizeUserData uses it
        };
         const mockCreatedPatient = { 
            _id: 'patient-r1', 
            userId: 'user-p1', 
             ...patientSpecificData,
             toObject: function() { return this; } 
        };

        // Use the retrieved mocks
        userModelMock.create.mockResolvedValue([mockCreatedUser]);
        patientModelMock.create.mockResolvedValue([mockCreatedPatient]);

        const result = await authService.registerUser(userData, 'patient');

        expect(clinicModelMock.findOne).toHaveBeenCalled(); // Clinic check
        expect(bcryptMock.hash).toHaveBeenCalledWith(userData.password, 'test-salt');
        expect(userModelMock.create).toHaveBeenCalledWith(
            [expect.objectContaining({ 
                email: userData.email, 
                passwordHash: 'hashed-password', 
                role: 'patient',
                clinicId: undefined // Ensure clinicId is undefined for patient
            })], 
            { session: mockSession }
        );
         expect(patientModelMock.create).toHaveBeenCalledWith(
            [expect.objectContaining({ userId: 'user-p1', ...patientSpecificData })], 
            { session: mockSession }
        );
        expect(auditLogModelMock.create).toHaveBeenCalledWith(
            [expect.objectContaining({ userId: 'user-p1', action: 'register' })], 
            { session: mockSession }
        );
        expect(jwt.sign).toHaveBeenCalledWith(
            { id: 'user-p1', role: 'patient' }, // Check payload
            'test-secret', // Check secret
            { expiresIn: '1h' } // Check options
        );
        expect(mockSession.commitTransaction).toHaveBeenCalled();
        expect(mockSession.abortTransaction).not.toHaveBeenCalled();
        expect(result.user.passwordHash).toBeUndefined(); // Check sanitization
        expect(result.token).toBe('test-jwt-token');
         expect(result.roleSpecificRecord).toEqual(expect.objectContaining({ _id: 'patient-r1' }));
    });

    test('should handle database errors during registration', async () => {
        const dbError = new Error('Database unavailable');
        userModelMock.create.mockRejectedValue(dbError); // Use retrieved mock

        await expect(authService.registerUser(baseUserData, 'patient'))
            .rejects.toThrow(AppError); // Should wrap the error
         await expect(authService.registerUser(baseUserData, 'patient'))
             .rejects.toThrow('Database unavailable'); // Check underlying message

        expect(mockSession.abortTransaction).toHaveBeenCalled();
        expect(mockSession.commitTransaction).not.toHaveBeenCalled();
    });
  });

  describe('loginUser', () => {
     const email = 'login@example.com';
     const password = 'password123';
     const mockUser = {
        _id: 'user-login1',
        email: email,
        passwordHash: 'hashed-password', // Matches mockHash output
        role: 'patient',
        isActive: true,
        mfaEnabled: false,
        clinicId: undefined,
        lastLogin: null,
        save: jest.fn().mockResolvedValue(true), // Mock save method
        toObject: function() { return this; }
     };

    test('should login user successfully without MFA', async () => {
        // Use retrieved mocks
        userModelMock.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
        bcryptMock.compare.mockResolvedValue(true); 
        patientModelMock.findOne.mockResolvedValue({ _id: 'patient-login1', userId: 'user-login1' });

        const result = await authService.loginUser(email, password);

        expect(userModelMock.findOne).toHaveBeenCalledWith({ email: email });
        expect(bcryptMock.compare).toHaveBeenCalledWith(password, 'hashed-password');
        expect(mockUser.save).toHaveBeenCalled(); 
        expect(auditLogModelMock.create).toHaveBeenCalledWith(expect.objectContaining({ userId: 'user-login1', action: 'login' }));
        expect(jwt.sign).toHaveBeenCalledWith(
            { id: 'user-login1', role: 'patient' }, // No clinicId for patient
            'test-secret',
            { expiresIn: '1h' }
        );
        expect(result.requiresMfa).toBeUndefined();
        expect(result.token).toBe('test-jwt-token');
        expect(result.user.email).toBe(email);
        expect(result.user.passwordHash).toBeUndefined(); // Sanitized
    });

    test('should fail login if user not found', async () => {
         userModelMock.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(null) });

        await expect(authService.loginUser(email, password))
            .rejects.toThrow('Invalid credentials');
    });

    test('should fail login if password does not match', async () => {
        userModelMock.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mockUser) });
        bcryptMock.compare.mockResolvedValue(false); 

        await expect(authService.loginUser(email, password))
            .rejects.toThrow('Invalid credentials');
    });
    
     test('should fail login if user is not active', async () => {
         const inactiveUser = { ...mockUser, isActive: false, save: jest.fn().mockResolvedValue(true) }; // Mock save for inactive user too
         userModelMock.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(inactiveUser) });
         bcryptMock.compare.mockResolvedValue(true);

        await expect(authService.loginUser(email, password))
            .rejects.toThrow('Your account has been disabled. Please contact support.');
    });

     test('should trigger MFA flow if mfaEnabled is true', async () => {
         const mfaUser = { 
            ...mockUser, 
            mfaEnabled: true, 
             mfaMethod: 'email', // Assume email MFA for simplicity
            // Mock generateMfaCode if needed, or assume internal logic works
            save: jest.fn().mockResolvedValue(true) // Need save for lastLogin update if login proceeds this far before MFA check
        };
         userModelMock.findOne.mockReturnValue({ select: jest.fn().mockResolvedValue(mfaUser) });
         bcryptMock.compare.mockResolvedValue(true);
         
         // Mock the internal _generateMfaCode method if necessary, or its dependencies (like crypto)
         // For now, assume it works and triggers email sending

        const result = await authService.loginUser(email, password);

        expect(mockEmailService.sendMfaEmail).toHaveBeenCalledWith(email, expect.any(String)); // Check MFA email sent
        expect(result.requiresMfa).toBe(true);
        expect(result.token).toBeUndefined(); // No token yet
        expect(result.user.email).toBe(email);
    });

    // Add more tests for login (e.g., different roles, doctor with clinicId in token)
  });

  // Add describe blocks for forgotPassword, resetPassword, verifyMfa etc. later

}); 