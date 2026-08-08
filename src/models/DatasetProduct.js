import mongoose from "mongoose";
import { vinylRecordSchema } from "./VinylRecord.js";

export const datasetProductSchema = vinylRecordSchema.clone();
datasetProductSchema.clearIndexes();
datasetProductSchema.set("collection", "datasetProducts");
datasetProductSchema.add({
  datasetKey: { type: String, required: true, immutable: true, maxlength: 160 },
  sourceVersion: { type: String, required: true, immutable: true, maxlength: 100 },
  externalItemKey: {
    type: String,
    required: true,
    immutable: true,
    match: /^[0-9a-f]{64}$/,
  },
  recordDigest: { type: String, required: true, immutable: true, match: /^[0-9a-f]{64}$/ },
});

datasetProductSchema.index({ datasetKey: 1, publicId: 1 }, { unique: true });
datasetProductSchema.index({ datasetKey: 1, slug: 1 }, { unique: true });
datasetProductSchema.index({ datasetKey: 1, externalItemKey: 1 }, { unique: true });
datasetProductSchema.index({ datasetKey: 1, deletedAt: 1, genre: 1, title: 1 });
datasetProductSchema.index({ datasetKey: 1, deletedAt: 1, year: -1, publicId: 1 });
datasetProductSchema.index({ datasetKey: 1, deletedAt: 1, artist: 1, publicId: 1 });

export const DatasetProduct = mongoose.models.DatasetProduct
  || mongoose.model("DatasetProduct", datasetProductSchema);
