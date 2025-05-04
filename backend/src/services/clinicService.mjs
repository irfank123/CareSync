import mongoose from 'mongoose';
import { Clinic, User } from '../models/index.mjs';
import { AppError } from '../utils/errorHandler.mjs';

class ClinicService {

  /**
   * Creates a new clinic and links the specified user as the admin.
   * Uses a transaction to ensure atomicity.
   * @param {string} userId - The ID of the user creating the clinic (should be admin).
   * @param {object} clinicData - Data for the new clinic (name, address, etc.).
   * @returns {Promise<{clinic: object, user: object}>} The created clinic and updated user.
   */
  async createClinicAndLinkAdmin(userId, clinicData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Create the Clinic
      const newClinic = new Clinic({
        ...clinicData,
        adminUserId: userId,
        verificationStatus: 'pending', // Default status
        // Set defaults for other fields if needed
      });
      const savedClinic = await newClinic.save({ session });

      // 2. Update the User to link to the new Clinic
      const updatedUser = await User.findByIdAndUpdate(
        userId,
        { $set: { clinicId: savedClinic._id } },
        { new: true, session } // Return the updated document
      );

      if (!updatedUser) {
        // Should not happen if userId is valid, but safety check
        throw new Error('Failed to find or update the user record.');
      }

      // Commit the transaction
      await session.commitTransaction();

      return {
        clinic: savedClinic.toObject(),
        user: updatedUser.toObject(),
      };

    } catch (error) {
      // If any error occurs, abort the transaction
      await session.abortTransaction();
      console.error('Transaction aborted - Error creating clinic and linking admin:', error);
      // Re-throw the error to be handled by the controller
      throw new Error(error.message || 'Database transaction failed during clinic creation.');
    } finally {
      // End the session
      session.endSession();
    }
  }

  /**
   * Creates a new clinic and links it to the specified user.
   * Assumes authorization has already happened.
   * @param {string} userId - The ID of the user creating the clinic.
   * @param {object} clinicData - Data for the new clinic (name, address, etc.).
   * @returns {Promise<{clinic: object, user: object}>} The created clinic and updated user.
   */
  async createClinicAndLinkUser(userId, clinicData) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      // 1. Find the user
      const user = await User.findById(userId).session(session);
      if (!user) {
        throw new AppError('User not found', 404);
      }
      // Optional: Re-verify user doesn't already have a clinicId
      if (user.clinicId) {
         throw new AppError('User is already associated with a clinic', 400);
      }

      // 2. Create the Clinic
      // Add the adminUserId to the clinic data
      const newClinicData = {
        ...clinicData,
        adminUserId: userId,
        verificationStatus: 'pending' // Default status
      };
      
      const createdClinics = await Clinic.create([newClinicData], { session });
      const newClinic = createdClinics[0];

      // 3. Update the User with the new Clinic ID
      user.clinicId = newClinic._id;
      await user.save({ session });

      await session.commitTransaction();
      
      console.log(`[DEBUG] Clinic ${newClinic._id} created and linked to user ${userId}`);

      // We need to return the user object as well, as it was modified
      return { 
         clinic: newClinic.toObject(), 
         user: user.toObject() // Return the updated user object
      };

    } catch (error) {
      await session.abortTransaction();
      console.error('Error in createClinicAndLinkUser:', error);
      // Re-throw specific errors or a generic one
      if (error instanceof AppError) {
        throw error;
      }
      throw new AppError('Failed to create clinic: ' + error.message, 500);
    } finally {
      session.endSession();
    }
  }

  // TODO: Add other clinic service methods (get, update, etc.)

}

export default new ClinicService(); 