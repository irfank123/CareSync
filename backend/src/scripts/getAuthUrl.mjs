// Script to generate a Google OAuth authorization URL
// Run with: node src/scripts/getAuthUrl.mjs

import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.join(rootDir, '.env');

// Try to load .env file directly
let clientId = '';
let clientSecret = '';
let redirectUri = 'http://localhost:3001/oauth2callback';

if (fs.existsSync(envPath)) {
  console.log(`Found .env file at ${envPath}`);
  const envFile = fs.readFileSync(envPath, 'utf8');
  
  // Parse client ID from env file
  const clientIdMatch = envFile.match(/GOOGLE_CLIENT_ID=([^\n]+)/);
  if (clientIdMatch && clientIdMatch[1]) {
    clientId = clientIdMatch[1];
    console.log('Found Google Client ID in .env file');
  }
  
  // Parse client secret from env file
  const clientSecretMatch = envFile.match(/GOOGLE_CLIENT_SECRET=([^\n]+)/);
  if (clientSecretMatch && clientSecretMatch[1]) {
    clientSecret = clientSecretMatch[1];
    console.log('Found Google Client Secret in .env file');
  }
  
  // Parse redirect URI from env file
  const redirectUriMatch = envFile.match(/GOOGLE_REDIRECT_URI=([^\n]+)/);
  if (redirectUriMatch && redirectUriMatch[1]) {
    redirectUri = redirectUriMatch[1];
    console.log('Found Google Redirect URI in .env file');
  }
} else {
  console.log('No .env file found');
}

// Use env variables if available and not already set
if (!clientId && process.env.GOOGLE_CLIENT_ID) {
  clientId = process.env.GOOGLE_CLIENT_ID;
}
if (!clientSecret && process.env.GOOGLE_CLIENT_SECRET) {
  clientSecret = process.env.GOOGLE_CLIENT_SECRET;
}
if (process.env.GOOGLE_REDIRECT_URI) {
  redirectUri = process.env.GOOGLE_REDIRECT_URI;
}

// Check if we have the necessary credentials
if (!clientId || !clientSecret) {
  console.error('❌ Missing Google OAuth credentials!');
  console.error('Please set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in your .env file');
  process.exit(1);
}

// Create OAuth client
const oauth2Client = new google.auth.OAuth2(
  clientId,
  clientSecret,
  redirectUri
);

// Define the required scopes for Google Calendar API
const scopes = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events'
];

// Generate a state parameter for security
const state = Math.random().toString(36).substring(2);

// Generate the auth URL with the right parameters to ensure we get a refresh token
const authUrl = oauth2Client.generateAuthUrl({
  access_type: 'offline',         // This is required to get a refresh token
  scope: scopes,
  prompt: 'consent',              // This forces the consent screen to appear
  include_granted_scopes: true,   // Include any previously granted scopes
  state: state                    // Security parameter
});

console.log('\n=== Google OAuth Authorization URL ===');
console.log('Open this URL in your browser to authorize:');
console.log('\n' + authUrl + '\n');
console.log('After authorizing, you will be redirected to:');
console.log(redirectUri);
console.log('\nCopy the "code" parameter from the redirect URL');
console.log('Then run: node src/scripts/getRefreshToken.mjs CODE');

// Instructions for what to do after getting the code
console.log('\n=== Next Steps ===');
console.log('1. Open the URL above in your browser');
console.log('2. Log in with your Google account and grant permissions');
console.log('3. You will be redirected to a URL that looks like:');
console.log(`   ${redirectUri}?state=${state}&code=4/XXXX...&scope=...`);
console.log('4. Copy the "code" parameter (everything after code= and before &scope)');
console.log('5. Run: node src/scripts/getRefreshToken.mjs YOUR_CODE_HERE');
console.log('6. After getting the refresh token, save it to your clinic:');
console.log('   node src/scripts/saveGoogleToken.mjs YOUR_REFRESH_TOKEN'); 