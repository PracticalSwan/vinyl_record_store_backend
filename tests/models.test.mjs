import test from "node:test";
import assert from "node:assert/strict";
import {
  Cart,
  Interaction,
  Order,
  RecommendationLog,
  User,
  VinylRecord,
  Wishlist,
} from "../src/models/index.js";
import { toPersistenceProduct } from "../src/repositories/catalogMapping.js";
import { records } from "../src/data/records.js";
import { RETENTION_MS } from "../src/models/constants.js";

test("vinyl record model accepts the approved seed shape and rejects unknown fields", async () => {
  const product = new VinylRecord(toPersistenceProduct(records[0]));
  await product.validate();
  assert.throws(
    () => new VinylRecord({ ...toPersistenceProduct(records[0]), password: "not-allowed" }),
    /not in schema/,
  );
});

test("user secrets are excluded from default selections", () => {
  assert.equal(User.schema.path("passwordHash").options.select, false);
  assert.equal(User.schema.path("passwordSalt").options.select, false);
});

test("wishlist and cart schemas reject duplicate product IDs", async () => {
  const wishlist = new Wishlist({ userPublicId: "demo-user", productPublicIds: [1, 1] });
  const cart = new Cart({
    userPublicId: "demo-user",
    items: [{ productPublicId: 1, quantity: 1 }, { productPublicId: 1, quantity: 2 }],
  });
  await assert.rejects(() => wishlist.validate(), /must be unique/);
  await assert.rejects(() => cart.validate(), /must be unique/);
});

test("interaction requires a subject and retention TTL is declared", async () => {
  const interaction = new Interaction({
    eventId: "event-1",
    sessionId: "session-1",
    type: "product_view",
    productPublicId: 1,
    source: "groovehaus-frontend",
    surface: "product-detail",
    occurredAt: new Date(),
  });
  await assert.rejects(() => interaction.validate(), /subject is required/);
  const ttl = Interaction.schema.indexes().find(([keys]) => keys.expiresAt === 1);
  assert.equal(ttl[1].expireAfterSeconds, 0);
});

test("retention timestamps are server-owned", async () => {
  const suppliedExpiry = new Date("2099-01-01T00:00:00.000Z");
  const interaction = new Interaction({
    eventId: "event-retention",
    anonymousId: "anon-1",
    sessionId: "session-1",
    type: "product_view",
    productPublicId: 1,
    source: "groovehaus-frontend",
    surface: "product-detail",
    occurredAt: new Date(),
    receivedAt: new Date(0),
    expiresAt: suppliedExpiry,
  });
  const recommendationLog = new RecommendationLog({
    requestId: "request-retention",
    subjectType: "anonymous",
    subjectId: "anon-1",
    mode: "cold-start",
    algorithmVersion: "test-v1",
    surface: "catalog",
    items: [{ productPublicId: 1, score: 1, rank: 1 }],
    servedAt: new Date(0),
    expiresAt: suppliedExpiry,
  });

  await interaction.validate();
  await recommendationLog.validate();

  assert.equal(interaction.expiresAt.getTime() - interaction.receivedAt.getTime(), RETENTION_MS);
  assert.equal(recommendationLog.expiresAt.getTime() - recommendationLog.servedAt.getTime(), RETENTION_MS);
  assert.notEqual(interaction.expiresAt.getTime(), suppliedExpiry.getTime());
  assert.notEqual(recommendationLog.expiresAt.getTime(), suppliedExpiry.getTime());
});

test("optional product IDs accept null but reject non-integers", async () => {
  const searchInteraction = new Interaction({
    eventId: "event-search",
    anonymousId: "anon-1",
    sessionId: "session-1",
    type: "search_submit",
    source: "groovehaus-frontend",
    surface: "search",
    occurredAt: new Date(),
  });
  await searchInteraction.validate();

  searchInteraction.productPublicId = 1.5;
  await assert.rejects(() => searchInteraction.validate(), /Public ID must be an integer/);
});

test("recommendation logs declare request uniqueness and TTL retention", () => {
  const indexes = RecommendationLog.schema.indexes();
  assert.ok(indexes.some(([keys, options]) => keys.requestId === 1 && options.unique));
  assert.ok(indexes.some(([keys, options]) => keys.expiresAt === 1 && options.expireAfterSeconds === 0));
});

test("orders require at least one item and remain explicitly demo-only", async () => {
  const order = new Order({
    publicId: 1,
    userPublicId: "demo-user",
    items: [],
    subtotal: 0,
    currency: "USD",
  });
  await assert.rejects(() => order.validate(), /at least one item/);
  assert.equal(order.demo, true);
});
