import mongoose from 'mongoose';

const NotificationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true
    },
    type: {
      type: String,
      enum: ['appointment', 'prescription', 'system', 'reminder', 'message'],
      required: true,
      index: true
    },
    title: {
      type: String,
      required: true
    },
    message: {
      type: String,
      required: true
    },
    relatedTo: {
      model: {
        type: String,
        enum: ['Appointment', 'Prescription', 'Consultation', 'Assessment']
      },
      id: {
        type: mongoose.Schema.Types.ObjectId
      }
    },
    isRead: {
      type: Boolean,
      default: false,
      index: true
    },
    deliveryChannels: {
      type: [String],
      enum: ['email', 'sms', 'in-app'],
      default: ['in-app']
    },
    deliveryStatus: [{
      channel: {
        type: String,
        enum: ['email', 'sms', 'in-app']
      },
      status: {
        type: String,
        enum: ['pending', 'sent', 'delivered', 'failed']
      },
      sentAt: Date,
      errorMessage: String
    }],
    scheduledFor: {
      type: Date,
      default: Date.now,
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

//index for querying unread notifications
NotificationSchema.index({ userId: 1, isRead: 1 });

//index for querying scheduled notifications
NotificationSchema.index({ scheduledFor: 1, status: 1 });

//update the updatedAt field on save
NotificationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Notification = mongoose.model('Notification', NotificationSchema);
export default Notification;