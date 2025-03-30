
import mongoose from 'mongoose';

const AppointmentSchema = new mongoose.Schema(
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
      required: true,
      index: true
    },
    timeSlotId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TimeSlot',
      required: true
    },
    date: {
      type: Date,
      required: [true, 'Please add appointment date'],
      index: true
    },
    startTime: {
      type: String, // HH:MM format
      required: [true, 'Please add start time'],
    },
    endTime: {
      type: String, // HH:MM format
      required: [true, 'Please add end time'],
    },
    type: {
      type: String,
      enum: ['initial', 'follow-up', 'virtual', 'in-person'],
      default: 'virtual',
    },
    status: {
      type: String,
      enum: ['scheduled', 'checked-in', 'in-progress', 'completed', 'cancelled', 'no-show'],
      default: 'scheduled',
      index: true
    },
    notes: {
      type: String
    },
    reasonForVisit: {
      type: String,
      required: [true, 'Please add reason for visit'],
    },
    preliminaryAssessmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment'
    },
    isVirtual: {
      type: Boolean,
      default: true
    },
    videoConferenceLink: {
      type: String
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    updatedAt: {
      type: Date,
      default: Date.now
    },
    cancelledAt: {
      type: Date
    },
    cancelReason: {
      type: String
    },
    remindersSent: [{
      type: {
        type: String,
        enum: ['email', 'sms']
      },
      sentAt: Date,
      status: {
        type: String,
        enum: ['sent', 'delivered', 'failed']
      }
    }]
  },
  {
    timestamps: true
  }
);

// Index for efficiently querying appointments by upcoming dates
AppointmentSchema.index({ date: 1, status: 1 });

// Update the updatedAt field on save
AppointmentSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});


const Appointment = mongoose.model('Appointment', AppointmentSchema);
export default Appointment;