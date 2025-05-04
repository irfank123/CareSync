// Script to save a Google refresh token to a clinic in MongoDB
// Run with: node src/scripts/saveGoogleToken.mjs REFRESH_TOKEN MONGO_URI

import mongoose from 'mongoose';
import crypto from 'crypto';

async function saveToken() {
  // Get the refresh token and MongoDB URI from command line arguments
  const refreshToken = process.argv[2];
  const mongoUri = process.argv[3];
  
  if (!refreshToken) {
    console.error('❌ ERROR: Please provide a refresh token as an argument');
    console.error('Usage: node src/scripts/saveGoogleToken.mjs YOUR_REFRESH_TOKEN MONGO_URI');
    process.exit(1);
  }
  
  if (!mongoUri) {
    console.error('❌ ERROR: Please provide a MongoDB URI as the second argument');
    console.error('Usage: node src/scripts/saveGoogleToken.mjs YOUR_REFRESH_TOKEN MONGO_URI');
    process.exit(1);
  }
  
  console.log(`Refresh token provided: ${refreshToken.substring(0, 10)}...`);
  console.log(`MongoDB URI provided: ${mongoUri.substring(0, 20)}...`);
  
  try {
    // Connect to MongoDB
    console.log('Connecting to MongoDB...');
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Define a simplified Clinic schema just for this script
    const clinicSchema = new mongoose.Schema({
      name: String,
      googleRefreshToken: String
    });
    
    // Create a model (or use existing one)
    const Clinic = mongoose.models.Clinic || mongoose.model('Clinic', clinicSchema);
    
    // Find the first clinic (or all clinics if you want to update multiple)
    const clinic = await Clinic.findOne();
    
    if (!clinic) {
      console.error('❌ No clinic found in database!');
      process.exit(1);
    }
    
    console.log(`Found clinic: ${clinic.name || clinic._id}`);
    
    // Simply store the token without encryption for now
    // Update the clinic document
    const updateResult = await Clinic.updateOne(
      { _id: clinic._id },
      { $set: { googleRefreshToken: refreshToken } }
    );
    
    if (updateResult.matchedCount === 0) {
      console.error('❌ Error: Could not find the clinic to update');
    } else if (updateResult.modifiedCount === 0) {
      console.log('⚠️ Warning: No changes made to the document (token might be the same)');
    } else {
      console.log('✅ SUCCESS: Google refresh token saved to clinic!');
    }
    
    // Verify it was saved
    const updatedClinic = await Clinic.findOne({ _id: clinic._id });
    if (updatedClinic.googleRefreshToken) {
      console.log('✅ Verified: Token is saved in database');
    } else {
      console.error('❌ Verification failed: Token not found in database after update');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    if (mongoose.connection.readyState !== 0) {
      await mongoose.disconnect();
      console.log('Disconnected from MongoDB');
    }
  }
}

saveToken(); 