import mongoose from 'mongoose';

const DoctorSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    specialties: {
      type: [String],
      required: [true, 'Please add at least one specialty'],
    },
    licenseNumber: {
      type: String,
      required: [true, 'Please add a license number'],
      unique: true,
      index: true,
      trim: true
    },
    deaNumber: {
      type: String,
      unique: true,
      sparse: true // Allows null values but ensures uniqueness when present
    },
    education: [{
      institution: String,
      degree: String,
      graduationYear: Number
    }],
    availabilitySchedule: [{    // Regular weekly schedule
      dayOfWeek: {
        type: Number,
        enum: [0, 1, 2, 3, 4, 5, 6] // 0-6 (Sunday-Saturday)
      },
      startTime: String, // HH:MM format
      endTime: String,   // HH:MM format
      isAvailable: {
        type: Boolean,
        default: true
      }
    }],
    vacationDays: [{
      date: Date,
      isWorkDay: Boolean // False for vacation days, true to override normal off days
    }],
    maxAppointmentsPerDay: {
      type: Number,
      default: 20
    },
    appointmentDuration: {
      type: Number,
      default: 30,  // in minutes
    },
    acceptingNewPatients: {
      type: Boolean,
      default: true,
    },
    appointmentFee: {
      type: Number,
      min: [0, 'Appointment fee cannot be negative']
    },
    bio: {
      type: String,
      maxlength: [1000, 'Bio cannot exceed 1000 characters']
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
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Convert ObjectId to string for proper JSON serialization
        if (ret._id) ret._id = ret._id.toString();
        if (ret.userId) ret.userId = ret.userId.toString();
        return ret;
      }
    },
    toObject: { virtuals: true },
  }
);

// Virtual field for appointments
DoctorSchema.virtual('appointments', {
  ref: 'Appointment',
  localField: '_id',
  foreignField: 'doctorId',
  justOne: false,
});

// Virtual field for time slots
DoctorSchema.virtual('timeSlots', {
  ref: 'TimeSlot',
  localField: '_id',
  foreignField: 'doctorId',
  justOne: false,
});

// Update the updatedAt field on save
DoctorSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Doctor = mongoose.model('Doctor', DoctorSchema);
export default Doctor
