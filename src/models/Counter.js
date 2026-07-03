import mongoose from "mongoose";
import { schemaOptions } from "./schemaOptions.js";

export const counterSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true, maxlength: 100 },
    value: { type: Number, required: true, default: 0, min: 0, validate: Number.isInteger },
  },
  { ...schemaOptions, collection: "counters" },
);

export const Counter =
  mongoose.models.Counter || mongoose.model("Counter", counterSchema);
