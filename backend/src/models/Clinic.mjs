import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true
  },
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  password: {
    type: String,
    required: true,
    select: false 
  },
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  emailVerified: {
    type: Boolean,
    default: false
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'in_review', 'verified', 'rejected'],
    default: 'pending'
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
  }
}, { timestamps: true });

//hash password before saving
clinicSchema.pre('save', async function(next) {
  this.updatedAt = Date.now();
  
  //only hash password if it's modified or new
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

//method to compare passwords
clinicSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

const Clinic = mongoose.model('Clinic', clinicSchema);
export default Clinic;