import mongoose from 'mongoose';

const TimeSlotSchema = new mongoose.Schema(
  {
    doctorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Doctor',
      required: true,
      index: true
    },
    date: {
      type: Date,
      required: true,
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
    status: {
      type: String,
      enum: ['available', 'booked', 'blocked'],
      default: 'available',
      index: true
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

//create composite index for efficient querying
TimeSlotSchema.index({ doctorId: 1, date: 1, status: 1 });

//validations
TimeSlotSchema.pre('save', function (next) {
  //ensure end time is after start time
  if (this.endTime <= this.startTime) {
    return next(new Error('End time must be after start time'));
  }
  
  this.updatedAt = Date.now();
  next();
});

const TimeSlot = mongoose.model('TimeSlot', TimeSlotSchema);
export default TimeSlot;