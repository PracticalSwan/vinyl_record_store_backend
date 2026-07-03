import test from "node:test";
import assert from "node:assert/strict";
import {
  parseGuestMerge,
  parseInteractionBatch,
  parsePreferences,
  parseQuantity,
  parseRating,
} from "../src/validation/writes.js";

test("preference validation enforces controlled values, overlap, budget, and completion", () => {
  const value = parsePreferences({
    favoriteGenres: ["Jazz"],
    dislikedGenres: ["Rock"],
    favoriteArtists: ["Miles Davis"],
    budget: { min: 20, max: 100 },
    conditions: ["NM"],
    formats: ["LP, 33 1/3 rpm"],
    completed: true,
  });
  assert.equal(value.completedAt instanceof Date, true);
  assert.throws(
    () => parsePreferences({ favoriteGenres: ["Jazz"], dislikedGenres: ["Jazz"] }),
    /cannot overlap/,
  );
  assert.throws(
    () => parsePreferences({ favoriteGenres: [], budget: { min: 20, max: 10 } }),
    /cannot be greater/,
  );
  assert.throws(
    () => parsePreferences({ favoriteGenres: [], completed: true }),
    /favorite genre/,
  );
});

test("quantity and rating validation use absolute bounded integers", () => {
  assert.equal(parseQuantity({ quantity: 99 }), 99);
  assert.equal(parseRating({ rating: 5 }), 5);
  assert.throws(() => parseQuantity({ quantity: 0 }), /1 through 99/);
  assert.throws(() => parseRating({ rating: 2.5 }), /1 through 5/);
});

test("anonymous interaction batches reject PII, duplicates, missing identity, and invalid values", () => {
  const now = Date.now();
  const event = {
    eventId: "event-1",
    v: 1,
    type: "rating_set",
    anonymousId: "anon-1",
    sessionId: "session-1",
    productId: 1,
    occurredAt: new Date(now).toISOString(),
    source: "groovehaus-frontend",
    surface: "product-detail",
    value: 5,
  };
  assert.equal(parseInteractionBatch({ events: [event] }, { now })[0].productPublicId, 1);
  assert.throws(
    () => parseInteractionBatch({ events: [{ ...event, email: "person@example.test" }] }, { now }),
    /unsupported fields/,
  );
  assert.throws(
    () => parseInteractionBatch({ events: [{ ...event, anonymousId: undefined }] }, { now }),
    /require anonymousId/,
  );
  assert.throws(
    () => parseInteractionBatch({ events: [event, event] }, { now }),
    /unique within a batch/,
  );
  assert.throws(
    () => parseInteractionBatch({ events: [{ ...event, value: 6 }] }, { now }),
    /value from 1 through 5/,
  );
  assert.throws(
    () => parseInteractionBatch({ events: [{ ...event, productId: undefined }] }, { now }),
    /require productId/,
  );
});

test("guest merge input is bounded, unique, and uses absolute quantities", () => {
  const now = Date.now();
  const value = parseGuestMerge({
    mergeId: "merge-1",
    wishlist: [1, 2],
    cart: [{ productId: 1, quantity: 2 }],
    ratings: [{ productId: 2, rating: 4, updatedAt: new Date(now).toISOString() }],
  }, { now });
  assert.deepEqual(value.wishlist, [1, 2]);
  assert.throws(
    () => parseGuestMerge({ mergeId: "merge-1", wishlist: [1, 1] }, { now }),
    /duplicate products/,
  );
  const olderRating = parseGuestMerge({
    mergeId: "merge-old",
    ratings: [{ productId: 1, rating: 3, updatedAt: "2020-01-01T00:00:00.000Z" }],
  }, { now });
  assert.equal(olderRating.ratings[0].updatedAt.getUTCFullYear(), 2020);
});
