import test from "node:test";
import assert from "node:assert/strict";
import { createEventRepository } from "../src/repositories/eventRepository.js";
import { createAccountRepository } from "../src/repositories/accountRepository.js";
import { createOrderRepository } from "../src/repositories/orderRepository.js";
import { createUserRepository } from "../src/repositories/userRepository.js";
import { createUserStateRepository } from "../src/repositories/userStateRepository.js";

// Chainable Mongoose-query stub: mergeGuestState composes .session().lean().exec()
// (and .sort().lean().exec() for ratings) before awaiting. This returns the
// canned value at the final awaited step regardless of which chain methods run.
function chain(value) {
  const query = {};
  query.session = () => query;
  query.lean = () => query;
  query.sort = () => query;
  query.exec = async () => value;
  return query;
}

const transactionConnection = { transaction: async (fn) => fn({}) };
const transactionConnect = async () => transactionConnection;

test("BFP-01 exposes repositories for every planned persistence surface", () => {
  const connect = async () => {};
  const user = createUserRepository({}, connect);
  const state = createUserStateRepository({}, connect);
  const events = createEventRepository({}, connect);
  const orders = createOrderRepository({}, connect);
  const account = createAccountRepository({}, connect);

  for (const method of [
    user.findByPublicId,
    user.findByNormalizedUsername,
    user.findForAuthentication,
    user.create,
    user.updatePreferences,
    state.getWishlist,
    state.replaceWishlist,
    state.addWishlistProduct,
    state.removeWishlistProduct,
    state.getCart,
    state.replaceCart,
    state.setCartItem,
    state.removeCartItem,
    state.listRatings,
    state.setRating,
    state.removeRating,
    state.setRatingWithEvent,
    state.removeRatingWithEvent,
    state.mergeGuestState,
    events.appendInteraction,
    events.appendInteractions,
    events.appendRecommendationLog,
    events.appendAuditLog,
    events.deleteUserInteractions,
    orders.allocatePublicId,
    orders.findByPublicId,
    orders.create,
    account.deleteCustomerAccount,
  ]) {
    assert.equal(typeof method, "function");
  }
});

test("order repository allocates IDs with one atomic increment", async () => {
  let captured;
  const counterModel = {
    findOneAndUpdate(filter, update, options) {
      captured = { filter, update, options };
      return { lean: () => chain({ _id: "orders", value: 7 }) };
    },
  };
  const repository = createOrderRepository(
    { counterModel, orderModel: {} },
    async () => {},
  );

  assert.equal(await repository.allocatePublicId(), 7);
  assert.deepEqual(captured, {
    filter: { _id: "orders" },
    update: { $inc: { value: 1 } },
    options: { returnDocument: "after", upsert: true },
  });
});

test("mergeGuestState replays a prior merge without rewriting customer state", async () => {
  let stateWrites = 0;
  const prior = {
    requestHash: "abc",
    result: { wishlist: [1], cart: [], ratings: [], warnings: [], replayed: false },
  };
  const guestMergeModel = {
    findOne: () => chain(prior),
    create: async () => { stateWrites += 1; },
  };
  const wishlistModel = {
    findOne: () => chain(null),
    findOneAndUpdate: async () => { stateWrites += 1; },
  };
  const cartModel = {
    findOne: () => chain(null),
    findOneAndUpdate: async () => { stateWrites += 1; },
  };
  const ratingModel = {
    find: () => chain([]),
    bulkWrite: async () => { stateWrites += 1; },
  };
  const repository = createUserStateRepository(
    { wishlistModel, cartModel, ratingModel, guestMergeModel },
    transactionConnect,
  );

  const result = await repository.mergeGuestState(
    "user-1",
    { mergeId: "merge-1", wishlist: [1], cart: [], ratings: [] },
    "abc",
    [],
  );
  assert.equal(result.replayed, true);
  assert.deepEqual(result.wishlist, [1]);
  assert.equal(stateWrites, 0);
});

test("mergeGuestState rejects a repeated merge id when the request hash differs", async () => {
  const prior = { requestHash: "abc", result: { wishlist: [], cart: [], ratings: [] } };
  const guestMergeModel = { findOne: () => chain(prior) };
  const repository = createUserStateRepository(
    { wishlistModel: {}, cartModel: {}, ratingModel: {}, guestMergeModel },
    transactionConnect,
  );

  await assert.rejects(
    () => repository.mergeGuestState(
      "user-1",
      { mergeId: "merge-1", wishlist: [], cart: [], ratings: [] },
      "different-hash",
      [],
    ),
    (error) => error.code === "CONFLICT",
  );
});

test("deleteCustomerAccount skips related cleanup when no customer matches", async () => {
  let relatedCalls = 0;
  const userModel = { deleteOne: async () => ({ deletedCount: 0 }) };
  const tracker = { deleteMany: async () => { relatedCalls += 1; } };
  const repository = createAccountRepository(
    {
      userModel,
      wishlistModel: tracker,
      cartModel: tracker,
      ratingModel: tracker,
      interactionModel: tracker,
      recommendationLogModel: tracker,
      guestMergeModel: tracker,
    },
    transactionConnect,
  );

  const result = await repository.deleteCustomerAccount("user-missing");
  assert.equal(result, false);
  assert.equal(relatedCalls, 0);
});
