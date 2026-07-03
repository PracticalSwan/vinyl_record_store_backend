import mongoose from "mongoose";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

const orderItemSchema = new mongoose.Schema(
  {
    productPublicId: { ...publicIdField, immutable: false },
    title: { type: String, required: true, maxlength: 200 },
    unitPrice: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ["USD"] },
    quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  },
  { _id: false, strict: "throw" },
);

export const orderSchema = new mongoose.Schema(
  {
    publicId: publicIdField,
    userPublicId: { type: String, required: true, maxlength: 64 },
    items: {
      type: [orderItemSchema],
      required: true,
      validate: {
        validator: (items) => Array.isArray(items) && items.length > 0,
        message: "An order must contain at least one item.",
      },
    },
    subtotal: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, enum: ["USD"] },
    demo: { type: Boolean, required: true, default: true, immutable: true },
    status: {
      type: String,
      required: true,
      enum: ["created", "completed", "cancelled"],
      default: "created",
    },
  },
  { ...schemaOptions, collection: "orders" },
);

orderSchema.index({ publicId: 1 }, { unique: true });
orderSchema.index({ userPublicId: 1, createdAt: -1 });

export const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
