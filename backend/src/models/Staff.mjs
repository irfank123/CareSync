import mongoose from 'mongoose'

const StaffSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    position: {
      type: String,
      enum: ['receptionist', 'nurse', 'administrator', 'other'],
      required: [true, 'Please specify position']
    },
    department: {
      type: String
    },
    permissions: {
      type: [String]
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

//update the updatedAt field on save
StaffSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Staff = mongoose.model('Staff', StaffSchema);
export default Staff;