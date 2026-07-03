import mongoose from "mongoose";
import { INTERACTION_TYPES, RETENTION_MS } from "./constants.js";
import { optionalPublicIdField, schemaOptions } from "./schemaOptions.js";

const recommendationContextSchema = new mongoose.Schema(
  {
    requestId: { type: String, default: null, maxlength: 128 },
    surface: { type: String, default: null, maxlength: 64 },
    rank: { type: Number, default: null, min: 1, max: 1_000, validate: Number.isInteger },
    algorithmVersion: { type: String, default: null, maxlength: 100 },
    mode: { type: String, default: null, maxlength: 64 },
    listId: { type: String, default: null, maxlength: 128 },
  },
  { _id: false, strict: "throw" },
);

export const interactionSchema = new mongoose.Schema(
  {
    eventId: { type: String, required: true, immutable: true, maxlength: 128 },
    userPublicId: { type: String, default: null, maxlength: 64 },
    anonymousId: { type: String, default: null, maxlength: 128, select: false },
    sessionId: { type: String, required: true, maxlength: 128, select: false },
    type: { type: String, required: true, enum: INTERACTION_TYPES },
    productPublicId: { ...optionalPublicIdField, immutable: false },
    value: { type: Number, default: null, min: -99, max: 99 },
    source: {
      type: String,
      required: true,
      enum: ["groovehaus-frontend", "groovehaus-backend"],
    },
    surface: { type: String, required: true, maxlength: 64 },
    recommendationContext: { type: recommendationContextSchema, default: null },
    occurredAt: { type: Date, required: true },
    receivedAt: { type: Date, required: true, default: Date.now, immutable: true },
    schemaVersion: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + RETENTION_MS),
      immutable: true,
    },
  },
  { ...schemaOptions, collection: "interactions" },
);

interactionSchema.pre("validate", function validateSubject() {
  if (this.isNew) {
    this.receivedAt = new Date();
    this.expiresAt = new Date(this.receivedAt.getTime() + RETENTION_MS);
  }
  if (!this.userPublicId && !this.anonymousId) {
    this.invalidate("anonymousId", "An interaction subject is required.");
  }
});
interactionSchema.index({ eventId: 1 }, { unique: true });
interactionSchema.index({ userPublicId: 1, occurredAt: -1 });
interactionSchema.index({ productPublicId: 1, occurredAt: -1 });
interactionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const Interaction =
  mongoose.models.Interaction || mongoose.model("Interaction", interactionSchema);
