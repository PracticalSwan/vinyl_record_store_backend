import { Cart } from "../models/Cart.js";
import { Rating } from "../models/Rating.js";
import { Wishlist } from "../models/Wishlist.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const clean = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, ...result } = value;
  return result;
};

export function createUserStateRepository(
  { wishlistModel = Wishlist, cartModel = Cart, ratingModel = Rating } = {},
  connect,
) {
  const run = createMongoRunner(connect);
  return {
    getWishlist: (userPublicId) => run(async () => clean(
      await wishlistModel.findOne({ userPublicId }).lean().exec(),
    )),
    replaceWishlist: (userPublicId, productPublicIds) => run(async () => clean(
      await wishlistModel.findOneAndUpdate(
        { userPublicId },
        { $set: { productPublicIds } },
        { new: true, runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    getCart: (userPublicId) => run(async () => clean(
      await cartModel.findOne({ userPublicId }).lean().exec(),
    )),
    replaceCart: (userPublicId, items) => run(async () => clean(
      await cartModel.findOneAndUpdate(
        { userPublicId },
        { $set: { items } },
        { new: true, runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    listRatings: (userPublicId) => run(async () => (
      await ratingModel.find({ userPublicId }).sort({ productPublicId: 1 }).lean().exec()
    ).map(clean)),
    setRating: (userPublicId, productPublicId, rating) => run(async () => clean(
      await ratingModel.findOneAndUpdate(
        { userPublicId, productPublicId },
        { $set: { rating } },
        { new: true, runValidators: true, upsert: true },
      ).lean().exec(),
    )),
  };
}

export const userStateRepository = createUserStateRepository();
