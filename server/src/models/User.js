/**
 * User model — identity and authentication only.
 *
 * Role-specific profile data (StudentProfile, IndustryProfile, Institution)
 * lives in separate collections added in later steps. TRD.md section 6.1's
 * registration flow and section 55's end-to-end flow both treat "complete
 * profile" as a step after registration, so this model stays minimal.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

import { ROLE_VALUES, ROLES } from '../constants/roles.js';

/**
 * Cost factor for bcrypt. Not specified in any doc, so: 12 is the common
 * modern default — meaningfully slower to brute-force than the old 10, while
 * still hashing in well under a second on typical hardware.
 */
const SALT_ROUNDS = 12;

/** Deliberately permissive. Catches typos; real proof is a confirmation email. */
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: [2, 'Name must be at least 2 characters'],
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },

    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true, // creates the unique index TRD.md section 8 requires
      lowercase: true, // so Foo@x.com and foo@x.com cannot both register
      trim: true,
      match: [EMAIL_PATTERN, 'Please enter a valid email address'],
    },

    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      /**
       * The important one. `select: false` means every ordinary query omits
       * the hash — User.find(), findById(), populate(), everything. Login is
       * the rare exception and must opt back in with .select('+password').
       *
       * This is defence in depth: even a future careless `res.json(user)`
       * cannot leak the hash, because it was never loaded.
       */
      select: false,
    },

    role: {
      type: String,
      required: [true, 'Role is required'],
      enum: { values: ROLE_VALUES, message: '{VALUE} is not a valid role' },
      default: ROLES.STUDENT,
      index: true, // TRD.md section 8
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true, // createdAt / updatedAt
    toJSON: {
      /**
       * Second layer of protection. Even if a document somehow carries the
       * password (e.g. it was explicitly selected), serialising it strips the
       * hash and the internal __v.
       */
      transform: (_doc, ret) => {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  },
);

/**
 * Hash on save, but only when the password actually changed — otherwise
 * updating a user's name would re-hash the existing hash and lock them out.
 */
userSchema.pre('save', async function hashPassword(next) {
  if (!this.isModified('password')) return next();

  try {
    this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
    return next();
  } catch (error) {
    return next(error);
  }
});

/**
 * Timing-safe comparison via bcrypt.
 * Requires the document to have been loaded with .select('+password').
 */
userSchema.methods.comparePassword = async function comparePassword(candidate) {
  if (!this.password) return false;
  return bcrypt.compare(candidate, this.password);
};

/** Explicit shape for API responses. Never contains the password. */
userSchema.methods.toSafeObject = function toSafeObject() {
  return {
    id: this._id.toString(),
    name: this.name,
    email: this.email,
    role: this.role,
    isActive: this.isActive,
    createdAt: this.createdAt,
  };
};

const User = mongoose.model('User', userSchema);

export default User;
