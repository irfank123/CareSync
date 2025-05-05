import mongoose from 'mongoose';

const AuditLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true
    },
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true
    },
    action: {
      type: String,
      required: true,
      enum: [
        'login', 
        'logout',
        'register',
        'create', 
        'update', 
        'delete', 
        'view', 
        'verify_email', 
        'reset_password', 
        'forgot_password', 
        'update_profile',
        'update_password',
        'mfa_enable', 
        'mfa_disable',
        'mfa_verify',
        'auth0-login',
        'clinic-login',
        'clinic-register',
        'clinic-verify',
      ],
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
        'register',
        'patient-profile',
        'patient-prescriptions'
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