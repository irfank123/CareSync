import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    action: {
      type: String,
      enum: ['login', 'logout', 'view', 'create', 'update', 'delete', 'export'],
      required: true,
      index: true
    },
    resource: {
      type: String,
      required: true,
      enum: [
        'user', 
        'patient', 
        'doctor', 
        'clinic',
        'clinic-profile',
        'appointment', 
        'availability',
        'assessment',
        'timeslot',
        'my-appointments',
        'login', 
        'logout',
        'register'
      ]
    },
    resourceId: {
      type: mongoose.Schema.Types.ObjectId
    },
    ipAddress: {
      type: String
    },
    userAgent: {
      type: String
    },
    details: {
      type: mongoose.Schema.Types.Mixed
    },
    timestamp: {
      type: Date,
      default: Date.now,
      index: true
    }
  },
  {
    timestamps: false
  }
);

AuditLogSchema.index({ userId: 1, action: 1, timestamp: 1 });

const AuditLog = mongoose.model('AuditLog', AuditLogSchema);
export default AuditLog;