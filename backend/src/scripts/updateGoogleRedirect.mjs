// Script to update Google redirect URI in .env file
// Run with: node src/scripts/updateGoogleRedirect.mjs

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '../../');
const envPath = path.join(rootDir, '.env');

// The correct redirect URI that will be used by our code
const CORRECT_REDIRECT_URI = 'http://localhost:3001/oauth2callback';

async function updateRedirectUri() {
  console.log('=== Updating Google Redirect URI ===');
  
  // Load current environment variables
  dotenv.config();
  
  // Check if .env file exists
  if (!fs.existsSync(envPath)) {
    console.error(`❌ .env file not found at ${envPath}`);
    console.log('Creating a new .env file with the correct Google redirect URI...');
    
    const envContent = `
# Google OAuth Configuration
GOOGLE_CLIENT_ID=${process.env.GOOGLE_CLIENT_ID || ''}
GOOGLE_CLIENT_SECRET=${process.env.GOOGLE_CLIENT_SECRET || ''}
GOOGLE_REDIRECT_URI=${CORRECT_REDIRECT_URI}
REFRESH_TOKEN_ENCRYPTION_KEY=${process.env.REFRESH_TOKEN_ENCRYPTION_KEY || ''}
`;
    
    fs.writeFileSync(envPath, envContent);
    console.log('✅ Created .env file with correct redirect URI');
    return;
  }
  
  // Read current .env content
  let envContent = fs.readFileSync(envPath, 'utf-8');
  
  // Current redirect URI from environment
  const currentRedirectUri = process.env.GOOGLE_REDIRECT_URI || '';
  
  console.log('Current redirect URI:', currentRedirectUri);
  console.log('Correct redirect URI:', CORRECT_REDIRECT_URI);
  
  if (currentRedirectUri === CORRECT_REDIRECT_URI) {
    console.log('✅ Redirect URI is already correct!');
    return;
  }
  
  // Replace or add the redirect URI
  if (envContent.includes('GOOGLE_REDIRECT_URI=')) {
    // Replace existing value
    envContent = envContent.replace(
      /GOOGLE_REDIRECT_URI=.*/,
      `GOOGLE_REDIRECT_URI=${CORRECT_REDIRECT_URI}`
    );
  } else {
    // Add new line with the correct URI
    envContent += `\nGOOGLE_REDIRECT_URI=${CORRECT_REDIRECT_URI}\n`;
  }
  
  // Save updated .env file
  fs.writeFileSync(envPath, envContent);
  
  console.log(`✅ Updated .env file with correct Google redirect URI: ${CORRECT_REDIRECT_URI}`);
  console.log('Please restart your server for the changes to take effect!');
}

updateRedirectUri(); 