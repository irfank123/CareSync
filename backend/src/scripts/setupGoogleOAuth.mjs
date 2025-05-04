// Script to help set up Google OAuth configuration
// Run with: node src/scripts/setupGoogleOAuth.mjs

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.join(rootDir, '.env');

async function setupGoogleOAuth() {
  console.log('=== Google OAuth Setup Guide ===');
  
  // Read current .env file if it exists
  let envContent = '';
  if (fs.existsSync(envPath)) {
    envContent = fs.readFileSync(envPath, 'utf-8');
  }
  
  // Extract current Google OAuth settings
  const clientId = process.env.GOOGLE_CLIENT_ID || '';
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET || '';
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5001/api/google/auth/callback';
  const encryptionKey = process.env.REFRESH_TOKEN_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
  
  console.log('\n1. Current Google OAuth Configuration:');
  console.log(`   Client ID: ${clientId ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Client Secret: ${clientSecret ? '✅ Set' : '❌ Missing'}`);
  console.log(`   Redirect URI: ${redirectUri}`);
  console.log(`   Encryption Key: ${encryptionKey ? '✅ Set' : '❌ Missing'}`);
  
  console.log('\n2. Google Cloud Console Setup Instructions:');
  console.log('   1. Go to https://console.cloud.google.com/');
  console.log('   2. Create a new project or select an existing one');
  console.log('   3. Navigate to "APIs & Services" > "Credentials"');
  console.log('   4. Click "Create Credentials" > "OAuth client ID"');
  console.log('   5. Application type: "Web application"');
  console.log('   6. Add the following to "Authorized redirect URIs":');
  console.log(`      ${redirectUri}`);
  console.log('   7. Copy the generated Client ID and Client Secret');
  
  console.log('\n3. Important Notes:');
  console.log('   - You must enable the Google Calendar API for your project');
  console.log('   - The redirect URI must exactly match what you configure in Google Cloud Console');
  console.log('   - You need to use access_type=offline and prompt=consent to get refresh tokens');
  
  // Generate a new encryption key if needed
  if (!process.env.REFRESH_TOKEN_ENCRYPTION_KEY) {
    console.log('\n4. Generated Encryption Key:');
    console.log(`   ${encryptionKey}`);
    console.log('   Add this to your .env file as REFRESH_TOKEN_ENCRYPTION_KEY');
  }
  
  // Generate example .env content
  const envExample = `
# Google OAuth Configuration
GOOGLE_CLIENT_ID=${clientId}
GOOGLE_CLIENT_SECRET=${clientSecret}
GOOGLE_REDIRECT_URI=${redirectUri}
REFRESH_TOKEN_ENCRYPTION_KEY=${encryptionKey}
`;
  
  console.log('\n5. Add these lines to your .env file:');
  console.log(envExample);
  
  console.log('\n6. Testing the Google OAuth Connection:');
  console.log('   1. Start your application');
  console.log('   2. Log in as a clinic admin user');
  console.log('   3. Visit the clinic dashboard');
  console.log('   4. Click "Connect Google Account"');
  console.log('   5. If successful, your clinic will have a token stored in MongoDB');
  console.log('   6. All doctors in the clinic can now use this token');
  
  console.log('\n=== End of Setup Guide ===');
}

setupGoogleOAuth(); 