import mongoose from "mongoose";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_GENRES,
  PRODUCT_STOCK_LEVELS,
} from "./constants.js";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

const artworkSchema = new mongoose.Schema(
  {
    url: { type: String, default: null, maxlength: 2_000 },
    source: { type: String, default: null, maxlength: 100 },
    retrievedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

const provenanceSchema = new mongoose.Schema(
  {
    field: { type: String, required: true, maxlength: 100 },
    source: { type: String, required: true, maxlength: 100 },
    sourceId: { type: String, default: null, maxlength: 200 },
    retrievedAt: { type: Date, default: null },
  },
  { _id: false, strict: "throw" },
);

export const vinylRecordSchema = new mongoose.Schema(
  {
    publicId: publicIdField,
    slug: {
      type: String,
      required: true,
      immutable: true,
      lowercase: true,
      trim: true,
      maxlength: 300,
      match: /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    artist: { type: String, required: true, trim: true, maxlength: 200 },
    genre: { type: String, required: true, enum: PRODUCT_GENRES },
    year: { type: Number, required: true, min: 1900, max: 2100 },
    price: { type: Number, required: true, min: 0, max: 1_000_000 },
    currency: { type: String, required: true, enum: ["USD"], default: "USD" },
    stock: { type: String, required: true, enum: PRODUCT_STOCK_LEVELS },
    condition: { type: String, required: true, enum: PRODUCT_CONDITIONS },
    label: { type: String, required: true, trim: true, maxlength: 200 },
    format: { type: String, required: true, trim: true, maxlength: 200 },
    pressing: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, trim: true, maxlength: 5_000 },
    imageUrl: { type: String, default: null, maxlength: 2_000 },
    musicBrainzReleaseId: { type: String, default: null, maxlength: 100 },
    artwork: { type: artworkSchema, default: () => ({}) },
    source: { type: String, required: true, default: "demo-seed", maxlength: 100 },
    provenance: { type: [provenanceSchema], default: [] },
    deletedAt: { type: Date, default: null },
  },
  {
    ...schemaOptions,
    collection: "vinylRecords",
  },
);

vinylRecordSchema.index({ publicId: 1 }, { unique: true });
vinylRecordSchema.index({ slug: 1 }, { unique: true });
vinylRecordSchema.index({ deletedAt: 1, genre: 1, year: -1, title: 1 });
vinylRecordSchema.index({ deletedAt: 1, artist: 1, year: -1, title: 1 });
vinylRecordSchema.index({ deletedAt: 1, stock: 1, year: -1, title: 1 });

export const VinylRecord =
  mongoose.models.VinylRecord || mongoose.model("VinylRecord", vinylRecordSchema);
