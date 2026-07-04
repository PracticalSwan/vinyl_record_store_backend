import mongoose from "mongoose";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_FORMATS,
  PRODUCT_GENRES,
  USER_ROLES,
} from "./constants.js";
import { schemaOptions } from "./schemaOptions.js";

const budgetSchema = new mongoose.Schema(
  {
    min: { type: Number, default: null, min: 0, max: 1_000_000 },
    max: { type: Number, default: null, min: 0, max: 1_000_000 },
  },
  { _id: false, strict: "throw" },
);

const preferencesSchema = new mongoose.Schema(
  {
    favoriteGenres: { type: [{ type: String, enum: PRODUCT_GENRES }], default: [] },
    dislikedGenres: { type: [{ type: String, enum: PRODUCT_GENRES }], default: [] },
    favoriteArtists: {
      type: [{ type: String, trim: true, minlength: 1, maxlength: 200 }],
      default: [],
    },
    budget: { type: budgetSchema, default: () => ({}) },
    conditions: { type: [{ type: String, enum: PRODUCT_CONDITIONS }], default: [] },
    formats: { type: [{ type: String, enum: PRODUCT_FORMATS }], default: [] },
    completedAt: { type: Date, default: null },
    schemaVersion: { type: Number, default: 1, min: 1, validate: Number.isInteger },
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
  },
  { ...schemaOptions, collection: "users" },
);

userSchema.index({ publicId: 1 }, { unique: true });
userSchema.index({ normalizedUsername: 1 }, { unique: true });

export const User = mongoose.models.User || mongoose.model("User", userSchema);
