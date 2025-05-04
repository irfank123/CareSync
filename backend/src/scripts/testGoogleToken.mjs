// Script to test if the Google refresh token is valid
// Run with: node src/scripts/testGoogleToken.mjs YOUR_MONGO_URI

import mongoose from 'mongoose';
import { google } from 'googleapis';
import loadAndValidateConfig from '../config/config.mjs'; // Import config loader

// Load the application configuration
const config = loadAndValidateConfig();

async function testToken() {
  // Get MongoDB URI from command line arguments
  const mongoUri = process.argv[2];
  
  if (!mongoUri) {
    console.error('❌ ERROR: Please provide a MongoDB URI as an argument');
    console.error('Usage: node src/scripts/testGoogleToken.mjs MONGO_URI');
    process.exit(1);
  }
  
  // Check if Google config is loaded properly
  if (!config.google || !config.google.clientId || !config.google.clientSecret || !config.google.redirectUri) {
    console.error('❌ ERROR: Google OAuth configuration (GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI) is missing in your .env file or environment.');
    process.exit(1);
  }
  
  console.log('Using Google Client ID:', config.google.clientId.substring(0, 10) + '...');

  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Define a simplified Clinic schema for this script
    const clinicSchema = new mongoose.Schema({
      name: String,
      googleRefreshToken: String
    });
    
    // Create a model (or use existing one)
    const Clinic = mongoose.models.Clinic || mongoose.model('Clinic', clinicSchema);
    
    // Find the first clinic
    const clinic = await Clinic.findOne();
    
    if (!clinic) {
      console.error('❌ No clinic found in the database!');
      process.exit(1);
    }
    
    console.log(`Found clinic: ${clinic.name || clinic._id}`);
    
    if (!clinic.googleRefreshToken) {
      console.error('❌ This clinic has no Google refresh token set!');
      process.exit(1);
    }
    
    let refreshToken = clinic.googleRefreshToken;
    console.log('Google refresh token found (raw):', refreshToken.substring(0, 15) + '...');
    
    // Handle potential encryption (basic check)
    if (refreshToken.includes(':') && config.google.refreshTokenEncryptionKey) {
        console.log('Token appears encrypted, attempting decryption...');
        try {
            // Dynamically import decryptToken
            const { decryptToken } = await import('../utils/encryption.mjs');
            const decrypted = decryptToken(refreshToken);
            if (decrypted) {
                refreshToken = decrypted;
                console.log('Decryption successful:', refreshToken.substring(0, 15) + '...');
            } else {
                 console.warn('Decryption failed, using token as is.');
            }
        } catch (e) {
            console.warn('Failed to import or run decryptToken, using token as is:', e.message);
        }
    } else if (refreshToken.includes(':')) {
         console.warn('Token looks encrypted, but REFRESH_TOKEN_ENCRYPTION_KEY is missing. Using token as is.');
    } else {
        console.log('Using non-encrypted refresh token.');
    }

    // Try to create a Google OAuth client with the token using loaded config
    console.log('Testing the refresh token with loaded credentials...');
    
    const oauth2Client = new google.auth.OAuth2(
      config.google.clientId,       // Use loaded Client ID
      config.google.clientSecret,    // Use loaded Client Secret
      config.google.redirectUri      // Use loaded Redirect URI
    );
    
    // Set credentials directly with the potentially decrypted refresh token
    oauth2Client.setCredentials({
      refresh_token: refreshToken
    });
    
    // Try to get an access token
    console.log('Requesting access token using the refresh token...');
    const result = await oauth2Client.getAccessToken();
    
    if (result && result.token) {
      console.log('✅ SUCCESS! The refresh token is valid with the configured credentials.');
      console.log('Access token obtained:', result.token.substring(0, 10) + '...');
      
      // Try a simple Calendar API call
      console.log('Testing Calendar API access...');
      const calendar = google.calendar({ version: 'v3', auth: oauth2Client });
      const calendarList = await calendar.calendarList.list();
      
      console.log('✅ Successfully accessed Calendar API!');
      console.log(`Found ${calendarList.data.items.length} calendars.`);
    } else {
      console.error('❌ Failed to obtain an access token. The refresh token may be invalid or the client credentials mismatch.');
    }
    
  } catch (error) {
    console.error('❌ Error during token test:', error.message);
    if (error.response && error.response.data) {
      console.error('Google API Error Details:', JSON.stringify(error.response.data));
      if (error.response.data.error === 'invalid_grant') {
          console.error('\n >> HINT: invalid_grant usually means the refresh token itself is invalid, expired, or has been revoked. You may need to re-authenticate the clinic.');
      } else if (error.response.data.error === 'invalid_client') {
           console.error('\n >> HINT: invalid_client means your GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET in the .env file is incorrect or does not match the project where the token was generated.');
      }
    } else if (error.message.includes('ENOTFOUND') || error.message.includes('ECONNREFUSED')) {
        console.error('\n >> HINT: Network error connecting to Google. Check internet connection and DNS settings.');
    }
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

testToken(); 