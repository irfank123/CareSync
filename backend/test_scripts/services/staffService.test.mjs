import mongoose from 'mongoose';
// Use aliased imports for items that are mocked
import { Staff as MockedStaffModelAliased, User as MockedUserModelAliased, AuditLog as MockedAuditLogModelAliased } from '@src/models/index.mjs';
// Import the actual INSTANCE of the service to be tested
import serviceInstanceFromModule from '../../src/services/staffService.mjs';

// --- Define mock data instances. These are the objects our mocked model methods will return. ---
const mockStaffDataInstance = {
  _id: 'staff-123',
  userId: 'user-123',
  position: 'Receptionist',
  department: 'Front Desk',
  permissions: ['viewPatients', 'scheduleAppointments'],
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

const mockUserDataInstance = {
  _id: 'user-123',
  firstName: 'Jane',
  lastName: 'Smith',
  email: 'jane.smith@example.com',
  phoneNumber: '1234567890',
  isActive: true,
  role: 'user',
  clinicId: 'clinic-123',
  emailVerified: true,
  lastLogin: new Date(),
  profileImageUrl: 'https://example.com/profile.jpg',
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

const mockAuditLogDataInstance = {
  _id: 'auditlog-123',
  userId: 'user-123',
  action: 'create',
  resource: 'staff',
  resourceId: 'staff-123',
  details: {},
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

// --- Mock service dependencies (models, mongoose, AppError) ---
jest.mock('@src/models/index.mjs', () => {
  const mockModels = {};
  
  mockModels.Staff = jest.fn().mockImplementation(() => {
    mockStaffDataInstance.save.mockClear().mockResolvedValue(mockStaffDataInstance);
    return mockStaffDataInstance;
  });
  
  mockModels.Staff.create = jest.fn().mockImplementation(() => {
    mockStaffDataInstance.save.mockClear().mockResolvedValue(mockStaffDataInstance);
    return Promise.resolve([mockStaffDataInstance]);
  });
  
  mockModels.Staff.findById = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockStaffDataInstance);
  });
  
  mockModels.Staff.findOne = jest.fn().mockResolvedValue(null);
  
  mockModels.Staff.findByIdAndUpdate = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockStaffDataInstance);
  });
  
  mockModels.Staff.findByIdAndDelete = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockStaffDataInstance);
  });
  
  mockModels.Staff.aggregate = jest.fn().mockImplementation((pipeline) => {
    // If it's the count pipeline, return a count
    if (pipeline.some(stage => stage.$count === 'total')) {
      return Promise.resolve([{ total: 1 }]);
    }
    
    // If it's a match by _id
    if (pipeline.some(stage => stage.$match && stage.$match._id)) {
      return Promise.resolve([{ ...mockStaffDataInstance, user: mockUserDataInstance }]);
    }
    
    // If it's a match by userId
    if (pipeline.some(stage => stage.$match && stage.$match.userId)) {
      return Promise.resolve([{ ...mockStaffDataInstance, user: mockUserDataInstance }]);
    }
    
    // Default return for regular queries
    return Promise.resolve([
      { ...mockStaffDataInstance, user: mockUserDataInstance }
    ]);
  });

  mockModels.User = {
    findById: jest.fn().mockImplementation(() => {
      return Promise.resolve(mockUserDataInstance);
    }),
  };

  mockModels.AuditLog = {
    create: jest.fn().mockResolvedValue([{
      _id: 'auditlog-123',
      userId: 'user-123',
      action: 'create',
      resource: 'staff',
      resourceId: 'staff-123',
      details: {},
      toObject: jest.fn().mockReturnValue({ 
        _id: 'auditlog-123',
        userId: 'user-123',
        action: 'create',
        resource: 'staff',
        resourceId: 'staff-123',
        details: {}
      }),
    }]),
  };

  return mockModels;
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
    Types: { 
      ObjectId: function(id) { return id; }
    },
  };
  
  // Add isValid function to Types.ObjectId
  mongooseMock.Types.ObjectId.isValid = jest.fn().mockReturnValue(true);
  
  return {
    ...mongooseMock,
    default: mongooseMock,
  };
});

// --- Test Suite ---
describe('StaffService', () => {
  let staffServiceToTest;
  let currentMockSession;
  
  // Hold references to the mocked modules/constructors to clear them
  let MockedStaff, MockedUser, MockedAuditLog, mockedMongoose;

  beforeEach(async () => {
    jest.resetModules();

    // Re-import mocks and service instance AFTER resetModules
    mockedMongoose = (await import('mongoose')).default;
    const modelsModule = await import('@src/models/index.mjs');
    MockedStaff = modelsModule.Staff;
    MockedUser = modelsModule.User;
    MockedAuditLog = modelsModule.AuditLog;

    const serviceModule = await import('../../src/services/staffService.mjs');
    staffServiceToTest = serviceModule.default;
    
    currentMockSession = await mockedMongoose.startSession();
    
    // Configure behavior of the shared mock data instances for this specific test run
    mockStaffDataInstance.save.mockResolvedValue(mockStaffDataInstance);
    mockUserDataInstance.save.mockResolvedValue(mockUserDataInstance);
    mockStaffDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    mockUserDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    
    // Reset mocks
    MockedStaff.mockClear();
    if (MockedStaff.create) MockedStaff.create.mockClear();
    if (MockedStaff.findById) MockedStaff.findById.mockClear();
    if (MockedStaff.findOne) MockedStaff.findOne.mockClear();
    if (MockedStaff.findByIdAndUpdate) MockedStaff.findByIdAndUpdate.mockClear();
    if (MockedStaff.findByIdAndDelete) MockedStaff.findByIdAndDelete.mockClear();
    if (MockedStaff.aggregate) MockedStaff.aggregate.mockClear();
    
    MockedUser.findById.mockClear();
    MockedAuditLog.create.mockClear();
    
    mockedMongoose.startSession.mockClear();
    
    currentMockSession.startTransaction.mockClear();
    currentMockSession.commitTransaction.mockClear();
    currentMockSession.abortTransaction.mockClear();
    currentMockSession.endSession.mockClear();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllStaffMembers', () => {
    test('should return staff members with pagination', async () => {
      const options = {
        page: 1,
        limit: 10,
        sort: 'createdAt',
        order: 'desc'
      };

      const result = await staffServiceToTest.getAllStaffMembers(options);

      expect(MockedStaff.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        staff: [{ ...mockStaffDataInstance, user: mockUserDataInstance }],
        total: 1,
        totalPages: 1,
        currentPage: 1
      });
    });

    test('should include search parameters in aggregation pipeline', async () => {
      const options = {
        page: 1,
        limit: 10,
        search: 'receptionist',
        position: 'Receptionist',
        department: 'Front Desk',
        clinicId: 'clinic-123'
      };

      await staffServiceToTest.getAllStaffMembers(options);

      expect(MockedStaff.aggregate).toHaveBeenCalled();
      // Check the first aggregation call, which should be the main query (not the count)
      const firstCall = MockedStaff.aggregate.mock.calls[0][0];
      const matchStage = firstCall.find(stage => stage.$match);
      
      expect(matchStage).toBeDefined();
      expect(matchStage.$match.position).toBe('Receptionist');
      expect(matchStage.$match.department.$regex).toBe('Front Desk');
      expect(matchStage.$match['user.clinicId']).toBe('clinic-123');
    });
  });

  describe('getStaffById', () => {
    test('should return staff with user info by ID', async () => {
      const staffId = 'staff-123';
      
      const result = await staffServiceToTest.getStaffById(staffId);

      expect(MockedStaff.aggregate).toHaveBeenCalled();
      // Check that the match stage contains the staff ID
      const firstCall = MockedStaff.aggregate.mock.calls[0][0];
      const matchStage = firstCall.find(stage => stage.$match);
      expect(matchStage.$match._id).toBe(staffId);
      
      expect(result).toEqual({ ...mockStaffDataInstance, user: mockUserDataInstance });
    });

    test('should return null if staff not found', async () => {
      // Override the mock to return empty array
      MockedStaff.aggregate.mockResolvedValueOnce([]);
      
      const result = await staffServiceToTest.getStaffById('non-existent-id');

      expect(result).toBeNull();
    });

    test('should throw error if ID format is invalid', async () => {
      // Override isValid to return false for invalid ID
      mockedMongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      await expect(staffServiceToTest.getStaffById('invalid-id')).rejects.toThrow('Invalid ID format');
    });
  });

  describe('getStaffByUserId', () => {
    test('should return staff with user info by user ID', async () => {
      const userId = 'user-123';
      
      const result = await staffServiceToTest.getStaffByUserId(userId);

      expect(MockedStaff.aggregate).toHaveBeenCalled();
      // Check that the match stage contains the user ID
      const firstCall = MockedStaff.aggregate.mock.calls[0][0];
      const matchStage = firstCall.find(stage => stage.$match);
      expect(matchStage.$match.userId).toBe(userId);
      
      expect(result).toEqual({ ...mockStaffDataInstance, user: mockUserDataInstance });
    });

    test('should return null if staff not found', async () => {
      // Override the mock to return empty array
      MockedStaff.aggregate.mockResolvedValueOnce([]);
      
      const result = await staffServiceToTest.getStaffByUserId('non-existent-id');

      expect(result).toBeNull();
    });
  });

  describe('getStaffUserId', () => {
    test('should return user ID for a valid staff ID', async () => {
      MockedStaff.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ userId: 'user-123' })
      });

      const userId = await staffServiceToTest.getStaffUserId('staff-123');

      expect(MockedStaff.findById).toHaveBeenCalledWith('staff-123');
      expect(userId).toBe('user-123');
    });

    test('should return null if staff not found', async () => {
      MockedStaff.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(null)
      });

      const userId = await staffServiceToTest.getStaffUserId('non-existent-id');

      expect(MockedStaff.findById).toHaveBeenCalledWith('non-existent-id');
      expect(userId).toBeNull();
    });
  });

  describe('createStaff', () => {
    const staffData = {
      userId: 'user-123',
      position: 'Receptionist',
      department: 'Front Desk',
      permissions: ['viewPatients', 'scheduleAppointments']
    };

    test('should create a staff member and update user role', async () => {
      // Set up user mock to return a user with non-staff role
      MockedUser.findById.mockResolvedValueOnce({
        ...mockUserDataInstance,
        role: 'user',
        save: jest.fn().mockResolvedValue({ ...mockUserDataInstance, role: 'staff' })
      });

      // Override the getStaffById method to return mock data
      jest.spyOn(staffServiceToTest, 'getStaffById').mockResolvedValueOnce({
        ...mockStaffDataInstance,
        user: { ...mockUserDataInstance, role: 'staff' }
      });

      const result = await staffServiceToTest.createStaff(staffData);

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(MockedStaff.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(MockedStaff.create).toHaveBeenCalled();
      expect(MockedAuditLog.create).toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(currentMockSession.abortTransaction).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        ...mockStaffDataInstance,
        user: { ...mockUserDataInstance, role: 'staff' }
      });
    });

    test('should throw error if user does not exist', async () => {
      MockedUser.findById.mockResolvedValueOnce(null);

      await expect(staffServiceToTest.createStaff(staffData)).rejects.toThrow('User not found');

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(MockedStaff.create).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
    });

    test('should throw error if user is already a staff member', async () => {
      MockedStaff.findOne.mockResolvedValueOnce(mockStaffDataInstance);

      await expect(staffServiceToTest.createStaff(staffData)).rejects.toThrow('User is already a staff member');

      expect(MockedStaff.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(MockedStaff.create).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateStaff', () => {
    const updateData = {
      position: 'Senior Receptionist',
      department: 'Administration'
    };

    test('should update staff member and create audit log', async () => {
      // Mock the getStaffById method
      jest.spyOn(staffServiceToTest, 'getStaffById').mockResolvedValueOnce({
        ...mockStaffDataInstance,
        ...updateData,
        user: mockUserDataInstance
      });

      const result = await staffServiceToTest.updateStaff('staff-123', updateData);

      expect(MockedStaff.findById).toHaveBeenCalledWith('staff-123');
      expect(MockedStaff.findByIdAndUpdate).toHaveBeenCalledWith(
        'staff-123',
        { $set: updateData },
        { new: true, runValidators: true }
      );
      expect(MockedAuditLog.create).toHaveBeenCalled();
      
      expect(result).toEqual({
        ...mockStaffDataInstance,
        ...updateData,
        user: mockUserDataInstance
      });
    });

    test('should return null if staff member not found', async () => {
      MockedStaff.findById.mockResolvedValueOnce(null);

      const result = await staffServiceToTest.updateStaff('non-existent-id', updateData);

      expect(MockedStaff.findById).toHaveBeenCalledWith('non-existent-id');
      expect(MockedStaff.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(MockedAuditLog.create).not.toHaveBeenCalled();
      
      expect(result).toBeNull();
    });
  });

  describe('updateStaffByUserId', () => {
    const updateData = {
      position: 'Senior Receptionist',
      department: 'Administration'
    };

    test('should update staff member by user ID and create audit log', async () => {
      // Mock findOne to return a staff member
      MockedStaff.findOne.mockResolvedValueOnce(mockStaffDataInstance);
      
      // Mock the getStaffByUserId method
      jest.spyOn(staffServiceToTest, 'getStaffByUserId').mockResolvedValueOnce({
        ...mockStaffDataInstance,
        ...updateData,
        user: mockUserDataInstance
      });

      const result = await staffServiceToTest.updateStaffByUserId('user-123', updateData);

      expect(MockedStaff.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(MockedStaff.findByIdAndUpdate).toHaveBeenCalledWith(
        'staff-123',
        { $set: updateData },
        { new: true, runValidators: true }
      );
      expect(MockedAuditLog.create).toHaveBeenCalled();
      
      expect(result).toEqual({
        ...mockStaffDataInstance,
        ...updateData,
        user: mockUserDataInstance
      });
    });

    test('should return null if staff member not found', async () => {
      MockedStaff.findOne.mockResolvedValueOnce(null);

      const result = await staffServiceToTest.updateStaffByUserId('non-existent-id', updateData);

      expect(MockedStaff.findOne).toHaveBeenCalledWith({ userId: 'non-existent-id' });
      expect(MockedStaff.findByIdAndUpdate).not.toHaveBeenCalled();
      expect(MockedAuditLog.create).not.toHaveBeenCalled();
      
      expect(result).toBeNull();
    });
  });

  describe('deleteStaff', () => {
    test('should delete staff member and create audit log', async () => {
      const result = await staffServiceToTest.deleteStaff('staff-123');

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedStaff.findById).toHaveBeenCalledWith('staff-123');
      expect(MockedStaff.findByIdAndDelete).toHaveBeenCalledWith('staff-123', { session: currentMockSession });
      expect(MockedAuditLog.create).toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      
      expect(result).toBe(true);
    });

    test('should throw error if staff member not found', async () => {
      MockedStaff.findById.mockResolvedValueOnce(null);

      await expect(staffServiceToTest.deleteStaff('non-existent-id')).rejects.toThrow('Staff member not found');

      expect(MockedStaff.findById).toHaveBeenCalledWith('non-existent-id');
      expect(MockedStaff.findByIdAndDelete).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
    });

    test('should throw error if ID format is invalid', async () => {
      // Override isValid to return false for invalid ID
      mockedMongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);
      
      await expect(staffServiceToTest.deleteStaff('invalid-id')).rejects.toThrow('Invalid staff ID format');
      
      expect(MockedStaff.findById).not.toHaveBeenCalled();
      expect(MockedStaff.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
}); 