import mongoose from 'mongoose';
// import bcrypt from 'bcryptjs'; // No longer needed here

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  // Removed email field - Belongs to the admin User
  /*
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  */
  phone: {
    type: String,
    required: true
  },
  // Optional: Add a general contact email if needed, separate from login
  contactEmail: {
      type: String,
      lowercase: true,
      trim: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  // Removed password field - Clinics don't have passwords
  /*
  password: {
    type: String,
    required: true,
    select: false 
  },
  */
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true // A clinic must have an admin user
  },
  emailVerified: {
    // This likely referred to the clinic's own email, remove or repurpose?
    // Let's remove for now, verification happens at the User level.
    type: Boolean
    // default: false 
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'rejected'],
    default: 'verified'
  },
  verificationDocuments: [{
    type: String, 
  }],
  verificationSubmittedAt: Date,
  verificationCompletedAt: Date,
  subscriptionTier: {
    type: String,
    enum: ['basic', 'standard', 'premium'],
    default: 'basic'
  },
  subscriptionStatus: {
    type: String,
    enum: ['active', 'past_due', 'cancelled', 'trial'],
    default: 'trial'
  },
  lastLogin: Date,
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Add isActive field
  isActive: {
    type: Boolean,
    default: true,
    index: true // Good to index if queried often
  }
}, { timestamps: true });

// Removed password hashing logic
/*
clinicSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  if (!this.isModified('password')) return next();
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});
*/

// Removed password comparison method
/*
clinicSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};
*/

const Clinic = mongoose.model('Clinic', clinicSchema);
export default Clinic;