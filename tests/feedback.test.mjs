import test from "node:test";
import assert from "node:assert/strict";
import { deleteFeedback, putFeedback } from "../src/services/feedback.js";
import { parseFeedback } from "../src/validation/writes.js";

test("feedback validation accepts only the two exact kinds", () => {
  assert.deepEqual(parseFeedback({ kind: "not-interested" }), { kind: "not-interested" });
  assert.deepEqual(parseFeedback({ kind: "already-own" }), { kind: "already-own" });
  assert.throws(() => parseFeedback({ kind: "show-fewer-like-this" }), /kind must be/);
  assert.throws(() => parseFeedback({ kind: "not-interested", reason: "x" }), /unsupported fields/);
});

test("feedback service validates active products only for a new write and undo is idempotent", async () => {
  let row = null;
  const repository = {
    findByUserAndProduct: async (_user, productPublicId) => row?.productPublicId === productPublicId ? row : null,
    upsert: async (_user, productPublicId, kind) => {
      row = { productPublicId, kind };
      return row;
    },
    remove: async () => {
      const removed = row;
      row = null;
      return removed;
    },
  };
  const catalog = { findByPublicId: async (id) => id === 1 ? { id } : null };
  const user = { publicId: "user-1", role: "customer" };
  assert.deepEqual(await putFeedback(user, 1, "not-interested", { repository, catalog }), { productPublicId: 1, kind: "not-interested" });
  assert.deepEqual(await putFeedback(user, 1, "already-own", { repository, catalog }), { productPublicId: 1, kind: "already-own" });
  row = { productPublicId: 2, kind: "not-interested" };
  assert.deepEqual(await putFeedback(user, 2, "already-own", { repository, catalog }), { productPublicId: 2, kind: "already-own" });
  await assert.rejects(() => putFeedback(user, 3, "not-interested", { repository, catalog }), (error) => error.code === "NOT_FOUND");
  assert.deepEqual(await deleteFeedback(user, 2, { repository }), { productPublicId: 2, removed: true });
  assert.deepEqual(await deleteFeedback(user, 2, { repository }), { productPublicId: 2, removed: false });
});
