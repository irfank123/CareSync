// --- Mongoose Mocking Setup ---

jest.mock('mongoose', () => {
  const originalMongoose = jest.requireActual('mongoose');

  // Define the mock operations object *inside* the factory to avoid hoisting issues
  const mockOpsForBlacklistedToken = {
    create: jest.fn(),
    findOne: jest.fn(),
    deleteMany: jest.fn(),
  };

  return {
    ...originalMongoose,
    Schema: originalMongoose.Schema,
    Types: originalMongoose.Types,
    ObjectId: originalMongoose.Types.ObjectId,
    model: jest.fn((modelName, schema) => {
      if (modelName === 'BlacklistedToken') {
        return mockOpsForBlacklistedToken; // Return the in-scope mock operations object
      }
      return originalMongoose.model(modelName, schema);
    }),
    models: {},
    connect: originalMongoose.connect,
    connection: originalMongoose.connection,
  };
});

// --- Config Mocking Setup ---
jest.mock('../../src/config/config.mjs', () => ({
  auth: {
    tokenBlacklistTTL: 3600, // Default mock TTL (1 hour in seconds)
  },
  // Add other necessary config mocks if the service depends on them
}));

// --- End Mocking Setup ---

// Import mongoose *after* jest.mock has been defined.
// This 'mongoose' will be the mocked version.
import mongoose from 'mongoose';
// Now import the service. It will pick up the mocked Mongoose.
import tokenBlacklistServiceInstance from '../../src/services/tokenBlacklistService.mjs';
import config from '../../src/config/config.mjs'; // Will be the mocked config

// Retrieve the mock operations object that our mocked mongoose.model returns.
// This allows us to access its mock functions (create, findOne, deleteMany) for setup and assertions.
const blacklistedTokenMockOps = mongoose.model('BlacklistedToken');

// For creating ObjectId in tests, we should use the *actual* mongoose ObjectId.
// jest.requireActual can be used here if needed, or ensure the mock passes it through correctly.
// The mock setup above passes originalMongoose.Types.ObjectId as mongoose.Types.ObjectId.
const actualMongooseTypes = jest.requireActual('mongoose').Types;

describe('TokenBlacklistService - Singleton with Global Mongoose Mock (Hoisting Fixed)', () => {
  beforeEach(() => {
    // Reset the mock function calls on our retrieved mock model operations object
    blacklistedTokenMockOps.create.mockReset();
    blacklistedTokenMockOps.findOne.mockReset();
    blacklistedTokenMockOps.deleteMany.mockReset();
  });

  describe('addToBlacklist', () => {
    const token = 'test-token-123';
    const userId = new actualMongooseTypes.ObjectId(); 
    const expiresAt = new Date(Date.now() + 10000);

    test('should add token with provided expiry', async () => {
      blacklistedTokenMockOps.create.mockResolvedValue({ token, userId, expiresAt });
      const result = await tokenBlacklistServiceInstance.addToBlacklist(token, userId, expiresAt);
      expect(result).toBe(true);
      expect(blacklistedTokenMockOps.create).toHaveBeenCalledWith({
        token,
        userId,
        expiresAt,
      });
    });

    test('should add token with default expiry if none provided', async () => {
      blacklistedTokenMockOps.create.mockResolvedValue({});
      const result = await tokenBlacklistServiceInstance.addToBlacklist(token, userId, null);
      expect(result).toBe(true);
      expect(blacklistedTokenMockOps.create).toHaveBeenCalledWith({
        token,
        userId,
        expiresAt: expect.any(Date),
      });
      const callArgs = blacklistedTokenMockOps.create.mock.calls[0][0];
      const expectedExpiryRough = Date.now() + config.auth.tokenBlacklistTTL * 1000;
      expect(callArgs.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiryRough - 1000);
      expect(callArgs.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiryRough + 1000);
    });

    test('should return true if token already exists (error code 11000)', async () => {
      const duplicateError = new Error('Duplicate key');
      duplicateError.code = 11000;
      blacklistedTokenMockOps.create.mockRejectedValue(duplicateError);
      const result = await tokenBlacklistServiceInstance.addToBlacklist(token, userId, expiresAt);
      expect(result).toBe(true);
    });

    test('should throw error for other database errors', async () => {
      const dbError = new Error('Database connection lost');
      blacklistedTokenMockOps.create.mockRejectedValue(dbError);
      await expect(tokenBlacklistServiceInstance.addToBlacklist(token, userId, expiresAt)).rejects.toThrow(
        'Failed to blacklist token'
      );
    });
  });

  describe('isBlacklisted', () => {
    const token = 'check-token-456';

    test('should return true if token is found', async () => {
      blacklistedTokenMockOps.findOne.mockResolvedValue({ token, expiresAt: new Date() });
      const result = await tokenBlacklistServiceInstance.isBlacklisted(token);
      expect(result).toBe(true);
      expect(blacklistedTokenMockOps.findOne).toHaveBeenCalledWith({ token });
    });

    test('should return false if token is not found', async () => {
      blacklistedTokenMockOps.findOne.mockResolvedValue(null);
      const result = await tokenBlacklistServiceInstance.isBlacklisted(token);
      expect(result).toBe(false);
      expect(blacklistedTokenMockOps.findOne).toHaveBeenCalledWith({ token });
    });

    test('should return false on database error', async () => {
      const dbError = new Error('DB error during find');
      blacklistedTokenMockOps.findOne.mockRejectedValue(dbError);
      const result = await tokenBlacklistServiceInstance.isBlacklisted(token);
      expect(result).toBe(false);
      expect(blacklistedTokenMockOps.findOne).toHaveBeenCalledWith({ token });
    });
  });

  describe('clearExpiredTokens', () => {
    test('should call deleteMany with correct query', async () => {
      const deleteResult = { deletedCount: 5 };
      blacklistedTokenMockOps.deleteMany.mockResolvedValue(deleteResult);
      const result = await tokenBlacklistServiceInstance.clearExpiredTokens();
      expect(result).toBe(5);
      expect(blacklistedTokenMockOps.deleteMany).toHaveBeenCalledWith({
        expiresAt: { $lt: expect.any(Date) },
      });
    });

    test('should throw error on database failure', async () => {
      const dbError = new Error('DB error during delete');
      blacklistedTokenMockOps.deleteMany.mockRejectedValue(dbError);
      await expect(tokenBlacklistServiceInstance.clearExpiredTokens()).rejects.toThrow(
        'Failed to clear expired tokens'
      );
    });
  });
  
  describe('blacklistAllUserTokens', () => {
    const userId = new actualMongooseTypes.ObjectId();

    test('should create a sentinel token for the user', async () => {
        blacklistedTokenMockOps.create.mockResolvedValue({});
        const result = await tokenBlacklistServiceInstance.blacklistAllUserTokens(userId);
        expect(result).toBe(true);
        expect(blacklistedTokenMockOps.create).toHaveBeenCalledWith({
            token: `all_tokens_for_${userId}`,
            userId,
            expiresAt: expect.any(Date)
        });
        const callArgs = blacklistedTokenMockOps.create.mock.calls[0][0];
        const expectedExpiryRough = Date.now() + 365 * 24 * 60 * 60 * 1000;
        expect(callArgs.expiresAt.getTime()).toBeGreaterThanOrEqual(expectedExpiryRough - 5000); 
        expect(callArgs.expiresAt.getTime()).toBeLessThanOrEqual(expectedExpiryRough + 5000); 
    });

    test('should throw error on database failure', async () => {
        const dbError = new Error('DB error creating sentinel');
        blacklistedTokenMockOps.create.mockRejectedValue(dbError);
        await expect(tokenBlacklistServiceInstance.blacklistAllUserTokens(userId)).rejects.toThrow(
            'Failed to blacklist user tokens'
        );
    });
  });
}); 