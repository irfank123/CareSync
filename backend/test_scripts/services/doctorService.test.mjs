import mongoose from 'mongoose';
// Use aliased imports for items that are mocked
import { Doctor as MockedDoctorModelAliased, User as MockedUserModelAliased, TimeSlot as MockedTimeSlotModelAliased, AuditLog as MockedAuditLogModelAliased } from '@src/models/index.mjs';
// Import the actual INSTANCE of the service to be tested
import serviceInstanceFromModule from '../../src/services/doctorService.mjs';

// --- Define mock data instances. These are the objects our mocked model methods will return. ---
const mockDoctorDataInstance = {
  _id: 'doctor-123',
  userId: 'user-123',
  specialties: ['Cardiology', 'Internal Medicine'],
  licenseNumber: 'LIC12345',
  deaNumber: 'DEA67890',
  education: [{ institution: 'Medical University', degree: 'MD', year: 2015 }],
  availabilitySchedule: [],
  vacationDays: [],
  maxAppointmentsPerDay: 20,
  appointmentDuration: 30,
  acceptingNewPatients: true,
  appointmentFee: 100,
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

const mockUserDataInstance = {
  _id: 'user-123',
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
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

const mockTimeSlotDataInstance = {
  _id: 'timeslot-123',
  doctorId: 'doctor-123',
  date: new Date(),
  startTime: '09:00',
  endTime: '09:30',
  status: 'available',
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

const mockAuditLogDataInstance = {
  _id: 'auditlog-123',
  userId: 'user-admin-123',
  action: 'create',
  resource: 'doctor',
  resourceId: 'doctor-123',
  details: {},
  toObject: jest.fn(function() { return { ...this, _id: this._id }; }),
  save: jest.fn(),
};

// --- Mock service dependencies (models, mongoose, AppError) ---
jest.mock('@src/models/index.mjs', () => {
  const mockModels = {};
  
  mockModels.Doctor = jest.fn().mockImplementation(() => {
    mockDoctorDataInstance.save.mockClear().mockResolvedValue(mockDoctorDataInstance);
    return mockDoctorDataInstance;
  });
  
  mockModels.Doctor.create = jest.fn().mockImplementation(() => {
    mockDoctorDataInstance.save.mockClear().mockResolvedValue(mockDoctorDataInstance);
    return Promise.resolve([mockDoctorDataInstance]);
  });
  
  mockModels.Doctor.findById = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockDoctorDataInstance);
  });
  
  mockModels.Doctor.findOne = jest.fn().mockResolvedValue(null);
  
  mockModels.Doctor.findByIdAndDelete = jest.fn().mockImplementation(() => {
    return Promise.resolve(mockDoctorDataInstance);
  });
  
  mockModels.Doctor.aggregate = jest.fn().mockImplementation(() => {
    return Promise.resolve([{
      data: [{ ...mockDoctorDataInstance, user: mockUserDataInstance }],
      count: [{ total: 1 }]
    }]);
  });

  mockModels.User = {
    findById: jest.fn().mockImplementation(() => {
      return Promise.resolve(mockUserDataInstance);
    }),
  };

  mockModels.TimeSlot = {
    deleteMany: jest.fn().mockResolvedValue({ deletedCount: 5 }),
    find: jest.fn().mockImplementation(() => {
      return {
        sort: jest.fn().mockResolvedValue([mockTimeSlotDataInstance])
      };
    }),
  };

  mockModels.AuditLog = {
    create: jest.fn().mockResolvedValue([{
      _id: 'auditlog-123',
      userId: 'user-admin-123',
      action: 'create',
      resource: 'doctor',
      resourceId: 'doctor-123',
      details: {},
      toObject: jest.fn().mockReturnValue({ 
        _id: 'auditlog-123',
        userId: 'user-admin-123',
        action: 'create',
        resource: 'doctor',
        resourceId: 'doctor-123',
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

jest.mock('@src/utils/errorHandler.mjs', () => {
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
describe('DoctorService', () => {
  let doctorServiceToTest;
  let currentMockSession;
  
  // Hold references to the mocked modules/constructors to clear them
  let MockedDoctor, MockedUser, MockedTimeSlot, MockedAuditLog, MockAppError, mockedMongoose;

  beforeEach(async () => {
    jest.resetModules();

    // Re-import mocks and service instance AFTER resetModules
    mockedMongoose = (await import('mongoose')).default;
    const modelsModule = await import('@src/models/index.mjs');
    MockedDoctor = modelsModule.Doctor;
    MockedUser = modelsModule.User;
    MockedTimeSlot = modelsModule.TimeSlot;
    MockedAuditLog = modelsModule.AuditLog;
    const errorHandlerModule = await import('@src/utils/errorHandler.mjs');
    MockAppError = errorHandlerModule.AppError;

    const serviceModule = await import('../../src/services/doctorService.mjs');
    doctorServiceToTest = serviceModule.default;
    
    currentMockSession = await mockedMongoose.startSession();
    
    // Configure behavior of the shared mock data instances for this specific test run
    mockDoctorDataInstance.save.mockResolvedValue(mockDoctorDataInstance);
    mockUserDataInstance.save.mockResolvedValue(mockUserDataInstance);
    mockDoctorDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    mockUserDataInstance.toObject.mockClear().mockImplementation(function() { return { ...this, _id: this._id }; });
    
    // Reset mocks
    MockedDoctor.mockClear();
    if (MockedDoctor.create) MockedDoctor.create.mockClear();
    if (MockedDoctor.findById) MockedDoctor.findById.mockClear();
    if (MockedDoctor.findOne) MockedDoctor.findOne.mockClear();
    if (MockedDoctor.findByIdAndDelete) MockedDoctor.findByIdAndDelete.mockClear();
    if (MockedDoctor.aggregate) MockedDoctor.aggregate.mockClear();
    
    MockedUser.findById.mockClear();
    MockedTimeSlot.deleteMany.mockClear();
    MockedTimeSlot.find.mockClear();
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

  describe('getAll', () => {
    test('should return doctors with pagination', async () => {
      const options = {
        page: 1,
        limit: 10,
        sort: 'createdAt',
        order: 'desc'
      };

      const result = await doctorServiceToTest.getAll(options);

      expect(MockedDoctor.aggregate).toHaveBeenCalled();
      expect(result).toEqual({
        data: [{ ...mockDoctorDataInstance, user: mockUserDataInstance }],
        total: 1,
        totalPages: 1,
        currentPage: 1
      });
    });

    test('should include search parameters in aggregation pipeline', async () => {
      const options = {
        page: 1,
        limit: 10,
        search: 'Cardiology',
        specialty: 'Cardiology',
        acceptingNewPatients: true,
        minFee: 50,
        maxFee: 150,
        clinicId: 'clinic-123'
      };

      await doctorServiceToTest.getAll(options);

      expect(MockedDoctor.aggregate).toHaveBeenCalled();
      // Verify that the pipeline includes the right $match conditions
      const aggregateCall = MockedDoctor.aggregate.mock.calls[0][0];
      const matchStage = aggregateCall.find(stage => stage.$match);
      
      expect(matchStage).toBeDefined();
      expect(matchStage.$match.specialties).toBe('Cardiology');
      expect(matchStage.$match.acceptingNewPatients).toBe(true);
      expect(matchStage.$match.appointmentFee.$gte).toBe(50);
      expect(matchStage.$match.appointmentFee.$lte).toBe(150);
      expect(matchStage.$match['user.clinicId']).toBe('clinic-123');
    });
  });

  describe('getDoctorUserId', () => {
    test('should return user ID for a valid doctor ID', async () => {
      MockedDoctor.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue({ userId: 'user-123' })
      });

      const userId = await doctorServiceToTest.getDoctorUserId('doctor-123');

      expect(MockedDoctor.findById).toHaveBeenCalledWith('doctor-123');
      expect(userId).toBe('user-123');
    });

    test('should return null if doctor not found', async () => {
      MockedDoctor.findById.mockReturnValueOnce({
        select: jest.fn().mockResolvedValue(null)
      });

      const userId = await doctorServiceToTest.getDoctorUserId('non-existent-id');

      expect(MockedDoctor.findById).toHaveBeenCalledWith('non-existent-id');
      expect(userId).toBeNull();
    });
  });

  describe('create', () => {
    const doctorData = {
      userId: 'user-123',
      specialties: ['Cardiology'],
      licenseNumber: 'LIC12345',
      appointmentFee: 100
    };
    const createdBy = 'admin-user-123';

    test('should create a doctor and update user role', async () => {
      // Set up user mock to return a user with non-doctor role
      MockedUser.findById.mockResolvedValueOnce({
        ...mockUserDataInstance,
        role: 'user',
        save: jest.fn().mockResolvedValue({ ...mockUserDataInstance, role: 'doctor' })
      });

      // Mock getById to return the created doctor
      jest.spyOn(doctorServiceToTest, 'getById').mockResolvedValueOnce({
        ...mockDoctorDataInstance,
        user: { ...mockUserDataInstance, role: 'doctor' }
      });

      const result = await doctorServiceToTest.create(doctorData, createdBy);

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(MockedDoctor.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(MockedDoctor.create).toHaveBeenCalled();
      expect(MockedAuditLog.create).toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      expect(currentMockSession.abortTransaction).not.toHaveBeenCalled();
      
      expect(result).toEqual({
        ...mockDoctorDataInstance,
        user: { ...mockUserDataInstance, role: 'doctor' }
      });
    });

    test('should throw error if user does not exist', async () => {
      MockedUser.findById.mockResolvedValueOnce(null);

      await expect(doctorServiceToTest.create(doctorData, createdBy)).rejects.toThrow('User not found');

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedUser.findById).toHaveBeenCalledWith('user-123');
      expect(MockedDoctor.create).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
    });

    test('should throw error if user is already a doctor', async () => {
      MockedDoctor.findOne.mockResolvedValueOnce(mockDoctorDataInstance);

      await expect(doctorServiceToTest.create(doctorData, createdBy)).rejects.toThrow('User is already a doctor');

      expect(MockedDoctor.findOne).toHaveBeenCalledWith({ userId: 'user-123' });
      expect(MockedDoctor.create).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).not.toHaveBeenCalled();
      expect(currentMockSession.abortTransaction).toHaveBeenCalledTimes(1);
    });
  });

  describe('delete', () => {
    const deletedBy = 'admin-user-123';

    test('should delete a doctor and associated time slots', async () => {
      const result = await doctorServiceToTest.delete('doctor-123', deletedBy);

      expect(mockedMongoose.startSession).toHaveBeenCalledTimes(1);
      expect(currentMockSession.startTransaction).toHaveBeenCalledTimes(1);
      expect(MockedDoctor.findById).toHaveBeenCalledWith('doctor-123');
      expect(MockedTimeSlot.deleteMany).toHaveBeenCalledWith({ doctorId: 'doctor-123' }, { session: currentMockSession });
      expect(MockedDoctor.findByIdAndDelete).toHaveBeenCalledWith('doctor-123', { session: currentMockSession });
      expect(MockedAuditLog.create).toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      
      expect(result).toBe(true);
    });

    test('should return false if doctor not found', async () => {
      MockedDoctor.findById.mockResolvedValueOnce(null);

      const result = await doctorServiceToTest.delete('non-existent-id', deletedBy);

      expect(MockedDoctor.findById).toHaveBeenCalledWith('non-existent-id');
      expect(MockedTimeSlot.deleteMany).not.toHaveBeenCalled();
      expect(MockedDoctor.findByIdAndDelete).not.toHaveBeenCalled();
      expect(currentMockSession.commitTransaction).toHaveBeenCalledTimes(1);
      
      expect(result).toBe(false);
    });
  });

  describe('getDoctorAvailability', () => {
    test('should return available time slots for a doctor', async () => {
      const startDate = new Date('2023-01-01');
      const endDate = new Date('2023-01-07');

      const result = await doctorServiceToTest.getDoctorAvailability('doctor-123', startDate, endDate);

      expect(MockedDoctor.findById).toHaveBeenCalledWith('doctor-123');
      expect(MockedTimeSlot.find).toHaveBeenCalledWith({
        doctorId: 'doctor-123',
        date: { $gte: startDate, $lte: endDate },
        status: 'available'
      });
      
      expect(result).toEqual([mockTimeSlotDataInstance]);
    });

    test('should throw error if doctor not found', async () => {
      MockedDoctor.findById.mockResolvedValueOnce(null);

      await expect(doctorServiceToTest.getDoctorAvailability('non-existent-id', new Date(), new Date())).rejects.toThrow('Doctor not found');

      expect(MockedDoctor.findById).toHaveBeenCalledWith('non-existent-id');
      expect(MockedTimeSlot.find).not.toHaveBeenCalled();
    });

    test('should use default date range if dates not provided', async () => {
      jest.spyOn(global, 'Date').mockImplementation(() => ({
        setDate: jest.fn().mockReturnThis(),
        getDate: jest.fn().mockReturnValue(1),
      }));

      await doctorServiceToTest.getDoctorAvailability('doctor-123');

      expect(MockedTimeSlot.find).toHaveBeenCalled();
      
      global.Date.mockRestore();
    });
  });
}); 