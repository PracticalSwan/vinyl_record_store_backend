import mongoose from "mongoose";
import { publicIdField, schemaOptions, uniqueValues } from "./schemaOptions.js";

export const wishlistSchema = new mongoose.Schema(
  {
    userPublicId: { type: String, required: true, maxlength: 64 },
    productPublicIds: {
      type: [{ ...publicIdField, immutable: false }],
      default: [],
      validate: {
        validator: uniqueValues,
        message: "Wishlist product IDs must be unique.",
      },
    },
  },
  { ...schemaOptions, collection: "wishlists" },
);

wishlistSchema.index({ userPublicId: 1 }, { unique: true });

export const Wishlist =
  mongoose.models.Wishlist || mongoose.model("Wishlist", wishlistSchema);
