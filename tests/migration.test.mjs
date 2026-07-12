import test from "node:test";
import assert from "node:assert/strict";
import { catalogRecords as records } from "../src/data/catalogRecords.js";
import { planSeedMigration, summarizeMigration } from "../src/lib/db/seedMigration.js";
import { toPersistenceProduct } from "../src/repositories/catalogMapping.js";

test("seed migration creates all records in an empty database", () => {
  const actions = planSeedMigration([]);
  assert.deepEqual(summarizeMigration(actions), {
    creates: records.length,
    updates: 0,
    unchanged: 0,
    conflicts: 0,
  });
});

test("seed migration is idempotent", () => {
  const existing = records.map(toPersistenceProduct);
  const actions = planSeedMigration(existing);
  assert.deepEqual(summarizeMigration(actions), {
    creates: 0,
    updates: 0,
    unchanged: records.length,
    conflicts: 0,
  });
});

test("seed migration reports updates and refuses ownership conflicts", () => {
  const changed = { ...toPersistenceProduct(records[0]), price: 1 };
  const owned = { ...toPersistenceProduct(records[1]), source: "admin" };
  const actions = planSeedMigration([changed, owned], records.slice(0, 2));
  assert.deepEqual(actions.map(({ type, reason }) => ({ type, reason })), [
    { type: "update", reason: undefined },
    { type: "conflict", reason: "source-owned" },
  ]);
  assert.equal("publicId" in actions[0].desired, false);
  assert.equal("slug" in actions[0].desired, false);
});

test("seed migration never plans deletes for extra records", () => {
  const extra = { ...toPersistenceProduct(records[0]), publicId: 999, slug: "extra-999" };
  const actions = planSeedMigration([extra], []);
  assert.deepEqual(actions, []);
});

test("seed migration rejects duplicate existing public IDs and slugs before writes", () => {
  const first = toPersistenceProduct(records[0]);
  const duplicate = { ...first, _id: "duplicate" };
  const actions = planSeedMigration([first, duplicate], records.slice(0, 1));
  assert.deepEqual(
    actions.map(({ type, reason }) => ({ type, reason })),
    [
      { type: "conflict", reason: "duplicate-public-id" },
      { type: "conflict", reason: "duplicate-slug" },
    ],
  );
});

test("seed migration never rewrites a tombstone, so soft-deletes survive re-runs", () => {
  const tombstone = new Date("2026-01-01T00:00:00.000Z");
  const softDeleted = { ...toPersistenceProduct(records[0]), deletedAt: tombstone };

  // Tombstone-only difference is not catalog content drift, so it stays unchanged.
  const idle = planSeedMigration([softDeleted], [records[0]]);
  assert.equal(idle.find((action) => action.type === "update"), undefined);

  // Even when content drift forces an update, the payload must omit deletedAt.
  const drifted = { ...softDeleted, price: 1 };
  const actions = planSeedMigration([drifted], [records[0]]);
  const update = actions.find((action) => action.type === "update");
  assert.ok(update, "expected a content-driven update");
  assert.equal("deletedAt" in update.desired, false);
});
