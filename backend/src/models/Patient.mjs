import mongoose from 'mongoose';

const PatientSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    dateOfBirth: {
      type: Date,
      required: [true, 'Please add date of birth'],
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      required: [true, 'Please specify gender'],
    },
    address: {
      street: String,
      city: String,
      state: String,
      zipCode: String,
      country: String,
    },
    emergencyContact: {
      name: String,
      relationship: String,
      phoneNumber: String,
    },
    allergies: [String],
    medicalHistory: [{
      condition: String,
      diagnosedDate: Date,
      notes: String,
      isActive: Boolean
    }],
    currentMedications: [{
      name: String,
      dosage: String,
      frequency: String,
      startDate: Date,
      endDate: Date
    }],
    preferredCommunication: {
      type: String,
      enum: ['email', 'sms', 'phone'],
      default: 'email'
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//virtual field for appointments
PatientSchema.virtual('appointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'patientId',
  justOne: false,
});

//update the updatedAt field on save
PatientSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Patient = mongoose.model('Patient', PatientSchema);
export default Patient;