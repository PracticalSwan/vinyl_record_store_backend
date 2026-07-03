import mongoose from "mongoose";
import { publicIdField, schemaOptions } from "./schemaOptions.js";

const cartItemSchema = new mongoose.Schema(
  {
    productPublicId: { ...publicIdField, immutable: false },
    quantity: { type: Number, required: true, min: 1, max: 99, validate: Number.isInteger },
  },
  { _id: false, strict: "throw" },
);

export const cartSchema = new mongoose.Schema(
  {
    userPublicId: { type: String, required: true, maxlength: 64 },
    items: {
      type: [cartItemSchema],
      default: [],
      validate: {
        validator: (items) =>
          new Set(items.map((item) => item.productPublicId)).size === items.length,
        message: "Cart product IDs must be unique.",
      },
    },
  },
  { ...schemaOptions, collection: "carts" },
);

cartSchema.index({ userPublicId: 1 }, { unique: true });

export const Cart = mongoose.models.Cart || mongoose.model("Cart", cartSchema);
