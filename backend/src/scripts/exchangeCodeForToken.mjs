// Script to manually exchange a Google authorization code for tokens
// Run with: node src/scripts/exchangeCodeForToken.mjs AUTHORIZATION_CODE

import dotenv from 'dotenv';
import { google } from 'googleapis';
import mongoose from 'mongoose';
import Clinic from '../models/Clinic.mjs';
import { encryptToken } from '../utils/encryption.mjs';
import loadAndValidateConfig from '../config/config.mjs';

// Load environment variables
dotenv.config();
const config = loadAndValidateConfig();

// Check if Google OAuth is properly configured
if (!config.google || !config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
  console.error('Google OAuth environment variables not properly configured.');
  process.exit(1);
}

async function exchangeCodeForToken() {
  try {
    // Get the authorization code from command line arguments
    const authCode = process.argv[2];
    
    if (!authCode) {
      console.error('Please provide an authorization code as a command line argument');
      console.error('Usage: node src/scripts/exchangeCodeForToken.mjs AUTHORIZATION_CODE');
      process.exit(1);
    }
    
    console.log('Authorization code:', authCode);
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,
      config.google.clientSecret,
      config.google.redirectUri
    );
    
    // Exchange the authorization code for tokens
    console.log('Exchanging authorization code for tokens...');
    const { tokens } = await oauth2Client.getToken(authCode);
    
    console.log('Tokens received:', {
      has_access_token: !!tokens.access_token,
      access_token_prefix: tokens.access_token ? tokens.access_token.substring(0, 10) + '...' : '',
      has_refresh_token: !!tokens.refresh_token,
      refresh_token_prefix: tokens.refresh_token ? tokens.refresh_token.substring(0, 10) + '...' : '',
      expires_in: tokens.expires_in,
      token_type: tokens.token_type
    });
    
    if (!tokens.refresh_token) {
      console.error('No refresh token received! This usually happens when:');
      console.error('1. The user has already authorized this application before');
      console.error('2. The prompt=consent parameter was not included in the authorization URL');
      console.error('3. The access_type=offline parameter was not included in the authorization URL');
      console.error('\nTo fix this, the user should:');
      console.error('1. Go to https://myaccount.google.com/permissions');
      console.error('2. Revoke access for your application');
      console.error('3. Try the authorization flow again');
      process.exit(1);
    }
    
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find the first clinic in the database
    const clinic = await Clinic.findOne();
    
    if (!clinic) {
      console.error('No clinic found in database');
      process.exit(1);
    }
    
    console.log(`Found clinic: ${clinic.name || 'Unnamed'} (${clinic._id})`);
    
    // Encrypt the refresh token
    const encryptedToken = encryptToken(tokens.refresh_token);
    
    // Update the clinic directly
    const result = await Clinic.updateOne(
      { _id: clinic._id },
      { $set: { googleRefreshToken: encryptedToken } }
    );
    
    console.log('Update result:', result);
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Successfully saved refresh token for clinic ${clinic._id}`);
      
      // Verify it was saved
      const updatedClinic = await Clinic.findById(clinic._id).select('googleRefreshToken');
      console.log('Token saved:', !!updatedClinic.googleRefreshToken);
    } else {
      console.log('⚠️ No changes were made to the clinic record');
    }
    
    console.log('\nYour refresh token is:');
    console.log('======================');
    console.log(tokens.refresh_token);
    console.log('======================');
    console.log('This token has been saved to your clinic in the database.');
    console.log('You can now use it to generate Google Meet links for appointments.');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
      console.log('MongoDB connection closed');
    }
  }
}

exchangeCodeForToken(); 