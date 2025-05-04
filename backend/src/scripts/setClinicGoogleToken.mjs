// Script to set a Google refresh token for a clinic (development only)
// Usage: node --require dotenv/config src/scripts/setClinicGoogleToken.mjs

import mongoose from 'mongoose';
import crypto from 'crypto';
import Clinic from '../models/Clinic.mjs';
import loadAndValidateConfig from '../config/config.mjs';

const config = loadAndValidateConfig();

// AES encryption for the refresh token
const encryptToken = (token) => {
  if (!config.google.refreshTokenEncryptionKey) return token;
  
  try {
    const algorithm = 'aes-256-cbc';
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(
      algorithm, 
      Buffer.from(config.google.refreshTokenEncryptionKey, 'hex'), 
      iv
    );
    
    let encrypted = cipher.update(token, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (error) {
    console.error('Error encrypting token:', error);
    return token;
  }
};

const main = async () => {
  try {
    // Connect to the database
    await mongoose.connect(config.mongoURI, {
      useNewUrlParser: true,
      useUnifiedTopology: true
    });
    
    console.log('Connected to MongoDB');
    
    // Get the first clinic in the database
    const clinic = await Clinic.findOne({});
    
    if (!clinic) {
      console.error('No clinic found in database');
      process.exit(1);
    }
    
    console.log(`Found clinic: ${clinic.name} (${clinic._id})`);
    
    // Get the refresh token from the command line arguments or use a default for development
    const refreshToken = process.argv[2] || 'REPLACE_WITH_YOUR_REFRESH_TOKEN';
    
    if (refreshToken === 'REPLACE_WITH_YOUR_REFRESH_TOKEN') {
      console.error('Please provide a valid refresh token as a command line argument');
      console.error('Usage: node --require dotenv/config src/scripts/setClinicGoogleToken.mjs YOUR_REFRESH_TOKEN');
      process.exit(1);
    }
    
    // Encrypt the refresh token
    const encryptedToken = encryptToken(refreshToken);
    
    // Update the clinic with the encrypted token
    await Clinic.findByIdAndUpdate(clinic._id, { googleRefreshToken: encryptedToken });
    
    console.log(`Successfully updated clinic ${clinic.name} with Google refresh token.`);
    console.log('You can now use the clinic token for Google Calendar integration.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.connection.close();
    console.log('MongoDB connection closed');
  }
};

main(); 