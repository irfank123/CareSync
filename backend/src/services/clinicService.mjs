import mongoose from 'mongoose';
import { Clinic, User } from '../models/index.mjs';

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

  // TODO: Add other clinic service methods (get, update, etc.)

}

export default new ClinicService(); 