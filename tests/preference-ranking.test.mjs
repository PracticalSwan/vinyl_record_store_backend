import test from "node:test";
import assert from "node:assert/strict";
import {
  PREFERENCE_RANKING_VERSION,
  rankByPreferences,
  scorePreferenceCandidates,
} from "../src/lib/recommender/preferenceRanking.js";
import { applyUserExclusions } from "../src/lib/recommender/exclusions.js";

const candidates = [
  { id: 1, title: "One", artist: "Alice", genre: "Jazz", format: "LP", price: 25, condition: "NM", stock: "in", catalogMode: "commerce-preview" },
  { id: 2, title: "Two", artist: "Alice", genre: "Jazz", format: "LP", price: 20, condition: "NM", stock: "in", catalogMode: "commerce-preview" },
  { id: 3, title: "Three", artist: "Bob", genre: "Rock", format: "CD", price: 50, condition: "G", stock: "in", catalogMode: "commerce-preview" },
];

test("preference ranking returns complete bounded maps and deterministic order", () => {
  const result = scorePreferenceCandidates(candidates, {
    favoriteGenres: ["Jazz"], favoriteArtists: ["Alice"], formats: ["LP"],
    budget: { min: 20, max: 30 }, conditions: ["NM"],
  });
  assert.equal(result.available, true);
  assert.equal(result.scoresByProductId.size, 3);
  assert.ok([...result.scoresByProductId.values()].every((entry) => entry.score >= 0 && entry.score <= 1));
  const ranked = rankByPreferences(candidates, result, { limit: 3 });
  assert.equal(ranked.algorithmVersion, undefined);
  assert.equal(ranked.recommendations[0].algorithmVersion, PREFERENCE_RANKING_VERSION);
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [1, 2, 3]);
});

test("research-only ranking ignores budget and condition groups", () => {
  const result = scorePreferenceCandidates(
    [{ ...candidates[0], price: null, condition: null, catalogMode: "research-only" }],
    { favoriteGenres: ["Jazz"], budget: { min: 20, max: 30 }, conditions: ["NM"] },
    { catalogMode: "research-only" },
  );
  assert.equal(result.scoresByProductId.get(1).score, 1);
});

test("feedback excludes exact products without artist or genre propagation", () => {
  const result = applyUserExclusions(candidates, [
    { productPublicId: 1, kind: "not-interested" },
    { productPublicId: 999, kind: "already-own" },
  ]);
  assert.deepEqual(result.excludedProductIds, [1]);
  assert.deepEqual(result.candidates.map((item) => item.id), [2, 3]);
});
