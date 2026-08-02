import mongoose from "mongoose";
import { schemaOptions } from "./schemaOptions.js";

const sourceFileSchema = new mongoose.Schema(
  {
    bytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
  },
  { _id: false, strict: "throw" },
);

const countSchema = new mongoose.Schema(
  {
    products: { type: Number, required: true, min: 0, default: 0 },
    users: { type: Number, required: true, min: 0, default: 0 },
    ratings: { type: Number, required: true, min: 0, default: 0 },
  },
  { _id: false, strict: "throw" },
);

export const datasetImportSchema = new mongoose.Schema(
  {
    datasetKey: { type: String, required: true, immutable: true, maxlength: 160 },
    source: { type: String, required: true, immutable: true, maxlength: 100 },
    sourceVersion: { type: String, required: true, immutable: true, maxlength: 100 },
    status: {
      type: String,
      required: true,
      enum: ["importing", "completed", "active", "failed", "superseded"],
    },
    active: { type: Boolean, required: true, default: false },
    counts: { type: countSchema, required: true, default: () => ({}) },
    sourceFiles: {
      metadata: { type: sourceFileSchema, required: true },
      ratings: { type: sourceFileSchema, required: true },
    },
    stagingFiles: {
      products: { type: sourceFileSchema, required: true },
      ratings: { type: sourceFileSchema, required: true },
    },
    configDigest: { type: String, required: true, match: /^[0-9a-f]{64}$/ },
    pseudonymKeyFingerprint: { type: String, required: true, match: /^[0-9a-f]{16}$/ },
    stagedAt: { type: Date, required: true },
    completedAt: { type: Date, default: null },
    activatedAt: { type: Date, default: null },
    failure: { type: String, default: null, maxlength: 500 },
  },
  { ...schemaOptions, collection: "datasetImports" },
);

datasetImportSchema.index({ datasetKey: 1 }, { unique: true });
datasetImportSchema.index(
  { active: 1 },
  { unique: true, partialFilterExpression: { active: true } },
);

export const DatasetImport = mongoose.models.DatasetImport
  || mongoose.model("DatasetImport", datasetImportSchema);
