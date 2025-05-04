// Script to exchange a Google authorization code for tokens (without database)
// Run with: node src/scripts/getRefreshToken.mjs AUTHORIZATION_CODE

import dotenv from 'dotenv';
import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.join(rootDir, '.env');

// Load environment variables
dotenv.config({ path: envPath });

// Extract environment variables directly
const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3001/oauth2callback';

// Check if Google OAuth is properly configured
if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
  console.error('Google OAuth client ID or client secret not configured.');
  process.exit(1);
}

console.log('Google OAuth Configuration:');
console.log(`  Client ID: ${GOOGLE_CLIENT_ID ? (GOOGLE_CLIENT_ID.substring(0, 10) + '...') : 'Missing'}`);
console.log(`  Client Secret: ${GOOGLE_CLIENT_SECRET ? 'Set (hidden)' : 'Missing'}`);
console.log(`  Redirect URI: ${GOOGLE_REDIRECT_URI}`);
console.log('\n');

async function getRefreshToken() {
  try {
    // Get the authorization code from command line arguments
    const authCode = process.argv[2];
    
    if (!authCode) {
      console.error('Please provide an authorization code as a command line argument');
      console.error('Usage: node src/scripts/getRefreshToken.mjs AUTHORIZATION_CODE');
      process.exit(1);
    }
    
    console.log('Authorization code:', authCode.substring(0, 15) + '...');
    
    // Create OAuth client
    const oauth2Client = new google.auth.OAuth2(
      GOOGLE_CLIENT_ID,
      GOOGLE_CLIENT_SECRET,
      GOOGLE_REDIRECT_URI
    );
    
    // Exchange the authorization code for tokens
    console.log('Exchanging authorization code for tokens...');
    
    try {
      const { tokens } = await oauth2Client.getToken(authCode);
      
      console.log('\nTokens received!');
      console.log('  Access Token: ' + (tokens.access_token ? '✅ Present' : '❌ Missing'));
      console.log('  Refresh Token: ' + (tokens.refresh_token ? '✅ Present' : '❌ Missing'));
      console.log('  Expires In: ' + (tokens.expires_in || 'N/A'));
      
      if (tokens.refresh_token) {
        console.log('\n✅ SUCCESS! Your refresh token is:');
        console.log('==============================================');
        console.log(tokens.refresh_token);
        console.log('==============================================');
        console.log('\nTo save this token to your clinic, run:');
        console.log(`node src/scripts/manuallySetClinicToken.mjs "${tokens.refresh_token}"`);
      } else {
        console.error('\n❌ No refresh token received!');
        console.error('This usually happens when:');
        console.error('1. The user has already authorized this application before');
        console.error('2. The prompt=consent parameter was not included in the authorization URL');
        console.error('3. The access_type=offline parameter was not included in the authorization URL');
        console.error('\nTo fix this, the user should:');
        console.error('1. Go to https://myaccount.google.com/permissions');
        console.error('2. Revoke access for your application');
        console.error('3. Try the authorization flow again');
      }
    } catch (tokenError) {
      console.error('Error exchanging code for tokens:', tokenError.message);
      
      if (tokenError.message.includes('invalid_grant')) {
        console.error('\nThis authorization code has already been used or has expired.');
        console.error('Authorization codes can only be used once and typically expire after a short time.');
        console.error('Please get a new authorization code and try again.');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

getRefreshToken(); 