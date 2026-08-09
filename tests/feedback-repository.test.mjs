import test from "node:test";
import assert from "node:assert/strict";
import { createFeedbackRepository } from "../src/repositories/feedbackRepository.js";

const chain = (value) => {
  const query = {
    lean: () => query,
    sort: () => query,
    exec: async () => value,
  };
  return query;
};

test("feedback repository upserts, lists, and removes one user/product row", async () => {
  let current = null;
  const model = {
    findOne: () => chain(current),
    find: () => chain(current ? [current] : []),
    findOneAndUpdate: (_filter, update) => {
      current = { userPublicId: "user-1", productPublicId: 7, kind: update.$set.kind, schemaVersion: 1 };
      return chain(current);
    },
    findOneAndDelete: () => {
      const removed = current;
      current = null;
      return chain(removed);
    },
  };
  const repository = createFeedbackRepository(model, async () => ({}));
  assert.equal((await repository.upsert("user-1", 7, "not-interested")).kind, "not-interested");
  assert.equal((await repository.upsert("user-1", 7, "already-own")).kind, "already-own");
  assert.equal((await repository.listByUser("user-1")).length, 1);
  assert.equal((await repository.remove("user-1", 7)).productPublicId, 7);
  assert.equal(await repository.remove("user-1", 7), null);
});
