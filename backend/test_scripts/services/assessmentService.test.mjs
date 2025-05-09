import mongoose from 'mongoose';
import { AppError } from '../../src/utils/errorHandler.mjs';
// import AssessmentService from '../../src/services/assessmentService.mjs'; // OLD
import actualAssessmentServiceInstance from '../../src/services/assessmentService.mjs'; // NEW: Import the instance directly
// Import models that AssessmentService depends on, e.g., Assessment, Appointment, Patient, User
// For now, we'll mock them broadly below.

// Define mockSession at the top level so it's accessible in jest.mock and describe blocks
const mockSession = {
  startTransaction: jest.fn(),
  commitTransaction: jest.fn().mockResolvedValue(undefined),
  abortTransaction: jest.fn().mockResolvedValue(undefined),
  endSession: jest.fn(),
  withTransaction: jest.fn(async (fn) => fn(mockSession)),
};

// --- Mocks for Dependencies ---

jest.mock('../../src/services/aiService.mjs', () => ({
  __esModule: true, // This is important for ES modules
  default: {
    generateQuestions: jest.fn().mockResolvedValue([{ questionId: 'q1', question: 'Generated Question 1?' }]),
    generateAssessmentReport: jest.fn().mockResolvedValue({ report: 'AI Report', severity: 'Mild' }),
    // Add other aiService methods if needed by other tests
  },
}));

jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');
  const { Schema, Types } = originalMongoose;

  const createMockModel = (modelName) => ({
    create: jest.fn(),
    findById: jest.fn().mockReturnThis(),
    findOne: jest.fn().mockReturnThis(),
    findByIdAndUpdate: jest.fn().mockReturnThis(),
    find: jest.fn().mockReturnThis(), // Added for getPatientAssessments
    sort: jest.fn().mockReturnThis(), // Added for getPatientAssessments
    skip: jest.fn().mockReturnThis(), // Added for getPatientAssessments
    limit: jest.fn().mockReturnThis(), // Added for getPatientAssessments
    countDocuments: jest.fn().mockResolvedValue(0), // Added for getPatientAssessments
    aggregate: jest.fn(() => ({ exec: jest.fn().mockResolvedValue([]) })),
    startSession: jest.fn(),
    exec: jest.fn().mockResolvedValue(null),
    save: jest.fn().mockResolvedValue(this),
    toObject: jest.fn().mockImplementation(function() { return { ...this }; }),
    schema: { statics: {}, methods: {}, obj: {}, paths: {} },
    modelName: modelName,
  });

  const concreteModelMocks = {
    Assessment: createMockModel('Assessment'),
    Appointment: createMockModel('Appointment'),
    AuditLog: createMockModel('AuditLog'), // Added AuditLog mock
    Patient: createMockModel('Patient'),
    User: createMockModel('User'),
  };

  concreteModelMocks.Assessment.create.mockImplementation(docs => {
    const createdDocs = Array.isArray(docs) ? 
      docs.map(d => ({ ...d, _id: new originalMongoose.Types.ObjectId().toString(), toObject: () => ({...d}) })) : 
      [{ ...docs, _id: new originalMongoose.Types.ObjectId().toString(), toObject: () => ({...docs}) }];
    return Promise.resolve(createdDocs.length === 1 ? createdDocs[0] : createdDocs); // Adjust for single or array create
  });
  
  concreteModelMocks.Appointment.findByIdAndUpdate.mockImplementation((id, update, options) => {
    return Promise.resolve({ _id: id, ...update.$set, toObject: () => ({_id: id, ...update.$set}) });
  });

  return {
    ...originalMongoose,
    Types,
    Schema,
    startSession: jest.fn(),
    model: jest.fn((modelName) => concreteModelMocks[modelName] || createMockModel(modelName)),
    models: concreteModelMocks,
  };
});

// --- Test Suite ---
describe('AssessmentService', () => {
  // let assessmentServiceInstance; // REMOVED: We use the imported instance directly
  let mockAssessmentModel, mockAppointmentModel, mockPatientModel, mockUserModel, mockAuditLogModel;
  let aiServiceMock;

  beforeAll(async () => {
    // Capture mocked models
    mockAssessmentModel = mongoose.models.Assessment;
    mockAppointmentModel = mongoose.models.Appointment;
    mockPatientModel = mongoose.models.Patient;
    mockUserModel = mongoose.models.User;
    mockAuditLogModel = mongoose.models.AuditLog;
    aiServiceMock = (await import('../../src/services/aiService.mjs')).default;
  });

  beforeEach(() => {
    // Reset mocks before each test
    jest.clearAllMocks();

    // Configure startSession mocks here
    mongoose.startSession.mockResolvedValue(mockSession);
    if (mockAssessmentModel && mockAssessmentModel.startSession) { // Check if model and method exist
      mockAssessmentModel.startSession.mockResolvedValue(mockSession);
    }
    if (mockAppointmentModel && mockAppointmentModel.startSession) {
      mockAppointmentModel.startSession.mockResolvedValue(mockSession);
    }
    if (mockAuditLogModel && mockAuditLogModel.startSession) { // For AuditLog if it ever uses sessions
        mockAuditLogModel.startSession.mockResolvedValue(mockSession);
    }

    // Re-prime session methods
    mockSession.startTransaction.mockClear();
    mockSession.commitTransaction.mockClear().mockResolvedValue(undefined);
    mockSession.abortTransaction.mockClear().mockResolvedValue(undefined);
    mockSession.endSession.mockClear();
    mockSession.withTransaction.mockClear().mockImplementation(async (fn) => fn(mockSession));
    
    mockAssessmentModel.create.mockClear().mockImplementation(docs => {
        const createdDocs = Array.isArray(docs) ? 
        docs.map(d => ({ ...d, _id: new mongoose.Types.ObjectId().toString(), toObject: () => ({...d}) })) : 
        [{ ...docs, _id: new mongoose.Types.ObjectId().toString(), toObject: () => ({...docs}) }];
        return Promise.resolve(createdDocs.length === 1 && !Array.isArray(docs) ? createdDocs[0] : createdDocs);
    });
    mockAppointmentModel.findByIdAndUpdate.mockClear().mockImplementation((id, update, options) => {
        return Promise.resolve({ _id: id, ...update.$set, toObject: () => ({_id: id, ...update.$set}) });
    });
    mockAppointmentModel.findById.mockClear().mockReturnValue({ exec: jest.fn().mockResolvedValue(null) });
    mockAuditLogModel.create.mockClear().mockResolvedValue({}); // Default AuditLog create mock
  });

  // --- Test Cases ---
  describe('startAssessment', () => {
    it('should start an assessment, generate questions, and link to appointment', async () => {
      const patientId = new mongoose.Types.ObjectId().toString();
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const createdByUserId = new mongoose.Types.ObjectId().toString();

      const symptoms = ['fever', 'cough'];
      const mockGeneratedQuestions = [{ questionId: 'gen_q1', question: 'AI Generated Q1?' }];
      const mockCreatedAssessmentId = new mongoose.Types.ObjectId().toString();

      aiServiceMock.generateQuestions.mockResolvedValueOnce(mockGeneratedQuestions);

      const mockAppointment = { 
        _id: appointmentId, 
        patientId: patientId,
      };

      mockAppointmentModel.findById.mockReset();
      mockAppointmentModel.findById.mockResolvedValueOnce(mockAppointment);
      
      mockAssessmentModel.create.mockReset();
      mockAssessmentModel.create.mockImplementationOnce(docs => {
        const docToCreate = Array.isArray(docs) ? docs[0] : docs;
        return Promise.resolve({ ...docToCreate, _id: mockCreatedAssessmentId });
      });
      
      mockAppointmentModel.findByIdAndUpdate.mockReset();
      mockAppointmentModel.findByIdAndUpdate.mockResolvedValueOnce({ _id: appointmentId, preliminaryAssessmentId: mockCreatedAssessmentId });

      mockAuditLogModel.create.mockResolvedValueOnce({});

      const result = await actualAssessmentServiceInstance.startAssessment(patientId, appointmentId, symptoms, createdByUserId);

      expect(aiServiceMock.generateQuestions).toHaveBeenCalledWith(symptoms);

      expect(mockAppointmentModel.findById).toHaveBeenCalledWith(appointmentId);

      expect(mockAssessmentModel.create).toHaveBeenCalledTimes(1);
      expect(mockAssessmentModel.create).toHaveBeenCalledWith(expect.objectContaining({
        patientId: patientId,
        appointmentId: appointmentId,
        symptoms: symptoms,
        generatedQuestions: mockGeneratedQuestions,
        status: 'in-progress',
      }));
      
      expect(mockAppointmentModel.findByIdAndUpdate).toHaveBeenCalledTimes(1);
      expect(mockAppointmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        appointmentId,
        { preliminaryAssessmentId: mockCreatedAssessmentId }
      );

      expect(mockAuditLogModel.create).toHaveBeenCalledWith(expect.objectContaining({
            userId: createdByUserId,
            action: 'create',
            resource: 'assessment',
            resourceId: mockCreatedAssessmentId,
      }));

      expect(result).toBeDefined();
      expect(result.assessmentId).toBe(mockCreatedAssessmentId);
      expect(result.questions).toEqual(mockGeneratedQuestions);
    });

    test.todo('should throw an error if appointment is not found or patientId mismatches');
    test.todo('should throw an error if aiService.generateQuestions fails');
    test.todo('should throw an error if Assessment.create fails');
    test.todo('should throw an error if Appointment.findByIdAndUpdate fails for linking');
  });

  // --- NEW TEST CASES FOR COVERAGE ---

  describe('submitAnswersAndGenerateReport', () => {
    it('should submit answers, generate report, and update assessment', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const answers = [{ questionId: 'q1', answer: 'Yes' }];
      const mockAssessmentInstance = {
        _id: assessmentId,
        status: 'in-progress',
        symptoms: ['headache'],
        generatedQuestions: [{ questionId: 'q1', question: 'Headache?' }],
        responses: [],
        save: jest.fn().mockReturnThis(), // mock save on the instance
      };

      mockAssessmentModel.findById.mockResolvedValueOnce(mockAssessmentInstance);
      aiServiceMock.generateAssessmentReport.mockResolvedValueOnce({ report: 'Test Report', severity: 'Moderate' });
      mockAuditLogModel.create.mockResolvedValueOnce({});

      const result = await actualAssessmentServiceInstance.submitAnswersAndGenerateReport(assessmentId, answers, userId);

      expect(mockAssessmentModel.findById).toHaveBeenCalledWith(assessmentId);
      expect(mockAssessmentInstance.save).toHaveBeenCalledTimes(2); // Called twice
      expect(aiServiceMock.generateAssessmentReport).toHaveBeenCalled();
      expect(mockAuditLogModel.create).toHaveBeenCalled();
      expect(result.status).toBe('completed');
      expect(result.aiGeneratedReport).toBe('Test Report');
      expect(result.severity).toBe('Moderate');
    });
    // Add basic error path tests for coverage
    it('should throw if assessment not found', async () => {
      mockAssessmentModel.findById.mockResolvedValueOnce(null);
      await expect(actualAssessmentServiceInstance.submitAnswersAndGenerateReport('id', [], 'uid')).rejects.toThrow('Assessment not found');
    });
    it('should throw if assessment not in-progress', async () => {
      mockAssessmentModel.findById.mockResolvedValueOnce({ status: 'completed' });
      await expect(actualAssessmentServiceInstance.submitAnswersAndGenerateReport('id', [], 'uid')).rejects.toThrow('Assessment is not in-progress');
    });
  });

  describe('getAssessmentById', () => {
    it('should return an assessment if found', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      const mockAssessment = { _id: assessmentId, symptoms: ['fever'] };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(true);
      mockAssessmentModel.findById.mockResolvedValueOnce(mockAssessment);

      const result = await actualAssessmentServiceInstance.getAssessmentById(assessmentId);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(assessmentId);
      expect(mockAssessmentModel.findById).toHaveBeenCalledWith(assessmentId);
      expect(result).toEqual(mockAssessment);
    });

    it('should throw if assessment ID is invalid', async () => {
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(false);
      await expect(actualAssessmentServiceInstance.getAssessmentById('invalid-id')).rejects.toThrow('Invalid assessment ID format');
    });

    it('should throw if assessment not found by ID', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(true);
      mockAssessmentModel.findById.mockResolvedValueOnce(null);
      await expect(actualAssessmentServiceInstance.getAssessmentById(assessmentId)).rejects.toThrow('Assessment not found');
    });
  });

  describe('getAssessmentForAppointment', () => {
    it('should return an assessment for a given appointment ID if found', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      const mockAssessment = { appointmentId: appointmentId, symptoms: ['cough'] };
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(true);
      mockAssessmentModel.findOne.mockResolvedValueOnce(mockAssessment);

      const result = await actualAssessmentServiceInstance.getAssessmentForAppointment(appointmentId);
      expect(mongoose.Types.ObjectId.isValid).toHaveBeenCalledWith(appointmentId);
      expect(mockAssessmentModel.findOne).toHaveBeenCalledWith({ appointmentId });
      expect(result).toEqual(mockAssessment);
    });
    it('should return null if no assessment found for appointment ID', async () => {
      const appointmentId = new mongoose.Types.ObjectId().toString();
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(true);
      mockAssessmentModel.findOne.mockResolvedValueOnce(null);
      const result = await actualAssessmentServiceInstance.getAssessmentForAppointment(appointmentId);
      expect(result).toBeNull();
    });
    it('should throw if appointment ID is invalid', async () => {
      jest.spyOn(mongoose.Types.ObjectId, 'isValid').mockReturnValueOnce(false);
      await expect(actualAssessmentServiceInstance.getAssessmentForAppointment('invalid-id')).rejects.toThrow('Invalid appointment ID format');
    });
  });

  describe('skipAssessment', () => {
    it('should skip an assessment and update its status to abandoned', async () => {
      const assessmentId = new mongoose.Types.ObjectId().toString();
      const userId = new mongoose.Types.ObjectId().toString();
      const reason = 'Patient refused.';
      const mockInitialAssessment = { _id: assessmentId, status: 'in-progress' };
      const mockSkippedAssessment = { _id: assessmentId, status: 'abandoned', aiGeneratedReport: reason };

      mockAssessmentModel.findById.mockResolvedValueOnce(mockInitialAssessment);
      mockAssessmentModel.findByIdAndUpdate.mockResolvedValueOnce(mockSkippedAssessment);
      mockAuditLogModel.create.mockResolvedValueOnce({});

      const result = await actualAssessmentServiceInstance.skipAssessment(assessmentId, reason, userId);

      expect(mockAssessmentModel.findById).toHaveBeenCalledWith(assessmentId);
      expect(mockAssessmentModel.findByIdAndUpdate).toHaveBeenCalledWith(
        assessmentId,
        expect.objectContaining({ status: 'abandoned', aiGeneratedReport: reason }),
        { new: true }
      );
      expect(mockAuditLogModel.create).toHaveBeenCalled();
      expect(result).toEqual(mockSkippedAssessment);
    });
    it('should throw if assessment not found', async () => {
      mockAssessmentModel.findById.mockResolvedValueOnce(null);
      await expect(actualAssessmentServiceInstance.skipAssessment('id', '', 'uid')).rejects.toThrow('Assessment not found');
    });
    it('should throw if assessment not in-progress', async () => {
      mockAssessmentModel.findById.mockResolvedValueOnce({ status: 'completed' });
      await expect(actualAssessmentServiceInstance.skipAssessment('id', '', 'uid')).rejects.toThrow('Cannot skip an already completed or archived assessment');
    });
  });

  describe('getPatientAssessments', () => {
    it('should retrieve assessments for a patient with pagination', async () => {
      const patientId = new mongoose.Types.ObjectId().toString();
      const mockAssessments = [{ _id: 'assess1' }, { _id: 'assess2' }];
      const mockTotal = 2;

      // Mock the chain for Assessment.find().sort().skip().limit()
      const mockLimit = jest.fn().mockResolvedValue(mockAssessments);
      const mockSkip = jest.fn().mockReturnValue({ limit: mockLimit });
      const mockSort = jest.fn().mockReturnValue({ skip: mockSkip });
      mockAssessmentModel.find.mockReturnValue({ sort: mockSort });
      mockAssessmentModel.countDocuments.mockResolvedValueOnce(mockTotal);

      const result = await actualAssessmentServiceInstance.getPatientAssessments(patientId, { page: 1, limit: 10 });

      expect(mockAssessmentModel.find).toHaveBeenCalledWith({ patientId });
      expect(mockSort).toHaveBeenCalledWith({ creationDate: -1 }); // Default sort
      expect(mockSkip).toHaveBeenCalledWith(0);
      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockAssessmentModel.countDocuments).toHaveBeenCalledWith({ patientId });
      expect(result.assessments).toEqual(mockAssessments);
      expect(result.pagination.total).toBe(mockTotal);
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });
}); 