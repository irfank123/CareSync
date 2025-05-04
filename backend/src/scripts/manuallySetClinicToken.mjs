// Script to manually set a Google refresh token for a clinic
// Run with: node src/scripts/manuallySetClinicToken.mjs YOUR_REFRESH_TOKEN

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Clinic from '../models/Clinic.mjs';
import { encryptToken } from '../utils/encryption.mjs';
import loadAndValidateConfig from '../config/config.mjs';

// Load environment variables
dotenv.config();
const config = loadAndValidateConfig();

async function setClinicToken() {
  try {
    // Get the refresh token from command line arguments
    const refreshToken = process.argv[2];
    
    if (!refreshToken) {
      console.error('Please provide a refresh token as a command line argument');
      console.error('Usage: node src/scripts/manuallySetClinicToken.mjs YOUR_REFRESH_TOKEN');
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
    
    // Encrypt the token
    const encryptedToken = encryptToken(refreshToken);
    
    // Update the clinic directly - bypassing validation
    const result = await Clinic.updateOne(
      { _id: clinic._id },
      { $set: { googleRefreshToken: encryptedToken } }
    );
    
    console.log('Update result:', result);
    
    if (result.modifiedCount > 0) {
      console.log(`✅ Successfully set Google token for clinic ${clinic._id}`);
      
      // Verify it was saved
      const updatedClinic = await Clinic.findById(clinic._id).select('googleRefreshToken');
      console.log('Token saved:', !!updatedClinic.googleRefreshToken);
    } else {
      console.log('⚠️ No changes were made to the clinic record');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
  }
}

setClinicToken(); 