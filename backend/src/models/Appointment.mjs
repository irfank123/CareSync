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
    timestamps: true,
    toJSON: { 
      virtuals: true,
      transform: function(doc, ret) {
        // Ensure all ObjectId fields are serialized as strings
        const objectIdFields = ['_id', 'patientId', 'doctorId', 'timeSlotId', 'preliminaryAssessmentId'];
        
        objectIdFields.forEach(field => {
          if (ret[field]) {
            if (typeof ret[field] === 'object' && ret[field] !== null) {
              ret[field] = ret[field].toString();
            }
          }
        });
        
        // Also handle any nested documents that might have ObjectIds
        if (ret.patient && ret.patient._id) {
          ret.patient._id = ret.patient._id.toString();
        }
        
        if (ret.doctor && ret.doctor._id) {
          ret.doctor._id = ret.doctor._id.toString();
        }
        
        if (ret.patientUser && ret.patientUser._id) {
          ret.patientUser._id = ret.patientUser._id.toString();
        }
        
        if (ret.doctorUser && ret.doctorUser._id) {
          ret.doctorUser._id = ret.doctorUser._id.toString();
        }
        
        // Format date fields if they are Date objects
        if (ret.date instanceof Date) {
          const date = new Date(ret.date);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            ret.date = `${year}-${month}-${day}`;
          }
        }
        
        return ret;
      }
    },
    toObject: { virtuals: true }
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