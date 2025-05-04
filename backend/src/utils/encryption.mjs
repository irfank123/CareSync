import crypto from 'crypto';
import loadAndValidateConfig from '../config/config.mjs';

// Call the function IMMEDIATELY to get the config object
const config = loadAndValidateConfig();

// Log the value right when the module loads
console.log('[DEBUG encryption.mjs] process.env.REFRESH_TOKEN_ENCRYPTION_KEY:', process.env.REFRESH_TOKEN_ENCRYPTION_KEY);

// Now safely access the key from the loaded config object
const secretKey = config.google.refreshTokenEncryptionKey;
const IV_LENGTH = 16; // For AES, this is always 16

// Check if the key was actually loaded
if (!secretKey) {
  // Throw a more specific error if the key is missing AFTER loading config
  throw new Error('Config loaded, but config.google.refreshTokenEncryptionKey is missing. Check .env and config.mjs.');
}

// --- Key Processing ---
let keyBuffer;
try {
    keyBuffer = Buffer.from(secretKey, 'hex'); // Use secretKey read from config
    if (keyBuffer.length !== 32) {
         throw new Error(`Encryption key must be 32 bytes (64 hex characters) long, but got ${keyBuffer.length} bytes.`);
    }
} catch (e) {
     throw new Error(`Invalid REFRESH_TOKEN_ENCRYPTION_KEY format in config. Ensure it's a valid 64-character hex string. Error: ${e.message}`);
}

export const encryptToken = (token) => {
  if (!token) return null;
  try {
    const iv = crypto.randomBytes(16); // For AES, this is always 16
    const cipher = crypto.createCipheriv('aes-256-cbc', keyBuffer, iv);
    let encrypted = cipher.update(token);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
  } catch (error) {
    console.error('Encryption failed:', error);
    return null;
  }
};

export const decryptToken = (encryptedToken) => {
  if (!encryptedToken) return null;
  try {
    if (!encryptedToken || typeof encryptedToken !== 'string' || !encryptedToken.includes(':')) {
      console.error('Invalid encrypted token format for decryption.');
      return null;
    }
    const textParts = encryptedToken.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto.createDecipheriv('aes-256-cbc', keyBuffer, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}; 