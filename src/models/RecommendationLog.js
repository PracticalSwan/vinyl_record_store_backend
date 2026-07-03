import mongoose from "mongoose";
import { RETENTION_MS } from "./constants.js";
import { optionalPublicIdField, publicIdField, schemaOptions } from "./schemaOptions.js";

const recommendationItemSchema = new mongoose.Schema(
  {
    productPublicId: { ...publicIdField, immutable: false },
    score: { type: Number, required: true },
    rank: { type: Number, required: true, min: 1, validate: Number.isInteger },
  },
  { _id: false, strict: "throw" },
);

export const recommendationLogSchema = new mongoose.Schema(
  {
    requestId: { type: String, required: true, immutable: true, maxlength: 128 },
    subjectType: { type: String, required: true, enum: ["user", "anonymous", "product"] },
    subjectId: { type: String, required: true, maxlength: 128, select: false },
    mode: { type: String, required: true, maxlength: 64 },
    algorithmVersion: { type: String, required: true, maxlength: 100 },
    sourceProductId: { ...optionalPublicIdField, immutable: false },
    excludedProductIds: { type: [{ ...publicIdField, immutable: false }], default: [] },
    surface: { type: String, required: true, maxlength: 64 },
    items: { type: [recommendationItemSchema], required: true },
    servedAt: { type: Date, required: true, default: Date.now, immutable: true },
    expiresAt: {
      type: Date,
      required: true,
      default: () => new Date(Date.now() + RETENTION_MS),
      immutable: true,
    },
  },
  { ...schemaOptions, collection: "recommendationLogs" },
);

recommendationLogSchema.pre("validate", function setRetentionWindow() {
  if (this.isNew) {
    this.servedAt = new Date();
    this.expiresAt = new Date(this.servedAt.getTime() + RETENTION_MS);
  }
});

recommendationLogSchema.index({ requestId: 1 }, { unique: true });
recommendationLogSchema.index({ algorithmVersion: 1, servedAt: -1 });
recommendationLogSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RecommendationLog =
  mongoose.models.RecommendationLog ||
  mongoose.model("RecommendationLog", recommendationLogSchema);
