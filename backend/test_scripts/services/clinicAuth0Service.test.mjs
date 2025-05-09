import { User, Clinic } from '../../src/models/index.mjs';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';
import crypto from 'crypto';
import { AuthenticationClient, ManagementClient } from 'auth0';
import clinicAuth0Service from '../../src/services/clinicAuth0Service.mjs';

// Mock dependencies
jest.mock('auth0', () => {
  return {
    AuthenticationClient: jest.fn().mockImplementation(() => ({
      getProfile: jest.fn().mockResolvedValue({
        sub: 'auth0|123456',
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User'
      })
    })),
    ManagementClient: jest.fn().mockImplementation(() => ({
      getUser: jest.fn().mockResolvedValue({
        user_id: 'auth0|123456',
        email: 'test@example.com'
      })
    }))
  };
});

jest.mock('../../src/config/config.mjs', () => () => ({
  auth0: {
    domain: 'test-domain.auth0.com',
    clientId: 'test-client-id',
    clientSecret: 'test-client-secret',
    callbackUrl: 'https://example.com/callback',
    audience: 'https://test-domain.auth0.com/api/v2/'
  },
  jwt: {
    secret: 'test-jwt-secret',
    expiresIn: '1h'
  },
  frontendUrl: 'https://example.com'
}));

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn().mockReturnValue('test-jwt-token'),
  decode: jest.fn().mockImplementation((token) => {
    if (token === 'valid-id-token') {
      return {
        sub: 'auth0|123456',
        email: 'test@example.com',
        email_verified: true,
        given_name: 'Test',
        family_name: 'User'
      };
    }
    return null;
  })
}));

jest.mock('node-fetch', () => jest.fn());

jest.mock('crypto', () => ({
  randomBytes: jest.fn().mockReturnValue({
    toString: jest.fn().mockReturnValue('random-string')
  })
}));

jest.mock('../../src/models/index.mjs', () => ({
  User: {
    findOne: jest.fn(),
    create: jest.fn(),
    findById: jest.fn()
  },
  Clinic: {
    findById: jest.fn()
  }
}));

describe('ClinicAuth0Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset the service's internal state for testing
    clinicAuth0Service.managementClient = new ManagementClient();
    clinicAuth0Service.authClient = new AuthenticationClient();
    clinicAuth0Service.config = {
      domain: 'test-domain.auth0.com',
      clientId: 'test-client-id',
      clientSecret: 'test-client-secret',
      callbackUrl: 'https://example.com/callback',
      audience: 'https://test-domain.auth0.com/api/v2/'
    };
  });

  describe('constructor', () => {
    it('should initialize Auth0 clients when config is valid', () => {
      // Create a new instance to test constructor
      const ClinicAuth0ServiceClass = clinicAuth0Service.constructor;
      const instance = new ClinicAuth0ServiceClass();
      
      expect(AuthenticationClient).toHaveBeenCalledWith({
        domain: 'test-domain.auth0.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
      
      expect(ManagementClient).toHaveBeenCalledWith({
        domain: 'test-domain.auth0.com',
        clientId: 'test-client-id',
        clientSecret: 'test-client-secret'
      });
      
      expect(instance.managementClient).toBeDefined();
      expect(instance.authClient).toBeDefined();
    });

    it('should not initialize Auth0 clients when config is invalid', () => {
      // Mock console.warn
      const originalConsoleWarn = console.warn;
      console.warn = jest.fn();

      // Create a mock instance with null config to simulate invalid config
      const instance = Object.create(clinicAuth0Service);
      instance.config = null;
      instance.managementClient = null;
      instance.authClient = null;
      
      expect(instance.managementClient).toBeNull();
      expect(instance.authClient).toBeNull();

      // Restore console.warn
      console.warn = originalConsoleWarn;
    });

    it('should handle initialization errors', () => {
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force ManagementClient constructor to throw
      ManagementClient.mockImplementationOnce(() => {
        throw new Error('Initialization error');
      });

      // Create a new instance to test constructor
      const ClinicAuth0ServiceClass = clinicAuth0Service.constructor;
      const instance = new ClinicAuth0ServiceClass();
      
      expect(console.error).toHaveBeenCalled();
      expect(instance.managementClient).toBeNull();
      expect(instance.authClient).toBeNull();

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('isInitialized', () => {
    it('should return true when both clients are initialized', () => {
      expect(clinicAuth0Service.isInitialized()).toBe(true);
    });

    it('should return false when clients are not initialized', () => {
      clinicAuth0Service.managementClient = null;
      clinicAuth0Service.authClient = null;
      
      expect(clinicAuth0Service.isInitialized()).toBe(false);
    });
  });

  describe('isAuth0Configured', () => {
    it('should return true when Auth0 is properly configured', () => {
      // Mock the implementation to return true
      const originalIsInitialized = clinicAuth0Service.isInitialized;
      clinicAuth0Service.isInitialized = jest.fn().mockReturnValue(true);
      
      expect(clinicAuth0Service.isAuth0Configured()).toBe(true);
      
      // Restore original implementation
      clinicAuth0Service.isInitialized = originalIsInitialized;
    });

    it('should return false when Auth0 is not initialized', () => {
      clinicAuth0Service.managementClient = null;
      
      expect(clinicAuth0Service.isAuth0Configured()).toBe(false);
    });

    it('should return false when callback URL is missing', () => {
      // Mock the implementation
      const originalIsInitialized = clinicAuth0Service.isInitialized;
      clinicAuth0Service.isInitialized = jest.fn().mockReturnValue(false);
      
      expect(clinicAuth0Service.isAuth0Configured()).toBe(false);
      
      // Restore original implementation
      clinicAuth0Service.isInitialized = originalIsInitialized;
    });
  });

  describe('getAuthorizationUrl', () => {
    it('should generate a valid authorization URL', () => {
      const url = clinicAuth0Service.getAuthorizationUrl();
      
      expect(url).toContain('https://test-domain.auth0.com/authorize');
      expect(url).toContain('response_type=code');
      expect(url).toContain('client_id=test-client-id');
      expect(url).toContain('redirect_uri=https%3A%2F%2Fexample.com%2Fcallback');
      expect(url).toContain('scope=openid+profile+email');
      expect(url).toContain('audience=https%3A%2F%2Ftest-domain.auth0.com%2Fapi%2Fv2%2F');
    });

    it('should throw an error if Auth0 is not initialized', () => {
      clinicAuth0Service.managementClient = null;
      
      expect(() => clinicAuth0Service.getAuthorizationUrl()).toThrow('Auth0 clients are not initialized');
    });

    it('should throw an error if callback URL is not configured', () => {
      clinicAuth0Service.config.callbackUrl = null;
      
      expect(() => clinicAuth0Service.getAuthorizationUrl()).toThrow('Auth0 callback URL is not configured');
    });
  });

  describe('exchangeCodeForTokens', () => {
    it('should exchange authorization code for tokens', async () => {
      // Mock fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          id_token: 'test-id-token',
          refresh_token: 'test-refresh-token'
        })
      });

      const result = await clinicAuth0Service.exchangeCodeForTokens('test-code', 'https://example.com/callback');
      
      expect(fetch).toHaveBeenCalledWith('https://test-domain.auth0.com/oauth/token', expect.any(Object));
      expect(result).toEqual({
        access_token: 'test-access-token',
        id_token: 'test-id-token',
        refresh_token: 'test-refresh-token'
      });
    });

    it('should throw an error if code or redirectUri is missing', async () => {
      await expect(clinicAuth0Service.exchangeCodeForTokens()).rejects.toThrow('Code and redirect URI are required');
    });

    it('should handle failed token exchange', async () => {
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Mock fetch to return an error response
      fetch.mockResolvedValueOnce({
        ok: false,
        json: jest.fn().mockResolvedValue({
          error: 'invalid_grant',
          error_description: 'Code reuse detected - check if user is already authenticated'
        }),
        status: 400,
        statusText: 'Bad Request'
      });

      await expect(
        clinicAuth0Service.exchangeCodeForTokens('invalid-code', 'https://example.com/callback')
      ).rejects.toThrow('Code reuse detected');

      expect(console.error).toHaveBeenCalled();

      // Restore console.error
      console.error = originalConsoleError;
    });

    it('should normalize redirect URI if it is not fully qualified', async () => {
      // Mock fetch response
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          id_token: 'test-id-token'
        })
      });

      await clinicAuth0Service.exchangeCodeForTokens('test-code', '/callback');
      
      // Verify that it used the configured callback URL
      const fetchCall = fetch.mock.calls[0];
      const fetchBody = JSON.parse(fetchCall[1].body);
      expect(fetchBody.redirect_uri).toBe('https://example.com/callback');
    });
  });

  describe('getUserProfile', () => {
    it('should get user profile using access token', async () => {
      const profile = await clinicAuth0Service.getUserProfile('test-access-token');
      
      expect(clinicAuth0Service.authClient.getProfile).toHaveBeenCalledWith('test-access-token');
      expect(profile).toEqual({
        sub: 'auth0|123456',
        email: 'test@example.com',
        given_name: 'Test',
        family_name: 'User'
      });
    });

    it('should throw an error if profile retrieval fails', async () => {
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Force getProfile to reject
      clinicAuth0Service.authClient.getProfile.mockRejectedValueOnce(new Error('Profile error'));

      await expect(clinicAuth0Service.getUserProfile('test-token')).rejects.toThrow('Failed to get user profile');
      expect(console.error).toHaveBeenCalled();

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('handleCallback', () => {
    beforeEach(() => {
      // Mock fetch response for token exchange
      fetch.mockResolvedValue({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token',
          id_token: 'valid-id-token'
        })
      });
    });

    it('should process the authorization code and return user, clinic, and token', async () => {
      // Mock User.findOne to return null then user by email
      User.findOne
        .mockResolvedValueOnce(null) // No user with auth0Id
        .mockResolvedValueOnce(null); // No user with email either
      
      // Mock User.create to return new user
      const mockUser = { 
        _id: 'user-id',
        auth0Id: 'auth0|123456',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: 'admin',
        emailVerified: true,
        toObject: jest.fn().mockReturnThis()
      };
      User.create.mockResolvedValueOnce(mockUser);

      const result = await clinicAuth0Service.handleCallback('test-auth-code');
      
      expect(fetch).toHaveBeenCalled();
      expect(jwt.decode).toHaveBeenCalledWith('valid-id-token');
      expect(User.findOne).toHaveBeenCalledWith({ auth0Id: 'auth0|123456' });
      expect(User.findOne).toHaveBeenCalledWith({ email: 'test@example.com' });
      expect(User.create).toHaveBeenCalled();
      expect(jwt.sign).toHaveBeenCalled();
      
      expect(result).toEqual({
        user: mockUser,
        clinic: null, // No clinic was found
        token: 'test-jwt-token'
      });
    });

    it('should link Auth0 ID to existing user found by email', async () => {
      // Mock User.findOne to return null then existing user by email
      const existingUser = {
        _id: 'existing-user-id',
        email: 'test@example.com',
        save: jest.fn().mockResolvedValueOnce({}),
        toObject: jest.fn().mockReturnThis()
      };
      
      User.findOne
        .mockResolvedValueOnce(null) // No user with auth0Id
        .mockResolvedValueOnce(existingUser); // Existing user by email

      const result = await clinicAuth0Service.handleCallback('test-auth-code');
      
      expect(existingUser.auth0Id).toBe('auth0|123456');
      expect(existingUser.emailVerified).toBe(true);
      expect(existingUser.save).toHaveBeenCalled();
      expect(result.user).toBe(existingUser);
    });

    it('should find associated clinic if user has clinicId', async () => {
      // Mock existing user with clinicId
      const existingUser = {
        _id: 'existing-user-id',
        email: 'test@example.com',
        auth0Id: 'auth0|123456',
        clinicId: 'clinic-id',
        role: 'admin',
        toObject: jest.fn().mockReturnThis()
      };
      
      User.findOne.mockResolvedValueOnce(existingUser);
      
      // Mock clinic
      const mockClinic = {
        _id: 'clinic-id',
        name: 'Test Clinic',
        toObject: jest.fn().mockReturnThis()
      };
      
      Clinic.findById.mockResolvedValueOnce(mockClinic);

      const result = await clinicAuth0Service.handleCallback('test-auth-code');
      
      expect(Clinic.findById).toHaveBeenCalledWith('clinic-id');
      expect(result.clinic).toBe(mockClinic);
      expect(jwt.sign).toHaveBeenCalledWith(
        expect.objectContaining({
          clinicId: 'clinic-id'
        }),
        'test-jwt-secret',
        expect.any(Object)
      );
    });

    it('should handle missing authorization code', async () => {
      await expect(clinicAuth0Service.handleCallback()).rejects.toThrow('No authorization code provided');
    });

    it('should handle uninitialized Auth0 clients', async () => {
      clinicAuth0Service.managementClient = null;
      
      await expect(clinicAuth0Service.handleCallback('test-code')).rejects.toThrow('Auth0 clients are not configured');
    });

    it('should handle missing callback URL', async () => {
      clinicAuth0Service.config.callbackUrl = null;
      
      await expect(clinicAuth0Service.handleCallback('test-code')).rejects.toThrow('Auth0 callback URL is not configured');
    });

    it('should handle invalid or missing ID token', async () => {
      // Mock fetch to return response without id_token
      fetch.mockResolvedValueOnce({
        ok: true,
        json: jest.fn().mockResolvedValue({
          access_token: 'test-access-token'
          // No id_token
        })
      });

      await expect(clinicAuth0Service.handleCallback('test-code')).rejects.toThrow('No ID token returned from Auth0');
    });

    it('should handle missing email in profile', async () => {
      // Force jwt.decode to return profile without email
      jwt.decode.mockReturnValueOnce({
        sub: 'auth0|123456'
        // No email
      });

      await expect(clinicAuth0Service.handleCallback('test-code')).rejects.toThrow('Email not available from Auth0 profile');
    });

    it('should handle missing sub in profile', async () => {
      // Force jwt.decode to return profile without sub
      jwt.decode.mockReturnValueOnce({
        email: 'test@example.com'
        // No sub
      });

      await expect(clinicAuth0Service.handleCallback('test-code')).rejects.toThrow('User identifier (sub) missing from Auth0 profile');
    });

    it('should handle clinic lookup errors', async () => {
      // Mock console.error
      const originalConsoleError = console.error;
      console.error = jest.fn();

      // Mock existing user with clinicId
      const existingUser = {
        _id: 'existing-user-id',
        email: 'test@example.com',
        auth0Id: 'auth0|123456',
        clinicId: 'clinic-id',
        role: 'admin',
        toObject: jest.fn().mockReturnThis()
      };
      
      User.findOne.mockResolvedValueOnce(existingUser);
      
      // Mock clinic lookup error
      Clinic.findById.mockRejectedValueOnce(new Error('Clinic lookup error'));

      const result = await clinicAuth0Service.handleCallback('test-code');
      
      expect(console.error).toHaveBeenCalled();
      expect(result.clinic).toBeNull();

      // Restore console.error
      console.error = originalConsoleError;
    });
  });

  describe('getUser', () => {
    it('should throw error if management client is not initialized', async () => {
      clinicAuth0Service.managementClient = null;
      
      await expect(clinicAuth0Service.getUser('auth0|123456')).rejects.toThrow('Auth0 Management client is not initialized');
    });
  });
}); 