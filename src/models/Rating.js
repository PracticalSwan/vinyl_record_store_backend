import mongoose from "mongoose";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

export const ratingSchema = new mongoose.Schema(
  {
    userPublicId: { type: String, required: true, maxlength: 64 },
    productPublicId: { ...publicIdField, immutable: false },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
  },
  { ...schemaOptions, collection: "ratings" },
);

ratingSchema.index({ userPublicId: 1, productPublicId: 1 }, { unique: true });
ratingSchema.index({ productPublicId: 1, updatedAt: -1 });

export const Rating = mongoose.models.Rating || mongoose.model("Rating", ratingSchema);
