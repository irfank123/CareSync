import serviceContainer from '@src/utils/serviceContainer.mjs';

// Mock the entire serviceContainer
jest.mock('@src/utils/serviceContainer.mjs', () => ({
  register: jest.fn(),
  initializeAll: jest.fn().mockResolvedValue(undefined), // Assuming it's async
  get: jest.fn(),
}));

// Mock individual service modules
const mockUserService = { name: 'UserService' };
const mockPatientService = { name: 'PatientService' };
const mockDoctorService = { name: 'DoctorService' };
const mockStaffService = { name: 'StaffService' };
const mockAppointmentService = { name: 'AppointmentService' };
const mockAuthService = { name: 'AuthService' };
const mockClinicAuthService = { name: 'ClinicAuthService' };
const mockTokenBlacklistService = { name: 'TokenBlacklistService' };
const mockEmailService = {
  name: 'EmailService',
  setupDevTransport: jest.fn().mockResolvedValue(undefined),
  transporter: null, // Initial state
};

jest.mock('@src/services/userService.mjs', () => mockUserService);
jest.mock('@src/services/patientService.mjs', () => mockPatientService);
jest.mock('@src/services/doctorService.mjs', () => mockDoctorService);
jest.mock('@src/services/staffService.mjs', () => mockStaffService);
jest.mock('@src/services/appointmentService.mjs', () => mockAppointmentService);
jest.mock('@src/services/authService.mjs', () => mockAuthService);
jest.mock('@src/services/clinicAuthService.mjs', () => mockClinicAuthService);
jest.mock('@src/services/tokenBlacklistService.mjs', () => mockTokenBlacklistService);
jest.mock('@src/services/emailService.mjs', () => mockEmailService);

// Mock config (though not directly used in the functions being tested, imported by the module)
jest.mock('@src/config/config.mjs', () => ({
  default: jest.fn(() => ({})), // Return a simple object
}));

// Dynamically import the module to be tested AFTER mocks are set up
let initializeServices, getService;

describe('Service Initializer Utilities', () => {
  beforeAll(async () => {
    // Dynamically import here to ensure mocks are applied
    const serviceInitializerModule = await import('@src/utils/serviceInitializer.mjs');
    initializeServices = serviceInitializerModule.initializeServices;
    getService = serviceInitializerModule.getService;
  });

  beforeEach(() => {
    // Reset all mock function calls and specific mock states before each test
    serviceContainer.register.mockClear();
    serviceContainer.initializeAll.mockClear();
    serviceContainer.get.mockClear();
    mockEmailService.setupDevTransport.mockClear();
    mockEmailService.transporter = null; // Reset email service state
    global.console.log = jest.fn(); // Mock console.log to suppress output and verify calls
  });

  afterEach(() => {
    if (global.console.log.mockRestore) {
      global.console.log.mockRestore();
    }
  });

  describe('initializeServices', () => {
    test('should register all services with correct dependencies and init functions', async () => {
      await initializeServices();

      expect(serviceContainer.register).toHaveBeenCalledWith('tokenBlacklistService', mockTokenBlacklistService);
      
      // Email service registration with init function
      expect(serviceContainer.register).toHaveBeenCalledWith('emailService', mockEmailService, [], expect.any(Function));
      
      expect(serviceContainer.register).toHaveBeenCalledWith('authService', mockAuthService, ['emailService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('clinicAuthService', mockClinicAuthService, ['emailService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('userService', mockUserService);
      expect(serviceContainer.register).toHaveBeenCalledWith('patientService', mockPatientService, ['userService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('doctorService', mockDoctorService, ['userService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('staffService', mockStaffService, ['userService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('availabilityService', mockAvailabilityService, ['doctorService']);
      expect(serviceContainer.register).toHaveBeenCalledWith('appointmentService', mockAppointmentService, ['patientService', 'doctorService', 'emailService']);
      
      expect(serviceContainer.initializeAll).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Initializing services...');
      expect(console.log).toHaveBeenCalledWith('All services initialized successfully');
    });

    test('emailService init function should call setupDevTransport in non-production if no transporter', async () => {
      process.env.NODE_ENV = 'development'; // Simulate dev environment
      mockEmailService.transporter = null; // Ensure transporter is not set

      await initializeServices();

      // Find the call to register emailService
      const emailServiceRegisterCall = serviceContainer.register.mock.calls.find(
        call => call[0] === 'emailService'
      );
      const emailServiceInitFn = emailServiceRegisterCall[3]; // The init function
      
      // Call the init function (it's bound to the emailService mock in the actual code)
      await emailServiceInitFn.call(mockEmailService);

      expect(mockEmailService.setupDevTransport).toHaveBeenCalledTimes(1);
      expect(console.log).toHaveBeenCalledWith('Email service initialized');
    });

    test('emailService init function should NOT call setupDevTransport in production', async () => {
      process.env.NODE_ENV = 'production'; // Simulate production environment
      mockEmailService.transporter = null;

      await initializeServices();
      const emailServiceRegisterCall = serviceContainer.register.mock.calls.find(call => call[0] === 'emailService');
      const emailServiceInitFn = emailServiceRegisterCall[3];
      await emailServiceInitFn.call(mockEmailService);

      expect(mockEmailService.setupDevTransport).not.toHaveBeenCalled();
      // console.log('Email service initialized') might still be called if the function runs
    });

    test('emailService init function should NOT call setupDevTransport if transporter already exists', async () => {
      process.env.NODE_ENV = 'development';
      mockEmailService.transporter = { /* some mock transporter object */ }; // Transporter exists

      await initializeServices();
      const emailServiceRegisterCall = serviceContainer.register.mock.calls.find(call => call[0] === 'emailService');
      const emailServiceInitFn = emailServiceRegisterCall[3];
      await emailServiceInitFn.call(mockEmailService);

      expect(mockEmailService.setupDevTransport).not.toHaveBeenCalled();
    });

    test('should return the serviceContainer instance', async () => {
      const result = await initializeServices();
      expect(result).toBe(serviceContainer);
    });
  });

  describe('getService', () => {
    test('should call serviceContainer.get with the service name', () => {
      const serviceName = 'testService';
      const mockReturnedService = { id: 'test' };
      serviceContainer.get.mockReturnValue(mockReturnedService);

      const service = getService(serviceName);

      expect(serviceContainer.get).toHaveBeenCalledWith(serviceName);
      expect(service).toBe(mockReturnedService);
    });
  });
});

// Need to mock availabilityService as well as it's imported and used
jest.mock('@src/services/availabilityService.mjs', () => ({
    name: 'AvailabilityService'
}));
const mockAvailabilityService = { name: 'AvailabilityService' }; 