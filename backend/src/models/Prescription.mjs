import mongoose from 'mongoose';

const PrescriptionSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Patient',
      required: true,
      index: true
    },
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true
    },
    consultationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation'
    },
    medications: [{
      name: {
        type: String,
        required: true
      },
      dosage: {
        type: String,
        required: true
      },
      frequency: {
        type: String,
        required: true
      },
      duration: String,
      quantity: Number,
      refills: {
        type: Number,
        default: 0
      },
      instructions: String,
      isControlled: {
        type: Boolean,
        default: false
      },
      controlledClass: {
        type: String,
        enum: [null, 'II', 'III', 'IV', 'V'],
        default: null
      }
    }],
    prescriptionDate: {
      type: Date,
      default: Date.now
    },
    expirationDate: Date,
    status: {
      type: String,
      enum: ['active', 'completed', 'cancelled', 'expired'],
      default: 'active'
    },
    pharmacyName: String,
    pharmacyAddress: String,
    pharmacyPhone: String,
    digitalSignature: String,
    verificationCode: {
      type: String,
      unique: true
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

//set expiration date to 6 months after prescription if not specified
PrescriptionSchema.pre('save', function(next) {
  if (!this.expirationDate) {
    const sixMonthsLater = new Date(this.prescriptionDate);
    sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6);
    this.expirationDate = sixMonthsLater;
  }
  
  //generate a verification code if not present
  if (!this.verificationCode) {
    this.verificationCode = Math.random().toString(36).substring(2, 15) + 
                           Math.random().toString(36).substring(2, 15);
  }
  
  this.updatedAt = Date.now();
  next();
});

const Prescription = mongoose.model('Prescription', PrescriptionSchema);
export default Prescription;