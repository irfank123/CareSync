import mongoose from 'mongoose';
// Use aliased imports for items that are mocked
import { Prescription as MockedPrescriptionModelAliased, Patient as MockedPatientModelAliased, Doctor as MockedDoctorModelAliased, User as MockedUserModelAliased } from '@src/models/index.mjs';
// Import the actual INSTANCE of the service to be tested
import serviceInstanceFromModule from '../../src/services/prescriptionService.mjs';

// Mock data instances
const mockDoctorUserDataInstance = {
  _id: 'user-doctor-123',
  firstName: 'Jane',
  lastName: 'Smith',
  title: 'Dr.',
  email: 'doctor@example.com'
};

const mockPatientUserDataInstance = {
  _id: 'user-patient-123', 
  firstName: 'John',
  lastName: 'Doe',
  email: 'patient@example.com',
  phoneNumber: '1234567890'
};

const mockDoctorDataInstance = {
  _id: 'doctor-123',
  userId: mockDoctorUserDataInstance._id,
  specialization: 'Cardiology',
  toObject: jest.fn().mockImplementation(function() { return { ...this }; }),
  save: jest.fn()
};

const mockPatientDataInstance = {
  _id: 'patient-123',
  userId: mockPatientUserDataInstance._id,
  dateOfBirth: new Date('1990-01-01'),
  gender: 'male',
  toObject: jest.fn().mockImplementation(function() { return { ...this }; }),
  save: jest.fn()
};

const mockPrescriptionDataInstance = {
  _id: 'prescription-123',
  patientId: 'patient-123',
  doctorId: 'doctor-123',
  medications: [
    {
      name: 'Amoxicillin',
      dosage: '500mg',
      frequency: 'Three times a day',
      duration: '7 days'
    }
  ],
  status: 'active',
  prescriptionDate: new Date('2023-05-15'),
  createdAt: new Date('2023-05-15'),
  updatedAt: new Date('2023-05-15'),
  expirationDate: new Date('2023-06-15'),
  verificationCode: 'ABC123',
  createdBy: 'user-123',
  updatedBy: null,
  toJSON: jest.fn().mockImplementation(function() { return { ...this }; }),
  toObject: jest.fn().mockImplementation(function() { return { ...this }; }),
  save: jest.fn().mockResolvedValue(this)
};

// Mock the modules
jest.mock('@src/models/index.mjs', () => {
  const PrescriptionMock = jest.fn().mockImplementation(() => {
    return {
      save: jest.fn().mockResolvedValue({
        _id: 'prescription-123',
        patientId: 'patient-123',
        doctorId: 'doctor-123',
        medications: [
          {
            name: 'Amoxicillin',
            dosage: '500mg',
            frequency: 'Three times a day',
            duration: '7 days'
          }
        ],
        status: 'active',
        prescriptionDate: new Date('2023-05-15')
      })
    };
  });
  
  PrescriptionMock.create = jest.fn().mockResolvedValue({
    _id: 'prescription-123',
    patientId: 'patient-123',
    doctorId: 'doctor-123',
    medications: [
      {
        name: 'Amoxicillin',
        dosage: '500mg',
        frequency: 'Three times a day',
        duration: '7 days'
      }
    ],
    status: 'active',
    prescriptionDate: new Date('2023-05-15')
  });
  
  PrescriptionMock.findById = jest.fn().mockImplementation(() => {
    return {
      populate: jest.fn().mockImplementation(() => {
        return {
          populate: jest.fn().mockResolvedValue({
            _id: 'prescription-123',
            patientId: {
              _id: 'patient-123',
              userId: {
                firstName: 'John',
                lastName: 'Doe',
                email: 'patient@example.com',
                phoneNumber: '1234567890'
              },
              dateOfBirth: new Date('1990-01-01'),
              gender: 'male'
            },
            doctorId: {
              _id: 'doctor-123',
              userId: {
                firstName: 'Jane',
                lastName: 'Smith',
                title: 'Dr.'
              },
              specialization: 'Cardiology'
            },
            medications: [
              {
                name: 'Amoxicillin',
                dosage: '500mg',
                frequency: 'Three times a day',
                duration: '7 days'
              }
            ],
            status: 'active',
            prescriptionDate: new Date('2023-05-15'),
            toJSON: jest.fn().mockReturnValue({
              _id: 'prescription-123',
              patientId: {
                _id: 'patient-123',
                userId: {
                  firstName: 'John',
                  lastName: 'Doe'
                }
              },
              doctorId: {
                _id: 'doctor-123',
                userId: {
                  firstName: 'Jane',
                  lastName: 'Smith'
                }
              },
              medications: [
                {
                  name: 'Amoxicillin',
                  dosage: '500mg'
                }
              ]
            })
          })
        };
      })
    };
  });
  
  PrescriptionMock.find = jest.fn().mockImplementation(() => {
    return {
      select: jest.fn().mockImplementation(() => {
        return {
          sort: jest.fn().mockImplementation(() => {
            return {
              lean: jest.fn().mockResolvedValue([{
                _id: 'prescription-123',
                patientId: 'patient-123',
                doctorId: 'doctor-123',
                medications: [{ name: 'Amoxicillin', dosage: '500mg' }],
                status: 'active',
                prescriptionDate: new Date('2023-05-15')
              }])
            };
          })
        };
      })
    };
  });
  
  PrescriptionMock.findByIdAndUpdate = jest.fn().mockResolvedValue({
    _id: 'prescription-123',
    patientId: 'patient-123',
    doctorId: 'doctor-123',
    medications: [{ name: 'Amoxicillin', dosage: '500mg' }],
    status: 'updated'
  });
  
  PrescriptionMock.findByIdAndDelete = jest.fn().mockResolvedValue({
    _id: 'prescription-123',
    patientId: 'patient-123',
    doctorId: 'doctor-123',
    medications: [{ name: 'Amoxicillin', dosage: '500mg' }],
    status: 'active'
  });

  const PatientMock = {
    findOne: jest.fn().mockImplementation(() => {
      return {
        select: jest.fn().mockImplementation(() => {
          return {
            lean: jest.fn().mockResolvedValue({
              _id: 'patient-123',
              userId: 'user-patient-123'
            })
          };
        })
      };
    })
  };

  const DoctorMock = {
    findOne: jest.fn().mockResolvedValue({
      _id: 'doctor-123',
      userId: 'user-doctor-123',
      specialization: 'Cardiology'
    }),
    find: jest.fn().mockImplementation(() => {
      return {
        select: jest.fn().mockImplementation(() => {
          return {
            populate: jest.fn().mockImplementation(() => {
              return {
                lean: jest.fn().mockResolvedValue([{
                  _id: 'doctor-123',
                  userId: {
                    firstName: 'Jane',
                    lastName: 'Smith',
                    title: 'Dr.'
                  },
                  specialization: 'Cardiology'
                }])
              };
            })
          };
        })
      };
    })
  };

  const UserMock = {
    findById: jest.fn().mockResolvedValue({
      _id: 'user-123',
      firstName: 'Test',
      lastName: 'User'
    })
  };

  return { 
    Prescription: PrescriptionMock, 
    Patient: PatientMock,
    Doctor: DoctorMock,
    User: UserMock
  };
});

jest.mock('mongoose', () => {
  return {
    Types: {
      ObjectId: {
        isValid: jest.fn().mockReturnValue(true)
      }
    }
  };
});

jest.mock('@src/utils/errorHandler.mjs', () => {
  class MockAppError extends Error { 
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
    }
  }
  return { AppError: MockAppError }; 
});

// Mock console.log to avoid cluttering test output
global.console.log = jest.fn();

// --- Test Suite ---
describe('PrescriptionService', () => {
  let prescriptionService;
  
  beforeEach(() => {
    jest.clearAllMocks();
    prescriptionService = serviceInstanceFromModule;
  });

  describe('createPrescription', () => {
    const prescriptionData = {
      patientId: 'patient-123',
      medications: [
        {
          name: 'Amoxicillin',
          dosage: '500mg',
          frequency: 'Three times a day',
          duration: '7 days'
        }
      ],
      status: 'active',
      prescriptionDate: new Date('2023-05-15'),
      expirationDate: new Date('2023-06-15')
    };
    
    const user = {
      _id: 'user-doctor-123',
      role: 'doctor'
    };

    test('should create a prescription successfully', async () => {
      const result = await prescriptionService.createPrescription(prescriptionData, user);

      expect(result).toBeDefined();
      expect(result._id).toBe('prescription-123');
    });

    test('should throw error if doctor not found', async () => {
      // Override the mock for this test
      const { Doctor } = await import('@src/models/index.mjs');
      Doctor.findOne.mockResolvedValueOnce(null);

      await expect(prescriptionService.createPrescription(prescriptionData, user))
        .rejects.toThrow('Doctor profile not found for the logged-in user');
    });

    test('should throw error if patient ID is invalid', async () => {
      // Override the mock for this test
      mongoose.Types.ObjectId.isValid.mockReturnValueOnce(false);

      await expect(prescriptionService.createPrescription(prescriptionData, user))
        .rejects.toThrow('Invalid Patient ID format');
    });

    test('should throw error if medications are missing', async () => {
      const invalidData = { ...prescriptionData, medications: [] };

      await expect(prescriptionService.createPrescription(invalidData, user))
        .rejects.toThrow('At least one medication is required');
    });
  });

  describe('getPrescriptionsByPatient', () => {
    test('should return prescriptions for a patient', async () => {
      const result = await prescriptionService.getPrescriptionsByPatient('patient-123');
      
      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBe(1);
    });
  });

  describe('getPrescriptionById', () => {
    test('should return a prescription by ID with populated data', async () => {
      const result = await prescriptionService.getPrescriptionById('prescription-123');
      
      expect(result).toBeDefined();
      expect(result._id).toBe('prescription-123');
    });
  });

  describe('updatePrescription', () => {
    test('should update a prescription successfully', async () => {
      const updates = { status: 'filled' };
      const user = { _id: 'user-123' };
      
      const result = await prescriptionService.updatePrescription('prescription-123', updates, user);
      
      expect(result).toBeDefined();
      expect(result.status).toBe('updated');
    });
  });

  describe('deletePrescription', () => {
    test('should delete a prescription successfully', async () => {
      const result = await prescriptionService.deletePrescription('prescription-123');
      
      expect(result).toBeDefined();
      expect(result._id).toBe('prescription-123');
    });
  });
}); 