import mongoose from "mongoose";
import { PRODUCT_GENRES, USER_ROLES } from "./constants.js";
import { schemaOptions } from "./schemaOptions.js";

const preferencesSchema = new mongoose.Schema(
  {
    genres: { type: [{ type: String, enum: PRODUCT_GENRES }], default: [] },
    artists: { type: [{ type: String, trim: true, maxlength: 200 }], default: [] },
    onboarded: { type: Boolean, default: false },
  },
  { _id: false, strict: "throw" },
);

export const userSchema = new mongoose.Schema(
  {
    publicId: {
      type: String,
      required: true,
      immutable: true,
      trim: true,
      maxlength: 64,
      match: /^[a-zA-Z0-9_-]+$/,
    },
    username: { type: String, required: true, trim: true, minlength: 3, maxlength: 64 },
    normalizedUsername: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 64,
      match: /^[a-z0-9_-]+$/,
    },
    displayName: { type: String, default: null, trim: true, maxlength: 100 },
    passwordHash: { type: String, default: null, select: false, maxlength: 500 },
    passwordSalt: { type: String, default: null, select: false, maxlength: 500 },
    role: { type: String, required: true, enum: USER_ROLES, default: "customer" },
    preferences: { type: preferencesSchema, default: () => ({}) },
    active: { type: Boolean, default: true },
    sessionVersion: { type: Number, default: 0, min: 0, validate: Number.isInteger },
  },
  { ...schemaOptions, collection: "users" },
);

userSchema.index({ publicId: 1 }, { unique: true });
userSchema.index({ normalizedUsername: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
