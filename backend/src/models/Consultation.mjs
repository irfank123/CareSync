import mongoose from 'mongoose';

const ConsultationSchema = new mongoose.Schema(
  {
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Appointment',
      required: true,
      index: true
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    startTime: {
      type: Date,
      required: true
    },
    endTime: {
      type: Date
    },
    duration: {
      type: Number  // in minutes
    },
    notes: {
      type: String
    },
    diagnosis: [{
      code: String,       // ICD-10 or other code
      description: String,
      isPrimary: {
        type: Boolean,
        default: false
      }
    }],
    vitalSigns: {
      temperature: Number,
      bloodPressureSystolic: Number,
      bloodPressureDiastolic: Number,
      heartRate: Number,
      respiratoryRate: Number,
      oxygenSaturation: Number,
      weight: Number,
      height: Number,
      bmi: Number
    },
    followUpRecommended: {
      type: Boolean,
      default: false
    },
    followUpTimeframe: String,  // "1 week", "1 month", etc.
    isVirtual: {
      type: Boolean,
      default: true
    },
    recordingUrl: String,
    status: {
      type: String,
      enum: ['completed', 'interrupted', 'technical-issues'],
      default: 'completed'
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
    timestamps: true
  }
);

//calculate duration when endTime is set
ConsultationSchema.pre('save', function(next) {
  if (this.startTime && this.endTime) {
    this.duration = Math.round((this.endTime - this.startTime) / 60000); // Convert to minutes
  }
  this.updatedAt = Date.now();
  next();
});

const Consultation = mongoose.model('Consultation', ConsultationSchema);
export default Consultation;