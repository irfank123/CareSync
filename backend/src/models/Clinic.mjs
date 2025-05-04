import mongoose from 'mongoose';

const clinicSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
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
  adminUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
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
  },
  googleRefreshToken: {
    type: String,
    select: false
  }
}, { timestamps: true });

const Clinic = mongoose.model('Clinic', clinicSchema);
export default Clinic;