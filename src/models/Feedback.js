import mongoose from "mongoose";
import { FEEDBACK_KINDS } from "./constants.js";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

export const feedbackSchema = new mongoose.Schema(
  {
    userPublicId: { type: String, required: true, maxlength: 64, immutable: true },
    productPublicId: { ...publicIdField, immutable: true },
    kind: { type: String, required: true, enum: FEEDBACK_KINDS },
    schemaVersion: { type: Number, required: true, default: 1, min: 1, validate: Number.isInteger },
  },
  { ...schemaOptions, collection: "feedback" },
);

feedbackSchema.index({ userPublicId: 1, productPublicId: 1 }, { unique: true });

export const Feedback = mongoose.models.Feedback
  || mongoose.model("Feedback", feedbackSchema);
