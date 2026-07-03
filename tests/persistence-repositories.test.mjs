import test from "node:test";
import assert from "node:assert/strict";
import { createEventRepository } from "../src/repositories/eventRepository.js";
import { createAccountRepository } from "../src/repositories/accountRepository.js";
import { createOrderRepository } from "../src/repositories/orderRepository.js";
import { createUserRepository } from "../src/repositories/userRepository.js";
import { createUserStateRepository } from "../src/repositories/userStateRepository.js";

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
    user.upsertSeededProfile,
    user.setRole,
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
      return { lean: () => ({ exec: async () => ({ _id: "orders", value: 7 }) }) };
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
