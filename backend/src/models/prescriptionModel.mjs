import mongoose from 'mongoose';

const medicationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Medication name is required.'],
    trim: true,
  },
  dosage: {
    type: String,
    trim: true,
  },
  form: {
    type: String,
    trim: true,
    enum: ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Ointment', 'Drops', 'Inhaler', 'Other'], // Example forms
  },
  frequency: {
    type: String,
    required: [true, 'Frequency is required.'],
    trim: true,
  },
  duration: {
    type: String,
    trim: true,
  },
  instructions: {
    type: String,
    trim: true,
  },
}, { _id: false }); // Don't create separate IDs for subdocuments by default

const prescriptionSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: [true, 'Patient ID is required.'],
    index: true,
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: [true, 'Doctor ID is required.'],
    index: true,
  },
  appointmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
    index: true,
  },
  issueDate: {
    type: Date,
    default: Date.now,
  },
  medications: {
    type: [medicationSchema],
    validate: [v => Array.isArray(v) && v.length > 0, 'At least one medication is required.']
  },
  status: {
    type: String,
    enum: ['active', 'cancelled', 'completed'],
    default: 'active',
  },
  notes: {
    type: String,
    trim: true,
  },
  // Add createdBy/updatedBy if using audit logs
  createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  },
  updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
  }
}, {
  timestamps: true, // Adds createdAt and updatedAt automatically
  toJSON: { virtuals: true }, // Ensure virtuals are included when converting to JSON
  toObject: { virtuals: true }
});

// Optional: Add virtuals or methods if needed later

const Prescription = mongoose.model('Prescription', prescriptionSchema);

export default Prescription; 