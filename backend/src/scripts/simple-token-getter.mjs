// A simple script to obtain Google OAuth tokens
// Run with: node --require dotenv/config src/scripts/simple-token-getter.mjs

import { google } from 'googleapis';
import readline from 'readline';
import loadAndValidateConfig from '../config/config.mjs';

const config = loadAndValidateConfig();

// Check if Google config is available
if (!config.google || !config.google.clientId || !config.google.clientSecret) {
  console.error('ERROR: Google credentials are missing in your .env file!');
  console.error('Please make sure you have the following in your .env file:');
  console.error('GOOGLE_CLIENT_ID=your_client_id_here');
  console.error('GOOGLE_CLIENT_SECRET=your_client_secret_here');
  process.exit(1);
}

// Create the OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  'urn:ietf:wg:oauth:2.0:oob' // Use out-of-band for simplicity (no redirect server needed)
);

// Generate the authorization URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  prompt: 'consent'
});

// Create readline interface for user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n==== GOOGLE OAUTH TOKEN GENERATOR ====\n');
console.log('Follow these steps to get your refresh token:\n');
console.log('1) Go to this URL in your browser:');
console.log('\x1b[36m%s\x1b[0m', authUrl); // Cyan color for URL
console.log('\n2) Sign in with your Google account');
console.log('3) Click "Continue" when prompted about permissions');
console.log('4) Copy the authorization code shown on the page\n');

// Prompt user for the authorization code
rl.question('Enter the authorization code: ', async (code) => {
  try {
    // Exchange the authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    
    console.log('\n\x1b[32m✓ Authentication successful!\x1b[0m\n'); // Green color
    
    if (tokens.refresh_token) {
      console.log('\x1b[33m==== YOUR REFRESH TOKEN ====\x1b[0m'); // Yellow color
      console.log('\x1b[33m%s\x1b[0m', tokens.refresh_token);
      console.log('\x1b[33m============================\x1b[0m\n');
      
      console.log('Run this command to save the token to your clinic:');
      console.log('\x1b[36mnode --require dotenv/config src/scripts/setClinicGoogleToken.mjs', tokens.refresh_token, '\x1b[0m\n');
    } else {
      console.log('\x1b[31m⚠ No refresh token received!\x1b[0m'); // Red color
      console.log('This typically happens if you have previously authorized this application.');
      console.log('To get a new refresh token:');
      console.log('1) Go to https://myaccount.google.com/permissions');
      console.log('2) Find and remove access for your application');
      console.log('3) Run this script again\n');
    }
    
  } catch (error) {
    console.error('\x1b[31m✗ Error getting tokens:\x1b[0m', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('\nThe authorization code may be invalid or expired. Please try again with a new code.');
    }
  } finally {
    rl.close();
  }
}); 