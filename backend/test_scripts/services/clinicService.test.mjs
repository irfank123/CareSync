import mongoose from 'mongoose';
// Use aliased imports for items that are mocked
import { Clinic as MockedClinicModelAliased, User as MockedUserModelAliased } from '@src/models/index.mjs';
// Import the actual INSTANCE of the service to be tested
// Note: Its dependencies (models, mongoose, AppError) will be mocked by jest.mock calls below.
import serviceInstanceFromModule from '../../src/services/clinicService.mjs';

// --- Define mock data instances. These are the objects our mocked model methods will return. ---
const mockClinicDataInstance = {
  _id: 'clinic-123',
  adminUserId: 'user-admin-123',
  verificationStatus: 'pending',
  name: 'Test Clinic',
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }), 
  save: jest.fn(), 
};
const mockUserDataInstance = {
  _id: 'user-admin-123',
  clinicId: null,
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }), 
  save: jest.fn(), 
  session: jest.fn().mockReturnThis(),
};

// --- Mock service dependencies (models, mongoose, AppError) ---
// These mocks will be used by the imported serviceInstanceFromModule.
jest.mock('@src/models/index.mjs', () => {
  const ClinicMock = jest.fn().mockImplementation(() => {
    mockClinicDataInstance.save.mockClear().mockResolvedValue(mockClinicDataInstance);
    return mockClinicDataInstance;
  });
  ClinicMock.create = jest.fn().mockImplementation(() => {
    mockClinicDataInstance.save.mockClear().mockResolvedValue(mockClinicDataInstance);
    return Promise.resolve([mockClinicDataInstance]); 
  });

  const UserMock = {
    findByIdAndUpdate: jest.fn().mockImplementation(() => {
      mockUserDataInstance.save.mockClear().mockResolvedValue(mockUserDataInstance);
      return Promise.resolve(mockUserDataInstance);
    }),
    findById: jest.fn().mockImplementation(() => ({
      session: jest.fn().mockImplementation(() => {
        mockUserDataInstance.save.mockClear().mockResolvedValue(mockUserDataInstance);
        return Promise.resolve(mockUserDataInstance);
      })
    })),
    create: jest.fn().mockImplementation(() => { 
      mockUserDataInstance.save.mockClear().mockResolvedValue(mockUserDataInstance);
      return Promise.resolve(mockUserDataInstance);
    }),
  };
  return { Clinic: ClinicMock, User: UserMock };
});

jest.mock('mongoose', () => {
  const anInternalMockSession = {
    startTransaction: jest.fn(),
    commitTransaction: jest.fn(),
    abortTransaction: jest.fn(),
    endSession: jest.fn(),
  };
  const mongooseMock = {
    startSession: jest.fn().mockResolvedValue(anInternalMockSession),
    Types: { ObjectId: jest.fn(id => id) },
  };
  // Also mock the default export if the service uses `import mongoose from 'mongoose';` and `mongoose.startSession()`
  return {
    ...mongooseMock, // Spread to handle named exports like Types
    default: mongooseMock, // Handle default import
  };
});

jest.mock('@src/utils/errorHandler.mjs', () => {
  // Define the mock class INSIDE the factory to avoid hoisting issues.
  class MockAppErrorForTest extends Error { 
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      this.name = 'AppError';
    }
  }
  return { AppError: MockAppErrorForTest }; 
});

// --- Test Suite ---
describe('ClinicService', () => {
  let clinicServiceToTest; // This will hold the imported service instance
  let currentMockSession; // To interact with the session used by the service

  // Hold references to the mocked modules/constructors to clear them
  let MockedClinic, MockedUser, MockAppError, mockedMongoose;

  beforeEach(async () => {
    jest.resetModules(); // Resets module cache, service will re-import with fresh mocks

    // Re-import mocks and service instance AFTER resetModules
    // This ensures that `serviceInstanceFromModule` gets the newly-mocked dependencies.
    mockedMongoose = (await import('mongoose')).default; // Get the default export of the mock
    const modelsModule = await import('@src/models/index.mjs');
    MockedClinic = modelsModule.Clinic;
    MockedUser = modelsModule.User;
    const errorHandlerModule = await import('@src/utils/errorHandler.mjs');
    MockAppError = errorHandlerModule.AppError; // This is the MockAppErrorForTest class defined in the factory

    const serviceModule = await import('../../src/services/clinicService.mjs');
    clinicServiceToTest = serviceModule.default; // Assign the actual instance from the module
    
    currentMockSession = await mockedMongoose.startSession();
    
    // Configure behavior of the shared mock data instances for this specific test run
    mockClinicDataInstance.save.mockResolvedValue(mockClinicDataInstance);
    mockUserDataInstance.save.mockResolvedValue(mockUserDataInstance);
    mockClinicDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    mockUserDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    mockUserDataInstance.clinicId = null; // Reset state for each test

    // Clear call history for the main mock functions/constructors
    MockedClinic.mockClear();
    if (MockedClinic.create) MockedClinic.create.mockClear();
    MockedUser.findByIdAndUpdate.mockClear();
    MockedUser.findById.mockClear();
    if (MockedUser.create) MockedUser.create.mockClear();
    // MockAppError is the class, no .mockClear()

    mockedMongoose.startSession.mockClear();
    
    currentMockSession.startTransaction.mockClear();
    currentMockSession.commitTransaction.mockClear();
    currentMockSession.abortTransaction.mockClear();
    currentMockSession.endSession.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks(); // General cleanup of all mock states
  });

  describe('createClinicAndLinkAdmin', () => {
    const userId = 'user-admin-123';
    const clinicData = { name: 'Admin Clinic', address: '123 Admin St' };

    test('should create clinic, update user, commit transaction, and return data on success', async () => {
      MockedUser.findByIdAndUpdate.mockResolvedValueOnce({ 
        ...mockUserDataInstance, 
        clinicId: mockClinicDataInstance._id, 
        toObject: () => ({...mockUserDataInstance, clinicId: mockClinicDataInstance._id }) 
      });
      
      const result = await clinicServiceToTest.createClinicAndLinkAdmin(userId, clinicData);

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1); 
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedClinic).toHaveBeenCalledWith(expect.objectContaining({
        ...clinicData,
        adminUserId: userId,
        verificationStatus: 'pending',
      }));
      expect(mockClinicDataInstance.save).toHaveBeenCalledWith({ session: currentMockSession });
      expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { $set: { clinicId: mockClinicDataInstance._id } },
        { new: true, session: currentMockSession }
      );
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(currentMockSession.abortTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);

      expect(result.clinic).toBeDefined();
      expect(result.user).toBeDefined();
      expect(result.clinic._id).toBe(mockClinicDataInstance._id);
      expect(result.user.clinicId).toBe(mockClinicDataInstance._id);
    });

    test('should abort transaction and throw if Clinic.save fails', async () => {
      const saveError = new Error('DB save failed');
      mockClinicDataInstance.save.mockRejectedValueOnce(saveError);

      await expect(clinicServiceToTest.createClinicAndLinkAdmin(userId, clinicData)).rejects.toThrow(
        saveError.message
      );

      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockClinicDataInstance.save).toHaveBeenCalledTimes(1);
      expect(MockedUser.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });
    
    test('should abort transaction and throw if User.findByIdAndUpdate fails', async () => {
      const updateError = new Error('User update failed');
      MockedUser.findByIdAndUpdate.mockRejectedValueOnce(updateError);

      await expect(clinicServiceToTest.createClinicAndLinkAdmin(userId, clinicData)).rejects.toThrow(
        updateError.message
      );
      
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(mockClinicDataInstance.save).toHaveBeenCalledTimes(1); 
      expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
      expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });
    
    test('should abort transaction and throw if User.findByIdAndUpdate returns null', async () => {
        MockedUser.findByIdAndUpdate.mockResolvedValueOnce(null);

        await expect(clinicServiceToTest.createClinicAndLinkAdmin(userId, clinicData)).rejects.toThrow(
            'Failed to find or update the user record.'
        );
        
        expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
        expect(mockClinicDataInstance.save).toHaveBeenCalledTimes(1);
        expect(MockedUser.findByIdAndUpdate).toHaveBeenCalledTimes(1);
        expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
        expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });

  describe('createClinicAndLinkUser', () => {
    const userId = 'user-normal-456';
    const clinicData = { name: 'User Clinic', address: '456 User Ave' };
    let localMockUserDataInstance; // Specific user instance for this describe block

    beforeEach(() => { // Note: this beforeEach is nested and runs AFTER the outer beforeEach
        localMockUserDataInstance = { 
            ...mockUserDataInstance, 
            _id: userId, 
            clinicId: null, 
            save: jest.fn().mockImplementation(function() { 
                this.clinicId = 'clinic-789'; 
                return Promise.resolve(this); 
            }),
        };
        // Override User.findById for these specific tests to use localMockUserDataInstance
        MockedUser.findById.mockReturnValue({ 
            session: jest.fn().mockResolvedValue(localMockUserDataInstance)
        });
        // Override Clinic.create for these specific tests
        MockedClinic.create.mockResolvedValue([{...mockClinicDataInstance, _id: 'clinic-789'}]); 
    });

    test('should find user, create clinic, update user, commit, and return data on success', async () => {
        const result = await clinicServiceToTest.createClinicAndLinkUser(userId, clinicData);

        expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
        expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
        
        expect(MockedUser.findById).toHaveBeenCalledWith(userId);
        expect(MockedUser.findById(userId).session).toHaveBeenCalledWith(currentMockSession);

        expect(MockedClinic.create).toHaveBeenCalledWith([expect.objectContaining({
            ...clinicData,
            adminUserId: userId, 
            verificationStatus: 'pending'
        })], { session: currentMockSession });
        
        expect(localMockUserDataInstance.save).toHaveBeenCalledWith({ session: currentMockSession });
        expect(localMockUserDataInstance.clinicId).toBe('clinic-789'); 
        
        expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.abortTransaction).not.toHaveBeenCalled();
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);

        expect(result.clinic).toBeDefined();
        expect(result.user).toBeDefined();
        expect(result.clinic._id).toBe('clinic-789');
        expect(result.user._id).toBe(userId);
        expect(result.user.clinicId).toBe('clinic-789'); 
    });

    test('should throw AppError if user not found', async () => {
        MockedUser.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(null)
        });
        // Service throws `new AppError('User not found', 404)`. `instanceof` check should pass.
        await expect(clinicServiceToTest.createClinicAndLinkUser(userId, clinicData)).rejects.toThrow(
            expect.objectContaining({ name: 'AppError', statusCode: 404, message: 'User not found' })
        );
        expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test('should throw AppError if user is already associated with a clinic', async () => {
        localMockUserDataInstance.clinicId = 'existing-clinic-id'; 
        MockedUser.findById.mockReturnValue({
            session: jest.fn().mockResolvedValue(localMockUserDataInstance)
        });
        // Service throws `new AppError('User is already associated with a clinic', 400)`. `instanceof` check should pass.
        await expect(clinicServiceToTest.createClinicAndLinkUser(userId, clinicData)).rejects.toThrow(
            expect.objectContaining({ name: 'AppError', statusCode: 400, message: 'User is already associated with a clinic' })
        );
        expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test('should abort transaction and throw AppError if Clinic.create fails', async () => {
        const createError = new Error('Clinic creation failed');
        MockedClinic.create.mockRejectedValueOnce(createError);
        // Generic error from mock. `instanceof AppError` fails. Service re-wraps.
        // Assuming service re-wraps with: 'Failed to update user record: ' + originalMessage
        await expect(clinicServiceToTest.createClinicAndLinkUser(userId, clinicData)).rejects.toThrow(
            expect.objectContaining({ name: 'AppError', statusCode: 500, message: 'Failed to update user record: Clinic creation failed' })
        );
        expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });

    test('should abort transaction and throw AppError if user.save fails', async () => {
        const saveError = new Error('User save failed');
        localMockUserDataInstance.save.mockRejectedValueOnce(saveError); 
        // Generic error from mock. `instanceof AppError` fails. Service re-wraps.
        // Assuming service re-wraps with: 'Failed to update user record: ' + originalMessage
        await expect(clinicServiceToTest.createClinicAndLinkUser(userId, clinicData)).rejects.toThrow(
            expect.objectContaining({ name: 'AppError', statusCode: 500, message: 'Failed to update user record: User save failed' })
        );
        expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
        expect(currentMockSession.endSession).toHaveBeenCalledTimes(1);
    });
  });
}); 