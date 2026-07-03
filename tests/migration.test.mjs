import test from "node:test";
import assert from "node:assert/strict";
import { records } from "../src/data/records.js";
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
