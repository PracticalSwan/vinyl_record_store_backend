import mongoose from "mongoose";
import { schemaOptions } from "./schemaOptions.js";

export const auditLogSchema = new mongoose.Schema(
  {
    adminUserPublicId: { type: String, required: true, maxlength: 64, select: false },
    action: { type: String, required: true, maxlength: 100 },
    entityType: { type: String, required: true, maxlength: 100 },
    entityPublicId: { type: String, required: true, maxlength: 128 },
    requestId: { type: String, required: true, maxlength: 128 },
    changedFields: { type: [{ type: String, maxlength: 100 }], default: [] },
    summary: { type: String, required: true, maxlength: 500 },
  },
  { ...schemaOptions, collection: "auditLogs" },
);

auditLogSchema.index({ entityType: 1, entityPublicId: 1, createdAt: -1 });
auditLogSchema.index({ adminUserPublicId: 1, createdAt: -1 });

export const AuditLog =
  mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
