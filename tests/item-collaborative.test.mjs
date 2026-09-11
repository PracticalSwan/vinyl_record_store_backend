import assert from "node:assert/strict";
import test from "node:test";
import {
  ITEM_COLLABORATIVE_ASSUMPTIONS,
  ITEM_COLLABORATIVE_VERSION,
  buildItemCollaborativeAnchors,
  rankByItemCollaborative,
  scoreItemCollaborativeCandidates,
} from "../src/lib/recommender/itemCollaborative.js";

const candidates = [
  { id: 10, title: "Ten", artist: "A" },
  { id: 11, title: "Eleven", artist: "B" },
  { id: 12, title: "Twelve", artist: "C" },
];

const profile = {
  ratings: [
    { productPublicId: 1, rating: 5 },
    { productPublicId: 2, rating: 4 },
    { productPublicId: 3, rating: 2 },
  ],
  wishlist: [2, 4],
  cart: [{ productPublicId: 5, quantity: 1 }],
};

const evidence = {
  supports: [
    { productPublicId: 1, positiveUserCount: 8 },
    { productPublicId: 2, positiveUserCount: 4 },
    { productPublicId: 4, positiveUserCount: 6 },
    { productPublicId: 5, positiveUserCount: 3 },
    { productPublicId: 10, positiveUserCount: 10 },
    { productPublicId: 11, positiveUserCount: 2 },
    { productPublicId: 12, positiveUserCount: 7 },
  ],
  pairs: [
    { sourceProductPublicId: 1, candidateProductPublicId: 10, coPositiveUsers: 3 },
    { sourceProductPublicId: 2, candidateProductPublicId: 10, coPositiveUsers: 2 },
    { sourceProductPublicId: 4, candidateProductPublicId: 11, coPositiveUsers: 1 },
    { sourceProductPublicId: 5, candidateProductPublicId: 12, coPositiveUsers: 2 },
  ],
};

test("item CF uses only positive account anchors and deduplicates overlapping signals", () => {
  assert.deepEqual(buildItemCollaborativeAnchors(profile), [1, 2, 4, 5]);
  assert.equal(ITEM_COLLABORATIVE_VERSION, "item-cf-v1");
  assert.deepEqual(ITEM_COLLABORATIVE_ASSUMPTIONS, {
    positiveRatingThreshold: 4,
    minimumCoPositiveUsers: 2,
    shrinkage: 5,
  });
});

test("item CF applies cosine similarity, significance shrinkage, minimum support, and deterministic ranking", () => {
  const scored = scoreItemCollaborativeCandidates(candidates, profile, evidence);
  assert.equal(scored.available, true);
  assert.equal(scored.scoresByProductId.get(10).score, 1);
  assert.equal(scored.scoresByProductId.get(11).score, 0);
  assert.ok(scored.scoresByProductId.get(12).score > 0);
  assert.ok(scored.scoresByProductId.get(12).score < 1);
  assert.match(scored.scoresByProductId.get(10).reasons[0], /listeners/i);

  const ranked = rankByItemCollaborative(candidates, scored, { limit: 3 });
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [10, 12]);
  assert.ok(ranked.recommendations.every((item) => item.score > 0));
  assert.ok(ranked.recommendations.every((item) => item.algorithmVersion === ITEM_COLLABORATIVE_VERSION));
});

test("item CF fails closed when only one-user co-occurrence or malformed evidence exists", () => {
  const sparse = scoreItemCollaborativeCandidates(candidates, profile, {
    supports: evidence.supports,
    pairs: [{ sourceProductPublicId: 4, candidateProductPublicId: 11, coPositiveUsers: 1 }],
  });
  assert.equal(sparse.available, false);
  assert.ok([...sparse.scoresByProductId.values()].every((entry) => entry.score === 0));

  assert.throws(
    () => scoreItemCollaborativeCandidates(candidates, profile, {
      supports: [{ productPublicId: 1, positiveUserCount: -1 }],
      pairs: [],
    }),
    /positive support/i,
  );
});
