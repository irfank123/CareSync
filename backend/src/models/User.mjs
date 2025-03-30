import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';


const UserSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: [true, 'Please add an email'],
      unique: true,
      match: [
        /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
        'Please add a valid email',
      ],
      index: true
    },
    passwordHash: {
      type: String,
      required: [true, 'Please add a password'],
      minlength: 6,
      select: false,
    },
    role: {
      type: String,
      enum: ['patient', 'doctor', 'staff', 'admin'],
      default: 'patient',
      index: true
    },
    firstName: {
      type: String,
      required: [true, 'Please add a first name'],
      trim: true
    },
    lastName: {
      type: String,
      required: [true, 'Please add a last name'],
      trim: true
    },
    phoneNumber: {
      type: String,
      required: [true, 'Please add a phone number'],
    },
    createdAt: {
      type: Date,
      default: Date.now
    },
    lastLogin: {
      type: Date
    },
    isActive: {
      type: Boolean,
      default: true
    },
    mfaEnabled: {
      type: Boolean,
      default: false
    },
    mfaMethod: {
      type: String,
      enum: ['app', 'sms', null],
      default: null
    },
    profileImageUrl: {
      type: String
    },
    resetPasswordToken: String,
    resetPasswordExpire: Date,
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

//password encryption using bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('passwordHash')) {
    next();
  }

  const salt = await bcrypt.genSalt(10);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

//sign JWT and return
UserSchema.methods.getSignedJwtToken = function () {
  return jwt.sign(
    { 
      id: this._id,
      role: this.role 
    }, 
    process.env.JWT_SECRET, 
    {
      expiresIn: process.env.JWT_EXPIRES_IN,
    }
  );
};

//match user entered password to hashed password in database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.passwordHash);
};

//generate and hash password token
UserSchema.methods.getResetPasswordToken = function() {
  //generate token
  const resetToken = crypto.randomBytes(20).toString('hex');

  //hash token and set to resetPasswordToken field
  this.resetPasswordToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');

  //set expiry
  this.resetPasswordExpire = Date.now() + 10 * 60 * 1000; // 10 minutes

  return resetToken;
};

//export
const User = mongoose.model('User', UserSchema);
export default User;