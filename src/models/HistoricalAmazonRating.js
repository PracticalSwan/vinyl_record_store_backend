import mongoose from "mongoose";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

export const historicalAmazonRatingSchema = new mongoose.Schema(
  {
    datasetKey: { type: String, required: true, immutable: true, maxlength: 160 },
    userKey: {
      type: String,
      required: true,
      immutable: true,
      match: /^[0-9a-f]{64}$/,
      select: false,
    },
    productPublicId: { ...publicIdField, immutable: true },
    externalItemKey: {
      type: String,
      required: true,
      immutable: true,
      match: /^[0-9a-f]{64}$/,
    },
    rating: { type: Number, required: true, min: 1, max: 5 },
    occurredAt: { type: Date, required: true, immutable: true },
    split: { type: String, required: true, enum: ["train", "validation", "test"] },
    verifiedPurchase: { type: Boolean, default: null },
    sourceRow: { type: Number, required: true, min: 1, immutable: true },
    schemaVersion: { type: Number, required: true, default: 1, min: 1, immutable: true },
    qualityFlags: { type: [{ type: String, maxlength: 100 }], default: [] },
    recordDigest: { type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ },
  },
  { ...schemaOptions, collection: "historicalAmazonRatings" },
);

historicalAmazonRatingSchema.index(
  { datasetKey: 1, userKey: 1, productPublicId: 1 },
  { unique: true },
);
historicalAmazonRatingSchema.index({ datasetKey: 1, userKey: 1, occurredAt: 1 });
historicalAmazonRatingSchema.index({ datasetKey: 1, split: 1, productPublicId: 1 });
historicalAmazonRatingSchema.index({ datasetKey: 1, externalItemKey: 1, split: 1 });

export const HistoricalAmazonRating = mongoose.models.HistoricalAmazonRating
  || mongoose.model("HistoricalAmazonRating", historicalAmazonRatingSchema);
