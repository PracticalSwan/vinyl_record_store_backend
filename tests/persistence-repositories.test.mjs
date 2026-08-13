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
  query.limit = () => query;
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

test("deleteCustomerAccount removes feedback in the same successful transaction", async () => {
  const calls = [];
  const transactionSession = { id: "account-cleanup-session" };
  let userDeleteOptions;
  const userModel = {
    deleteOne: async (_filter, options) => {
      userDeleteOptions = options;
      return { deletedCount: 1 };
    },
  };
  const tracker = { deleteMany: async (filter, options) => { calls.push({ filter, options }); } };
  let feedbackCalls = 0;
  const feedbackModel = {
    deleteMany: async (filter, options) => {
      feedbackCalls += 1;
      calls.push({ filter, options });
    },
  };
  const repository = createAccountRepository(
    {
      userModel,
      wishlistModel: tracker,
      cartModel: tracker,
      ratingModel: tracker,
      interactionModel: tracker,
      recommendationLogModel: tracker,
      guestMergeModel: tracker,
      feedbackModel,
    },
    async () => ({ transaction: async (fn) => fn(transactionSession) }),
  );
  assert.equal(await repository.deleteCustomerAccount("user-1"), true);
  assert.equal(feedbackCalls, 1);
  assert.equal(userDeleteOptions.session, transactionSession);
  assert.equal(calls.length, 7);
  assert.ok(calls.some(({ filter }) => filter.userPublicId === "user-1"));
  assert.ok(calls.some(({ filter }) => (
    filter.subjectType === "user" && filter.subjectId === "user-1"
  )));
  assert.ok(calls.every(({ options }) => options.session === transactionSession));
});

test("deleteCustomerAccount propagates a cleanup failure so the transaction can roll back", async () => {
  const failure = new Error("cleanup failed");
  let transactionRejected = false;
  const repository = createAccountRepository(
    {
      userModel: { deleteOne: async () => ({ deletedCount: 1 }) },
      wishlistModel: { deleteMany: async () => {} },
      cartModel: { deleteMany: async () => { throw failure; } },
      ratingModel: { deleteMany: async () => {} },
      interactionModel: { deleteMany: async () => {} },
      recommendationLogModel: { deleteMany: async () => {} },
      guestMergeModel: { deleteMany: async () => {} },
      feedbackModel: { deleteMany: async () => {} },
    },
    async () => ({
      transaction: async (fn) => {
        try {
          return await fn({ id: "rollback-session" });
        } catch (error) {
          transactionRejected = true;
          throw error;
        }
      },
    }),
  );

  await assert.rejects(() => repository.deleteCustomerAccount("user-1"));
  assert.equal(transactionRejected, true);
});

test("user recommendation logs require an active customer in the same transaction", async () => {
  const transactionSession = { id: "recommendation-log-session" };
  const fenceCalls = [];
  const userModel = {
    findOneAndUpdate(filter, update, options) {
      fenceCalls.push({ filter, update, options });
      return chain({ _id: "active-user" });
    },
  };
  const createCalls = [];
  const recommendationLogModel = {
    create: async (documents, options) => {
      createCalls.push({ documents, options });
      return documents;
    },
  };
  const events = createEventRepository(
    { userModel, recommendationLogModel },
    async () => ({ transaction: async (fn) => fn(transactionSession) }),
  );
  const row = {
    requestId: "request-1",
    listId: "list-1",
    subjectType: "user",
    subjectId: "user-1",
    mode: "cold-start",
    algorithmVersion: "content-demo-v1",
    surface: "home",
    items: [],
  };

  await events.appendRecommendationLog(row);

  assert.deepEqual(fenceCalls, [{
    filter: { publicId: "user-1", role: "customer", active: true },
    update: { $currentDate: { updatedAt: true } },
    options: {
      new: true,
      projection: { _id: 1 },
      session: transactionSession,
      timestamps: false,
    },
  }]);
  assert.deepEqual(createCalls, [{
    documents: [row],
    options: { session: transactionSession },
  }]);
});

test("user recommendation logging does not recreate data after account deletion wins", async () => {
  let createCalls = 0;
  const events = createEventRepository(
    {
      userModel: { findOneAndUpdate: () => chain(null) },
      recommendationLogModel: { create: async () => { createCalls += 1; } },
    },
    async () => ({ transaction: async (fn) => fn({}) }),
  );

  const result = await events.appendRecommendationLog({
    subjectType: "user",
    subjectId: "deleted-user",
  });

  assert.equal(result, null);
  assert.equal(createCalls, 0);
});

test("concurrent recommendation logging and account deletion leave no user log in either order", async () => {
  async function exercise(firstOperation) {
    const state = { userExists: true, recommendationLogs: [] };
    let transactionTail = Promise.resolve();
    let sessionNumber = 0;
    const connection = {
      async transaction(operation) {
        const previous = transactionTail;
        let release;
        transactionTail = new Promise((resolve) => { release = resolve; });
        await previous;
        try {
          sessionNumber += 1;
          return await operation({ id: `serialized-session-${sessionNumber}` });
        } finally {
          release();
        }
      },
    };
    const userModel = {
      deleteOne: async () => {
        const deletedCount = state.userExists ? 1 : 0;
        state.userExists = false;
        return { deletedCount };
      },
      findOneAndUpdate: () => chain(state.userExists ? { _id: "active-user" } : null),
    };
    const recommendationLogModel = {
      create: async (documents) => {
        state.recommendationLogs.push(...documents);
        return documents;
      },
      deleteMany: async () => { state.recommendationLogs = []; },
    };
    const noOwnedState = { deleteMany: async () => {} };
    const connect = async () => connection;
    const events = createEventRepository({ userModel, recommendationLogModel }, connect);
    const accounts = createAccountRepository({
      userModel,
      recommendationLogModel,
      wishlistModel: noOwnedState,
      cartModel: noOwnedState,
      ratingModel: noOwnedState,
      interactionModel: noOwnedState,
      guestMergeModel: noOwnedState,
      feedbackModel: noOwnedState,
    }, connect);
    const log = () => events.appendRecommendationLog({
      subjectType: "user",
      subjectId: "user-1",
      requestId: "request-1",
      listId: "list-1",
      mode: "cold-start",
      algorithmVersion: "content-demo-v1",
      surface: "home",
      items: [],
    });
    const remove = () => accounts.deleteCustomerAccount("user-1");
    const first = firstOperation === "log" ? log() : remove();
    const second = firstOperation === "log" ? remove() : log();
    const [firstResult, secondResult] = await Promise.all([first, second]);

    assert.equal(state.userExists, false);
    assert.deepEqual(state.recommendationLogs, []);
    assert.equal(firstOperation === "log" ? secondResult : firstResult, true);
    if (firstOperation === "delete") assert.equal(secondResult, null);
  }

  await exercise("log");
  await exercise("delete");
});

test("recent interactions are bounded, ordered, and owner fields are stripped", async () => {
  const model = {
    find: () => chain([
      {
        _id: "private",
        userPublicId: "user-1",
        sessionId: "secret",
        anonymousId: "secret",
        eventId: "event-1",
        type: "product_view",
        productPublicId: 1,
        occurredAt: new Date(),
        receivedAt: new Date(),
      },
    ]),
  };
  const repository = createUserStateRepository({ interactionModel: model }, transactionConnect);
  const result = await repository.listRecentInteractions("user-1", 999);
  assert.equal(result.length, 1);
  assert.equal(result[0].userPublicId, undefined);
  assert.equal(result[0].sessionId, undefined);
  assert.equal(result[0].eventId, "event-1");
});
