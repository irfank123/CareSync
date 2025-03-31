// src/services/tokenBlacklistService.mjs

import mongoose from 'mongoose';
import config from '../config/config.mjs';

// Define the schema for blacklisted tokens
const BlacklistedTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    index: true
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Create TTL index to automatically remove expired tokens
BlacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Create the model if it doesn't exist yet
const BlacklistedToken = mongoose.models.BlacklistedToken || 
  mongoose.model('BlacklistedToken', BlacklistedTokenSchema);

/**
 * Service to manage token blacklisting for logout
 */
class TokenBlacklistService {
  /**
   * Add a token to the blacklist
   * @param {string} token - JWT token to blacklist
   * @param {string} userId - User ID associated with the token
   * @param {Date} expiresAt - When the token expires
   * @returns {Promise<boolean>} Success status
   */
  async addToBlacklist(token, userId, expiresAt) {
    try {
      // Handle case where expiry is not provided
      if (!expiresAt) {
        // Default to config TTL or 24 hours
        expiresAt = new Date(Date.now() + (config.auth.tokenBlacklistTTL || 86400) * 1000);
      }
      
      await BlacklistedToken.create({
        token,
        userId,
        expiresAt
      });
      
      return true;
    } catch (error) {
      // Handle duplicate key error gracefully (token already blacklisted)
      if (error.code === 11000) {
        return true;
      }
      
      console.error('Error adding token to blacklist:', error);
      throw new Error('Failed to blacklist token');
    }
  }
  
  /**
   * Check if a token is blacklisted
   * @param {string} token - JWT token to check
   * @returns {Promise<boolean>} True if token is blacklisted
   */
  async isBlacklisted(token) {
    try {
      const blacklistedToken = await BlacklistedToken.findOne({ token });
      return !!blacklistedToken;
    } catch (error) {
      console.error('Error checking token blacklist:', error);
      // Default to not blacklisted on error to prevent lockout
      return false;
    }
  }
  
  /**
   * Clear expired tokens from the blacklist
   * @returns {Promise<number>} Number of tokens removed
   */
  async clearExpiredTokens() {
    try {
      const result = await BlacklistedToken.deleteMany({
        expiresAt: { $lt: new Date() }
      });
      
      return result.deletedCount;
    } catch (error) {
      console.error('Error clearing expired tokens:', error);
      throw new Error('Failed to clear expired tokens');
    }
  }
  
  /**
   * Blacklist all tokens for a user
   * @param {string} userId - User ID to blacklist all tokens for
   * @returns {Promise<boolean>} Success status
   */
  async blacklistAllUserTokens(userId) {
    try {
      // We don't actually delete tokens here, just make sure any new ones
      // with this userId are blacklisted with a far-future expiry
      const futureDate = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000); // 1 year
      
      await BlacklistedToken.create({
        token: `all_tokens_for_${userId}`,
        userId,
        expiresAt: futureDate
      });
      
      return true;
    } catch (error) {
      console.error('Error blacklisting all user tokens:', error);
      throw new Error('Failed to blacklist user tokens');
    }
  }
}

export default new TokenBlacklistService();