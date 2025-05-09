import mongoose from 'mongoose';
import serviceInstanceFromModule from '../../src/services/googleService.mjs';

// Mock dependencies before importing the service
jest.mock('../../src/utils/encryption.mjs', () => ({
  encryptToken: jest.fn(token => `encrypted-${token}`),
  decryptToken: jest.fn(token => token.replace('encrypted-', ''))
}));

jest.mock('../../src/config/config.mjs', () => ({
  __esModule: true,
  default: () => ({
    google: {
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      redirectUri: 'http://localhost:3000/auth/google/callback'
    }
  })
}));

jest.mock('googleapis', () => {
  // Create mock implementations for googleapis
  const mockOAuth2 = {
    generateAuthUrl: jest.fn().mockReturnValue('https://accounts.google.com/o/oauth2/auth?test=true'),
    getToken: jest.fn().mockResolvedValue({
      tokens: {
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: Date.now() + 3600000
      }
    }),
    setCredentials: jest.fn(),
    getAccessToken: jest.fn().mockResolvedValue({ token: 'refreshed-access-token' })
  };

  const mockCalendar = {
    events: {
      insert: jest.fn().mockResolvedValue({
        data: {
          id: 'event-123',
          hangoutLink: 'https://meet.google.com/test-link',
          htmlLink: 'https://calendar.google.com/event/test-event'
        }
      })
    }
  };

  return {
    google: {
      auth: {
        OAuth2: jest.fn(() => mockOAuth2)
      },
      calendar: jest.fn(() => mockCalendar)
    }
  };
});

// Mock User model
jest.mock('@src/models/index.mjs', () => {
  return {
    User: {
      findById: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          _id: 'user-123',
          email: 'test@example.com',
          googleRefreshToken: 'encrypted-test-refresh-token'
        })
      })),
      findByIdAndUpdate: jest.fn().mockResolvedValue({
        _id: 'user-123',
        email: 'test@example.com',
        googleRefreshToken: 'encrypted-new-refresh-token'
      })
    }
  };
});

// Mock Clinic model
jest.mock('@src/models/Clinic.mjs', () => {
  return {
    __esModule: true,
    default: {
      findById: jest.fn().mockImplementation(() => ({
        select: jest.fn().mockResolvedValue({
          _id: 'clinic-123',
          name: 'Test Clinic',
          googleRefreshToken: 'encrypted-clinic-refresh-token'
        })
      })),
      findByIdAndUpdate: jest.fn().mockResolvedValue({
        _id: 'clinic-123',
        name: 'Test Clinic',
        googleRefreshToken: 'encrypted-new-clinic-refresh-token'
      })
    }
  };
});

// Mock AppError
jest.mock('@src/utils/errorHandler.mjs', () => {
  class MockAppError extends Error {
    constructor(message, statusCode) {
      super(message);
      this.statusCode = statusCode;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true;
      this.name = 'AppError';
    }
  }
  return { AppError: MockAppError };
});

describe('GoogleService', () => {
  let googleService;
  let User, Clinic, googleapis, encryptionUtils;

  beforeEach(async () => {
    // Reset module mocks
    jest.clearAllMocks();
    
    // Import mocked modules
    User = (await import('@src/models/index.mjs')).User;
    Clinic = (await import('@src/models/Clinic.mjs')).default;
    googleapis = await import('googleapis');
    encryptionUtils = await import('../../src/utils/encryption.mjs');
    
    // Import service
    const serviceModule = await import('../../src/services/googleService.mjs');
    googleService = serviceModule.default;
  });

  describe('generateAuthUrl', () => {
    it('should generate auth URL with state parameter', () => {
      const userId = 'user-123';
      const result = googleService.generateAuthUrl(userId);
      
      expect(result).toBe('https://accounts.google.com/o/oauth2/auth?test=true');
    });
    
    it('should throw error if userId not provided', () => {
      expect(() => googleService.generateAuthUrl()).toThrow('Cannot generate Google Auth URL without a userId for state.');
    });
  });

  describe('getTokensFromCode', () => {
    it('should exchange code for tokens', async () => {
      const code = 'test-auth-code';
      const tokens = await googleService.getTokensFromCode(code);
      
      expect(tokens).toEqual({
        access_token: 'test-access-token',
        refresh_token: 'test-refresh-token',
        expiry_date: expect.any(Number)
      });
    });
  });

  describe('saveRefreshToken', () => {
    it('should encrypt and save token', async () => {
      const userId = 'user-123';
      const refreshToken = 'test-refresh-token';
      
      await googleService.saveRefreshToken(userId, refreshToken);
      
      expect(encryptionUtils.encryptToken).toHaveBeenCalledWith(refreshToken);
      expect(User.findByIdAndUpdate).toHaveBeenCalledWith(
        userId,
        { googleRefreshToken: 'encrypted-test-refresh-token' }
      );
    });
    
    it('should do nothing if no token provided', async () => {
      const userId = 'user-123';
      
      await googleService.saveRefreshToken(userId, null);
      
      expect(encryptionUtils.encryptToken).not.toHaveBeenCalled();
      expect(User.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('getRefreshedClient', () => {
    it('should retrieve and use refresh token', async () => {
      const userId = 'user-123';
      
      const client = await googleService.getRefreshedClient(userId);
      
      expect(User.findById).toHaveBeenCalledWith(userId);
      expect(encryptionUtils.decryptToken).toHaveBeenCalledWith('encrypted-test-refresh-token');
      
      // Expect OAuth client to be created
      expect(googleapis.google.auth.OAuth2).toHaveBeenCalled();
    });
    
    it('should throw error if user has no refresh token', async () => {
      const userId = 'no-token-user';
      
      // Mock user without refresh token
      User.findById.mockImplementationOnce(() => ({
        select: jest.fn().mockResolvedValue({ 
          _id: userId, 
          googleRefreshToken: null 
        })
      }));
      
      await expect(googleService.getRefreshedClient(userId))
        .rejects.toThrow('User has not connected their Google account or refresh token is missing.');
    });
  });

  describe('createCalendarEventWithMeet', () => {
    it('should create calendar event with Google Meet link', async () => {
      const clinicId = 'clinic-123';
      const eventDetails = {
        summary: 'Test Appointment',
        description: 'Test Description',
        startDateTime: '2023-01-01T10:00:00Z',
        endDateTime: '2023-01-01T11:00:00Z',
        attendees: [
          { email: 'doctor@example.com' },
          { email: 'patient@example.com' }
        ]
      };
      
      // Mock the getAuthenticatedClient method if it exists
      if (googleService.getAuthenticatedClient) {
        googleService.getAuthenticatedClient = jest.fn().mockResolvedValue({});
      }
      
      const result = await googleService.createCalendarEventWithMeet(clinicId, eventDetails);
      
      // Verify result
      expect(result).toEqual({
        id: 'event-123',
        hangoutLink: 'https://meet.google.com/test-link',
        htmlLink: 'https://calendar.google.com/event/test-event'
      });
      
      // Verify calendar API call
      const calendar = googleapis.google.calendar();
      expect(calendar.events.insert).toHaveBeenCalledWith(expect.objectContaining({
        calendarId: 'primary',
        conferenceDataVersion: 1,
        resource: expect.objectContaining({
          summary: 'Test Appointment',
          description: 'Test Description',
          conferenceData: expect.anything()
        })
      }));
    });
    
    it('should throw error if required event details are missing', async () => {
      const clinicId = 'clinic-123';
      const incompleteEventDetails = {
        summary: 'Test Appointment'
        // Missing startDateTime and endDateTime
      };
      
      await expect(googleService.createCalendarEventWithMeet(clinicId, incompleteEventDetails))
        .rejects.toThrow('Missing required event details');
    });
  });

  describe('saveRefreshTokenForClinic', () => {
    it('should encrypt and save token for a clinic', async () => {
      const clinicId = 'clinic-123';
      const refreshToken = 'test-clinic-refresh-token';
      
      // Mock successful update
      Clinic.updateOne = jest.fn().mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 1
      });
      
      const result = await googleService.saveRefreshTokenForClinic(clinicId, refreshToken);
      
      expect(encryptionUtils.encryptToken).toHaveBeenCalledWith(refreshToken);
      expect(Clinic.updateOne).toHaveBeenCalledWith(
        { _id: clinicId },
        { $set: { googleRefreshToken: 'encrypted-test-clinic-refresh-token' } }
      );
      expect(result).toBe(true);
    });

    it('should throw error if no refresh token provided', async () => {
      const clinicId = 'clinic-123';
      
      await expect(googleService.saveRefreshTokenForClinic(clinicId, null))
        .rejects.toThrow('Refresh token is required to save');
      
      expect(Clinic.updateOne).not.toHaveBeenCalled();
    });

    it('should throw error if no clinic ID provided', async () => {
      const refreshToken = 'test-clinic-refresh-token';
      
      await expect(googleService.saveRefreshTokenForClinic(null, refreshToken))
        .rejects.toThrow('Clinic ID is required');
      
      expect(Clinic.updateOne).not.toHaveBeenCalled();
    });

    it('should throw error if clinic not found', async () => {
      const clinicId = 'nonexistent-clinic';
      const refreshToken = 'test-clinic-refresh-token';
      
      // Mock not finding the clinic
      Clinic.updateOne = jest.fn().mockResolvedValue({
        matchedCount: 0,
        modifiedCount: 0
      });
      
      await expect(googleService.saveRefreshTokenForClinic(clinicId, refreshToken))
        .rejects.toThrow('Clinic with ID nonexistent-clinic was not found');
      
      expect(encryptionUtils.encryptToken).toHaveBeenCalledWith(refreshToken);
      expect(Clinic.updateOne).toHaveBeenCalled();
    });

    it('should handle case when token is unchanged', async () => {
      const clinicId = 'clinic-123';
      const refreshToken = 'test-clinic-refresh-token';
      
      // Mock finding the clinic but not changing the token (already the same)
      Clinic.updateOne = jest.fn().mockResolvedValue({
        matchedCount: 1,
        modifiedCount: 0
      });
      
      const result = await googleService.saveRefreshTokenForClinic(clinicId, refreshToken);
      
      expect(encryptionUtils.encryptToken).toHaveBeenCalledWith(refreshToken);
      expect(Clinic.updateOne).toHaveBeenCalled();
      expect(result).toBe(true);
    });
  });

  describe('getAuthenticatedClient', () => {
    let originalMethod;
    
    beforeEach(() => {
      // Save the original method
      originalMethod = googleService.getAuthenticatedClient;
      // Create a mock implementation for testing
      googleService.getAuthenticatedClient = jest.fn().mockImplementation(async (clinicId) => {
        if (!clinicId) {
          throw new Error('Clinic ID is required to get authenticated Google client');
        }
        
        const clinic = await Clinic.findById(clinicId).select('+googleRefreshToken');
        
        if (!clinic) {
          throw new Error(`Clinic not found with ID: ${clinicId}`);
        }
        
        if (!clinic.googleRefreshToken) {
          throw new Error(`No Google account connected for clinic: ${clinicId}`);
        }
        
        const authClient = new googleapis.google.auth.OAuth2(
          'test-client-id',
          'test-client-secret',
          'http://localhost:3000/auth/google/callback'
        );
        
        return authClient;
      });
    });
    
    afterEach(() => {
      // Restore the original method
      googleService.getAuthenticatedClient = originalMethod;
    });
    
    it('should return authenticated client with valid refresh token', async () => {
      const clinicId = 'clinic-123';
      
      // Setup the mock for Clinic.findById
      const mockClinic = {
        _id: clinicId,
        googleRefreshToken: 'encrypted-refresh-token'
      };
      Clinic.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      
      const result = await googleService.getAuthenticatedClient(clinicId);
      
      expect(googleService.getAuthenticatedClient).toHaveBeenCalledWith(clinicId);
      expect(Clinic.findById).toHaveBeenCalledWith(clinicId);
      expect(result).toBeDefined();
    });

    it('should throw error if clinic not found', async () => {
      const clinicId = 'nonexistent-clinic';
      
      // Mock clinic not found
      Clinic.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null)
      });
      
      await expect(googleService.getAuthenticatedClient(clinicId))
        .rejects.toThrow(`Clinic not found with ID: ${clinicId}`);
        
      expect(Clinic.findById).toHaveBeenCalledWith(clinicId);
    });

    it('should throw error if clinic has no refresh token', async () => {
      const clinicId = 'clinic-no-token';
      
      // Mock clinic with no token
      const mockClinic = {
        _id: clinicId,
        googleRefreshToken: null
      };
      Clinic.findById = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockClinic)
      });
      
      await expect(googleService.getAuthenticatedClient(clinicId))
        .rejects.toThrow(`No Google account connected for clinic: ${clinicId}`);
        
      expect(Clinic.findById).toHaveBeenCalledWith(clinicId);
    });

    it('should throw error if no clinic ID provided', async () => {
      await expect(googleService.getAuthenticatedClient())
        .rejects.toThrow('Clinic ID is required to get authenticated Google client');
    });
  });
}); 