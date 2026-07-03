import mongoose from "mongoose";
import { schemaOptions } from "./schemaOptions.js";

export const guestMergeSchema = new mongoose.Schema(
  {
    userPublicId: { type: String, required: true, maxlength: 64 },
    mergeId: { type: String, required: true, maxlength: 128 },
    requestHash: { type: String, required: true, maxlength: 128 },
    result: { type: mongoose.Schema.Types.Mixed, required: true },
  },
  { ...schemaOptions, collection: "guestMerges" },
);

guestMergeSchema.index({ userPublicId: 1, mergeId: 1 }, { unique: true });

export const GuestMerge =
  mongoose.models.GuestMerge || mongoose.model("GuestMerge", guestMergeSchema);
