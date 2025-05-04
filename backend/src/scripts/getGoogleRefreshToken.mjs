// Script to obtain a Google refresh token
// Usage: node --require dotenv/config src/scripts/getGoogleRefreshToken.mjs

import express from 'express';
import { google } from 'googleapis';
import open from 'open';
import loadAndValidateConfig from '../config/config.mjs';

const config = loadAndValidateConfig();

const app = express();
const PORT = 3001; // Different from your main app port

// Create OAuth2 client
const oAuth2Client = new google.auth.OAuth2(
  config.google.clientId,
  config.google.clientSecret,
  `http://localhost:${PORT}/oauth2callback` // Local redirect URI for this script only
);

// Generate an authentication URL
const authUrl = oAuth2Client.generateAuthUrl({
  access_type: 'offline', // 'offline' gets us a refresh token
  scope: [
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/calendar.events'
  ],
  prompt: 'consent' // Force consent screen to ensure we get a refresh token
});

console.log('⚠️ IMPORTANT: Make sure you have added this exact redirect URI to your Google Cloud Console:');
console.log(`http://localhost:${PORT}/oauth2callback`);

// Route to handle the OAuth callback
app.get('/oauth2callback', async (req, res) => {
  try {
    const { code } = req.query;
    
    console.log('Authorization code received...');
    
    // Exchange the authorization code for tokens
    const { tokens } = await oAuth2Client.getToken(code);
    
    console.log('\n✅ Authentication successful!');
    
    if (tokens.refresh_token) {
      console.log('\n🔑 Your refresh token:');
      console.log('------------------------------------------------------------');
      console.log(tokens.refresh_token);
      console.log('------------------------------------------------------------');
      console.log('\nStore this token securely and use it with the setClinicGoogleToken.mjs script:');
      console.log(`node --require dotenv/config src/scripts/setClinicGoogleToken.mjs ${tokens.refresh_token}`);
    } else {
      console.log('\n⚠️ No refresh token received! Make sure to:');
      console.log('1. Revoke access at https://myaccount.google.com/permissions');
      console.log('2. Delete browser cookies for Google');
      console.log('3. Run this script again');
    }
    
    res.send('Authentication successful! You can close this window and check the console for your refresh token.');
    
    // Give the response time to send before shutting down
    setTimeout(() => {
      server.close(() => {
        console.log('\nServer closed.');
        process.exit(0);
      });
    }, 1000);
  } catch (error) {
    console.error('Error getting tokens:', error);
    res.status(500).send('Authentication failed! See console for details.');
  }
});

// Start the server
const server = app.listen(PORT, () => {
  console.log(`\n🔐 Google OAuth Token Generator`);
  console.log(`Server is running at http://localhost:${PORT}`);
  console.log('\nOpening browser for Google authentication...');
  
  // Open the auth URL in the default browser
  open(authUrl);
});

// Handle server errors
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use. Try a different port.`);
  } else {
    console.error('Server error:', err);
  }
  process.exit(1);
}); 