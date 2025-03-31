// src/models/User.mjs

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import config from '../config/config.mjs';

const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,
    },
    role: {
      type: String,
      enum: {
        values: ['patient', 'doctor', 'staff', 'admin'],
        message: 'Role must be patient, doctor, staff, or admin'
      },
      default: 'patient',
      index: true
    },
    firstName: {
      type: String,
      required: [true, 'Please add a first name'],
      trim: true,
      maxlength: [50, 'First name cannot exceed 50 characters']
    },
    lastName: {
      type: String,
      required: [true, 'Please add a last name'],
      trim: true,
      maxlength: [50, 'Last name cannot exceed 50 characters']
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
      match: [
        /^\+?[1-9]\d{9,14}$/, 
        'Please add a valid phone number'
      ]
    },
    createdAt: {
      type: Date,
      default: Date.now,
      immutable: true
    },
    lastLogin: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true
    },
    emailVerified: {
      type: Boolean,
      default: false
    },
    emailVerificationToken: String,
    emailVerificationExpire: Date,
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaMethod: {
      type: String,
      enum: ['app', 'sms', null],
      default: null
    },
    mfaToken: {
      type: String,
      select: false
    },
    mfaTokenExpires: {
      type: Date,
      select: false
    },
    profileImageUrl: {
      type: String
    },
    resetPasswordToken: {
      type: String,
      select: false
    },
    resetPasswordExpire: {
      type: Date,
      select: false
    },
    passwordChangedAt: Date,
    clinicId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Clinic',
      index: true
    },
    auth0Id: {
      type: String,
      unique: true,
      sparse: true, 
      index: true
    },
    loginAttempts: {
      type: Number,
      default: 0
    },
    lockedUntil: Date,
    termsAccepted: {
      type: Boolean,
      default: false
    },
    termsAcceptedAt: Date,
    privacyAccepted: {
      type: Boolean,
      default: false
    },
    privacyAcceptedAt: Date,
    preferences: {
      theme: {
        type: String,
        enum: ['light', 'dark', 'system'],
        default: 'system'
      },
      language: {
        type: String,
        default: 'en'
      },
      notifications: {
        email: {
          type: Boolean,
          default: true
        },
        sms: {
          type: Boolean,
          default: true
        },
        inApp: {
          type: Boolean,
          default: true
        }
      }
    }
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//virtual field for full name
UserSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

//create index for email + isActive for efficient login queries
UserSchema.index({ email: 1, isActive: 1 });

//passsword encryption 
UserSchema.pre('save', async function(next) {
  // hash new or modified password
  if (!this.isModified('passwordHash')) {
    return next();
  }
  
  //if password is changed and user exists, update passwordChangedAt
  if (this.isModified('passwordHash') && !this.isNew) {
    this.passwordChangedAt = Date.now() - 1000; // subtract 1 second for token validation
  }

  try {
    const salt = await bcrypt.genSalt(config.security.bcryptRounds);
    this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
    next();
  } catch (error) {
    next(error);
  }
});

//sign JWT and return
UserSchema.methods.getSignedJwtToken = function() {
  let payload = { 
    id: this._id,
    role: this.role 
  };
  
  //add clinicId if user is associated with a clinic
  if (this.clinicId) {
    payload.clinicId = this.clinicId;
  }
  
  //add Auth0 ID if present
  if (this.auth0Id) {
    payload.auth0Id = this.auth0Id;
  }
  
  return jwt.sign(
    payload, 
    config.jwt.secret, 
    {
      expiresIn: config.jwt.expiresIn,
    }
  );
};

//match user  password to hashed password in database
UserSchema.methods.matchPassword = async function(enteredPassword) {
  try {
    return await bcrypt.compare(enteredPassword, this.passwordHash);
  } catch (error) {
    throw new Error('Password comparison failed');
  }
};

//generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  //generate token
  const resetToken = crypto.randomBytes(32).toString('hex');

  //hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  //set expiry
  this.resetPasswordExpire = Date.now() + 60 * 60 * 1000; // 1 hour

  return resetToken;
};

//generate and hash email verification token
UserSchema.methods.getEmailVerificationToken = function() {
  //generate token (6-digit code)
  const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

  //hash token and set to emailVerificationToken field
  this.emailVerificationToken = crypto
    .createHash('sha256')
    .update(verificationToken)
    .digest('hex');

  //set expiry
  this.emailVerificationExpire = Date.now() + 24 * 60 * 60 * 1000; // 24 hours

  return verificationToken;
};

//check if password was changed after token was issued
UserSchema.methods.changedPasswordAfter = function(jwtTimestamp) {
  if (this.passwordChangedAt) {
    const changedTimestamp = parseInt(this.passwordChangedAt.getTime() / 1000, 10);
    return jwtTimestamp < changedTimestamp;
  }
  
  //password was NOT changed after token issuance
  return false;
};

//increment login attempts and lock account if necessary
UserSchema.methods.incrementLoginAttempts = async function() {
  //increment login attempts
  this.loginAttempts += 1;
  
  //lock account if too many attempts (5 attempts)
  if (this.loginAttempts >= 5) {
    //lock for 30 minutes
    this.lockedUntil = Date.now() + 30 * 60 * 1000;
  }
  
  return this.save();
};

//reset login attempts
UserSchema.methods.resetLoginAttempts = async function() {
  this.loginAttempts = 0;
  this.lockedUntil = undefined;
  return this.save();
};

//check if account is locked
UserSchema.methods.isAccountLocked = function() {
  return this.lockedUntil && this.lockedUntil > Date.now();
};

//generate MFA token
UserSchema.methods.generateMfaToken = function() {
  //generate a 6-digit code
  const mfaToken = Math.floor(100000 + Math.random() * 900000).toString();
  
  //hash token
  this.mfaToken = crypto
    .createHash('sha256')
    .update(mfaToken)
    .digest('hex');
  
  //set expiry to 10 minutes
  this.mfaTokenExpires = Date.now() + 10 * 60 * 1000;
  
  return mfaToken;
};

//accept terms of service
UserSchema.methods.acceptTerms = function() {
  this.termsAccepted = true;
  this.termsAcceptedAt = Date.now();
  return this.save();
};

//accept privacy policy
UserSchema.methods.acceptPrivacy = function() {
  this.privacyAccepted = true;
  this.privacyAcceptedAt = Date.now();
  return this.save();
};

const User = mongoose.model('User', UserSchema);
export default User;