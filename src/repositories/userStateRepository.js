import { Cart } from "../models/Cart.js";
import { GuestMerge } from "../models/GuestMerge.js";
import { Interaction } from "../models/Interaction.js";
import { Rating } from "../models/Rating.js";
import { Wishlist } from "../models/Wishlist.js";
import { conflict } from "../lib/errors.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const clean = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, ...result } = value;
  return result;
};

export function mergeRatingsByNewest(serverRatings, guestRatings) {
  const ratingMap = new Map(serverRatings.map((item) => [item.productPublicId, item]));
  const writes = [];
  for (const guest of guestRatings) {
    const current = ratingMap.get(guest.productPublicId);
    if (!current || guest.updatedAt.getTime() > new Date(current.updatedAt).getTime()) {
      const winner = { ...guest };
      ratingMap.set(guest.productPublicId, winner);
      writes.push(winner);
    }
  }
  return {
    ratings: [...ratingMap.values()]
      .map(({ productPublicId, rating, updatedAt }) => ({ productPublicId, rating, updatedAt }))
      .sort((a, b) => a.productPublicId - b.productPublicId),
    writes,
  };
}

export function createUserStateRepository(
  {
    wishlistModel = Wishlist,
    cartModel = Cart,
    ratingModel = Rating,
    interactionModel = Interaction,
    guestMergeModel = GuestMerge,
  } = {},
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
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    addWishlistProduct: (userPublicId, productPublicId) => run(async () => clean(
      await wishlistModel.findOneAndUpdate(
        { userPublicId },
        { $addToSet: { productPublicIds: productPublicId } },
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    removeWishlistProduct: (userPublicId, productPublicId) => run(async () => clean(
      await wishlistModel.findOneAndUpdate(
        { userPublicId },
        { $pull: { productPublicIds: productPublicId } },
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    getCart: (userPublicId) => run(async () => clean(
      await cartModel.findOne({ userPublicId }).lean().exec(),
    )),
    replaceCart: (userPublicId, items) => run(async () => clean(
      await cartModel.findOneAndUpdate(
        { userPublicId },
        { $set: { items } },
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    setCartItem: (userPublicId, productPublicId, quantity) => run(
      async (connection) => connection.transaction(async (session) => {
        const current = await cartModel.findOne({ userPublicId }).session(session).lean().exec();
        const items = [...(current?.items || [])];
        const index = items.findIndex((item) => item.productPublicId === productPublicId);
        if (index >= 0) items[index] = { productPublicId, quantity };
        else items.push({ productPublicId, quantity });
        const updated = await cartModel.findOneAndUpdate(
          { userPublicId },
          { $set: { items } },
          {
            returnDocument: "after",
            runValidators: true,
            upsert: true,
            session,
          },
        ).lean().exec();
        return clean(updated);
      }),
    ),
    removeCartItem: (userPublicId, productPublicId) => run(async () => clean(
      await cartModel.findOneAndUpdate(
        { userPublicId },
        { $pull: { items: { productPublicId } } },
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    listRatings: (userPublicId) => run(async () => (
      await ratingModel.find({ userPublicId }).sort({ productPublicId: 1 }).lean().exec()
    ).map(clean)),
    setRating: (userPublicId, productPublicId, rating) => run(async () => clean(
      await ratingModel.findOneAndUpdate(
        { userPublicId, productPublicId },
        { $set: { rating } },
        { returnDocument: "after", runValidators: true, upsert: true },
      ).lean().exec(),
    )),
    removeRating: (userPublicId, productPublicId) => run(async () => clean(
      await ratingModel.findOneAndDelete({ userPublicId, productPublicId }).lean().exec(),
    )),
    setRatingWithEvent: (userPublicId, productPublicId, rating, event) => run(
      async (connection) => connection.transaction(async (session) => {
        const updated = await ratingModel.findOneAndUpdate(
          { userPublicId, productPublicId },
          { $set: { rating } },
          { returnDocument: "after", runValidators: true, upsert: true, session },
        ).lean().exec();
        await interactionModel.create([{ ...event, userPublicId }], { session });
        return clean(updated);
      }),
    ),
    removeRatingWithEvent: (userPublicId, productPublicId, event) => run(
      async (connection) => connection.transaction(async (session) => {
        const removed = await ratingModel.findOneAndDelete(
          { userPublicId, productPublicId },
          { session },
        ).lean().exec();
        if (removed) await interactionModel.create([{ ...event, userPublicId }], { session });
        return clean(removed);
      }),
    ),
    mergeGuestState: (userPublicId, input, requestHash, warnings) => run(
      async (connection) => connection.transaction(async (session) => {
        const prior = await guestMergeModel.findOne({
          userPublicId,
          mergeId: input.mergeId,
        }).session(session).lean().exec();
        if (prior) {
          if (prior.requestHash !== requestHash) {
            throw conflict("The merge ID was already used for different guest state.");
          }
          return { ...prior.result, replayed: true };
        }

        const wishlistDocument = await wishlistModel.findOne({ userPublicId })
          .session(session).lean().exec();
        const wishlist = [...new Set([
          ...(wishlistDocument?.productPublicIds || []),
          ...input.wishlist,
        ])].sort((a, b) => a - b);

        const cartDocument = await cartModel.findOne({ userPublicId })
          .session(session).lean().exec();
        const cartMap = new Map((cartDocument?.items || []).map((item) => [
          item.productPublicId,
          item.quantity,
        ]));
        for (const item of input.cart) {
          cartMap.set(item.productPublicId, Math.min(99, (cartMap.get(item.productPublicId) || 0) + item.quantity));
        }
        const cart = [...cartMap.entries()]
          .map(([productPublicId, quantity]) => ({ productPublicId, quantity }))
          .sort((a, b) => a.productPublicId - b.productPublicId);

        const serverRatings = await ratingModel.find({ userPublicId }).session(session).lean().exec();
        const { ratings, writes: ratingWrites } = mergeRatingsByNewest(
          serverRatings,
          input.ratings,
        );

        await wishlistModel.findOneAndUpdate(
          { userPublicId },
          { $set: { productPublicIds: wishlist } },
          { upsert: true, runValidators: true, session },
        );
        await cartModel.findOneAndUpdate(
          { userPublicId },
          { $set: { items: cart } },
          { upsert: true, runValidators: true, session },
        );
        if (ratingWrites.length) {
          await ratingModel.bulkWrite(ratingWrites.map((item) => ({
            updateOne: {
              filter: { userPublicId, productPublicId: item.productPublicId },
              update: { $set: { rating: item.rating, updatedAt: item.updatedAt } },
              upsert: true,
            },
          })), { session, timestamps: false });
        }

        const result = { wishlist, cart, ratings, warnings, replayed: false };
        await guestMergeModel.create([{
          userPublicId,
          mergeId: input.mergeId,
          requestHash,
          result,
        }], { session });
        return result;
      }),
    ),
  };
}

export const userStateRepository = createUserStateRepository();
