import crypto from 'crypto';

// --- Test-specific constants ---
const MOCK_VALID_HEX_KEY = 'a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8a1b2c3d4e5f6a7b8'; // 64 hex chars / 32 bytes
const MOCK_SHORT_HEX_KEY = 'a1b2c3';
// Changed: Using a single invalid char that also makes length odd, to robustly trigger Buffer.from error
const MOCK_INVALID_HEX_KEY = 'g'; 

// --- Mocking loadAndValidateConfig --- 
let mockConfigReturnValue;
jest.mock('@src/config/config.mjs', () => ({
  __esModule: true,
  default: jest.fn(() => mockConfigReturnValue),
}));

const importEncryptionModule = async () => {
  // Ensure mocks are fresh for each dynamic import if module relies on them at top level
  jest.doMock('@src/config/config.mjs', () => ({
    __esModule: true,
    default: jest.fn(() => mockConfigReturnValue),
  }));  
  const module = await import('@src/utils/encryption.mjs');
  return module;
};

describe('Encryption Utilities', () => {
  let encryptToken, decryptToken;

  const setupValidKey = async () => {
    mockConfigReturnValue = {
      google: {
        refreshTokenEncryptionKey: MOCK_VALID_HEX_KEY,
      },
    };
    // We need to reset modules here if we are changing the mock that the module uses at its top level scope
    jest.resetModules(); 
    const encryptionModule = await importEncryptionModule();
    encryptToken = encryptionModule.encryptToken;
    decryptToken = encryptionModule.decryptToken;
  };

  describe('Module Initialization Key Validation', () => {
    beforeEach(() => {
      jest.resetModules(); 
    });

    test('should throw error if refreshTokenEncryptionKey is missing in config', async () => {
      mockConfigReturnValue = { google: {} }; 
      await expect(importEncryptionModule()).rejects.toThrow(
        'Config loaded, but config.google.refreshTokenEncryptionKey is missing. Check .env and config.mjs.'
      );
    });

    test('should throw error if encryption key is not 32 bytes (64 hex characters)', async () => {
      mockConfigReturnValue = { google: { refreshTokenEncryptionKey: MOCK_SHORT_HEX_KEY } };
      await expect(importEncryptionModule()).rejects.toThrow(
        'Encryption key must be 32 bytes (64 hex characters) long, but got 3 bytes.'
      );
    });

    test('should correctly format error if Buffer.from itself throws for invalid hex', async () => {
      const originalBufferFrom = global.Buffer.from; // Store original global Buffer.from
      global.Buffer.from = jest.fn((value, encoding) => {
        if (value === MOCK_INVALID_HEX_KEY && encoding === 'hex') {
          throw new TypeError('Simulated Buffer.from error');
        }
        return originalBufferFrom(value, encoding); // Call original for other cases
      });

      mockConfigReturnValue = { google: { refreshTokenEncryptionKey: MOCK_INVALID_HEX_KEY } };
      
      await expect(importEncryptionModule()).rejects.toThrow(
        "Invalid REFRESH_TOKEN_ENCRYPTION_KEY format in config. Ensure it's a valid 64-character hex string. Error: Simulated Buffer.from error"
      );
      
      global.Buffer.from = originalBufferFrom; // Restore original global Buffer.from
    });

    test('should load successfully with a valid key', async () => {
        mockConfigReturnValue = { google: { refreshTokenEncryptionKey: MOCK_VALID_HEX_KEY } };
        await expect(importEncryptionModule()).resolves.toBeDefined();
    });
  });

  describe('with Valid Key Loaded', () => {
    // Setup valid key once for this entire describe block
    // This means encryption.mjs is imported once with a valid key setup here.
    beforeAll(async () => {
      // Call resetModules before setting up the valid key for this block
      // to ensure it doesn't interfere with `Module Initialization Key Validation` tests.
      jest.resetModules();
      mockConfigReturnValue = {
        google: {
          refreshTokenEncryptionKey: MOCK_VALID_HEX_KEY,
        },
      };
      const encryptionModule = await importEncryptionModule();
      encryptToken = encryptionModule.encryptToken;
      decryptToken = encryptionModule.decryptToken;
    });
    
    beforeEach(() => {
        global.console.error = jest.fn();
    });

    afterEach(() => {
        if (global.console.error.mockRestore) {
            global.console.error.mockRestore();
        }
    });

    describe('encryptToken', () => {
      test('should encrypt a token successfully', () => {
        const token = 'mySecretToken123';
        const encrypted = encryptToken(token);
        expect(encrypted).toBeDefined();
        expect(encrypted).not.toBeNull();
        expect(typeof encrypted).toBe('string');
        expect(encrypted.includes(':')).toBe(true);
      });

      test('should return null if token is null, undefined or empty', () => {
        expect(encryptToken(null)).toBeNull();
        expect(encryptToken(undefined)).toBeNull();
        expect(encryptToken('')).toBeNull();
      });
    });

    describe('decryptToken', () => {
      test('should decrypt an encrypted token successfully', () => {
        const originalToken = 'mySuperSecretData!@#';
        const encrypted = encryptToken(originalToken);
        expect(encrypted).not.toBeNull(); 
        const decrypted = decryptToken(encrypted);
        expect(decrypted).toBe(originalToken);
      });

      test('should return null and log error for malformed encrypted token (no colon)', () => {
        const malformedToken = 'abcdef1234567890';
        expect(decryptToken(malformedToken)).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error).toHaveBeenCalledWith('Invalid encrypted token format for decryption.');
      });

      test('should return null and log error for malformed encrypted token (bad hex for IV)', () => {
        const malformedToken = 'nothex:abcdef1234567890';
        expect(decryptToken(malformedToken)).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toBe('Decryption failed:');
        expect(console.error.mock.calls[0][1]).toBeDefined(); // Check that an error object was passed
      });
      
      test('should return null and log error for malformed encrypted token (bad hex for data)', () => {
        const iv = crypto.randomBytes(16).toString('hex');
        const malformedToken = `${iv}:nothexdata`;
        expect(decryptToken(malformedToken)).toBeNull();
        expect(console.error).toHaveBeenCalledTimes(1);
        expect(console.error.mock.calls[0][0]).toBe('Decryption failed:');
        expect(console.error.mock.calls[0][1]).toBeDefined(); // Check that an error object was passed
      });

      test('should return null if encryptedToken is null, undefined or empty', () => {
        expect(decryptToken(null)).toBeNull();
        expect(decryptToken(undefined)).toBeNull();
        expect(decryptToken('')).toBeNull();
        expect(console.error).not.toHaveBeenCalled(); 
      });
      
      test('should return different encrypted values for the same token (due to random IV)', () => {
        const token = 'testTokenForRandomness';
        const encrypted1 = encryptToken(token);
        const encrypted2 = encryptToken(token);
        expect(encrypted1).not.toBeNull();
        expect(encrypted2).not.toBeNull();
        expect(encrypted1).not.toEqual(encrypted2);
        expect(decryptToken(encrypted1)).toBe(token);
        expect(decryptToken(encrypted2)).toBe(token);
      });
    });
  });
}); 