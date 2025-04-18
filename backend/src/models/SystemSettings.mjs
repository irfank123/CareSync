import mongoose from 'mongoose';

const SystemSettingsSchema = new mongoose.Schema(
  {
    category: {
      type: String,
      enum: ['general', 'security', 'notifications', 'appointments', 'payments', 'system'],
      required: true,
      index: true
    },
    key: {
      type: String,
      required: true,
      unique: true,
      index: true
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },
    description: {
      type: String
    },
    isEditable: {
      type: Boolean,
      default: true
    },
    lastModifiedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    lastModifiedAt: {
      type: Date,
      default: Date.now
    }
  },
  {
    timestamps: false
  }
);

//compound index for efficient settings retrieval
SystemSettingsSchema.index({ category: 1, key: 1 });

const SystemSettings = mongoose.model('SystemSettings', SystemSettingsSchema);
export default SystemSettings;


