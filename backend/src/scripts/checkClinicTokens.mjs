// Script to check which clinics have Google refresh tokens
// Run with: node src/scripts/checkClinicTokens.mjs

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Clinic from '../models/Clinic.mjs';

// Load environment variables
dotenv.config();

async function checkClinicTokens() {
  try {
    // Connect to the database
    await mongoose.connect(process.env.MONGO_URI);
    console.log('Connected to MongoDB');
    
    // Find all clinics
    const clinics = await Clinic.find().select('name googleRefreshToken');
    
    console.log('\n=== Clinics with Google Tokens ===');
    let foundTokens = false;
    
    clinics.forEach(clinic => {
      const hasToken = !!clinic.googleRefreshToken;
      console.log(`- ${clinic.name || 'Unnamed Clinic'} (${clinic._id}): ${hasToken ? 'HAS TOKEN' : 'No token'}`);
      if (hasToken) foundTokens = true;
    });
    
    if (!foundTokens) {
      console.log('\nNo clinics have Google tokens stored. You need to authenticate a clinic first.');
      console.log('Use the clinic admin dashboard to connect Google Calendar.');
    } else {
      console.log('\nThese clinics have Google tokens and can generate Meet links.');
      console.log('Your application will automatically use them when needed.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the MongoDB connection
    await mongoose.disconnect();
    console.log('MongoDB connection closed');
  }
}

checkClinicTokens(); 