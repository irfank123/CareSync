// The simplest possible script to get a Google refresh token
// Run with: node src/scripts/super-simple-token.mjs YOUR_CLIENT_ID YOUR_CLIENT_SECRET

import { google } from 'googleapis';
import readline from 'readline';
import dotenv from 'dotenv';

// Load env variables, but we'll also accept direct command line args
dotenv.config();

// Get credentials from command line or .env
const clientId = process.argv[2] || process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.argv[3] || process.env.GOOGLE_CLIENT_SECRET;

if (!clientId || !clientSecret) {
  console.error('ERROR: Google credentials are missing!');
  console.error('Run this script with your credentials:');
  console.error('node src/scripts/super-simple-token.mjs YOUR_CLIENT_ID YOUR_CLIENT_SECRET');
  console.error('OR make sure your .env file has GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
  process.exit(1);
}

// Create OAuth client - using out-of-band flow (no redirect needed)
const oAuth2Client = new google.auth.OAuth2(
  clientId, 
  clientSecret,
  'urn:ietf:wg:oauth:2.0:oob'  // This special URI means "out of band" (copy/paste code)
);

// Generate the URL for user authorization
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline',
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  prompt: 'consent'  // Force consent screen to always get refresh token
});

// Create interface to read user input
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('\n===== GOOGLE OAUTH TOKEN GENERATOR =====\n');
console.log('1. Visit this URL in your browser:');
console.log('\x1b[36m%s\x1b[0m', authUrl);  // URL in cyan
console.log('\n2. Sign in with your Google account');
console.log('3. After granting permissions, you\'ll see a code');
console.log('4. Copy that code here\n');

// Get the code from user
rl.question('Enter the code: ', async (code) => {
  try {
    // Exchange code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    
    if (tokens.refresh_token) {
      console.log('\n\x1b[32mSUCCESS! Here\'s your refresh token:\x1b[0m\n');  // Green text
      console.log('\x1b[33m%s\x1b[0m', tokens.refresh_token);  // Token in yellow
      console.log('\nRun this to save it to your clinic:');
      console.log('node src/scripts/setClinicGoogleToken.mjs', tokens.refresh_token);
    } else {
      console.log('\n\x1b[31mWARNING: No refresh token received!\x1b[0m');  // Red text
      console.log('This usually happens because you previously authorized this app.');
      console.log('To fix this:');
      console.log('1. Go to https://myaccount.google.com/permissions');
      console.log('2. Find your app and revoke its access');
      console.log('3. Run this script again');
    }
  } catch (error) {
    console.error('\n\x1b[31mERROR:\x1b[0m', error.message);
    if (error.message.includes('invalid_grant')) {
      console.log('The code you entered is invalid or expired. Please try again.');
    }
  } finally {
    rl.close();
  }
}); 