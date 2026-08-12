import test from "node:test";
import assert from "node:assert/strict";
import {
  POPULARITY_RANKING_VERSION,
  getCandidateDatasetKey,
  rankByPopularity,
  scorePopularityCandidates,
} from "../src/lib/recommender/popularity.js";

const DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v3";
const candidates = [
  { id: 1, title: "One", artist: "Same", datasetKey: DATASET_KEY, price: null, stock: null },
  { id: 2, title: "Two", artist: "Same", datasetKey: DATASET_KEY, condition: null },
  { id: 3, title: "Three", artist: "Same", datasetKey: DATASET_KEY },
  { id: 4, title: "Four", artist: null, datasetKey: DATASET_KEY },
  { id: 5, title: "Five", artist: "Other", datasetKey: DATASET_KEY },
];

test("candidate-owned dataset key is required and mixed releases fail closed", () => {
  assert.equal(getCandidateDatasetKey(candidates), DATASET_KEY);
  assert.equal(getCandidateDatasetKey([]), null);
  assert.equal(getCandidateDatasetKey([{ id: 1, datasetKey: null }]), null);
  assert.throws(
    () => getCandidateDatasetKey([
      { id: 1, datasetKey: DATASET_KEY },
      { id: 2, datasetKey: "amazon-reviews-2023-cds-vinyl-5core-v2" },
    ]),
    /share one dataset key/,
  );
});

test("popularity joins public product IDs, isolates release keys, and returns a complete bounded map", () => {
  const scores = scorePopularityCandidates(candidates, [
    { datasetKey: DATASET_KEY, productPublicId: 1, ratingCount: 10, meanRating: 4 },
    { datasetKey: DATASET_KEY, productPublicId: 2, ratingCount: 5, meanRating: 5 },
    { datasetKey: DATASET_KEY, productPublicId: 999, ratingCount: 100, meanRating: 5 },
    { datasetKey: "amazon-reviews-2023-cds-vinyl-5core-v2", productPublicId: 3, ratingCount: 50, meanRating: 5 },
  ]);
  assert.equal(scores.available, true);
  assert.equal(scores.datasetKey, DATASET_KEY);
  assert.equal(scores.scoresByProductId.size, candidates.length);
  assert.equal(scores.scoresByProductId.get(1).score, 1);
  assert.equal(scores.scoresByProductId.get(2).score, 0.5);
  assert.equal(scores.scoresByProductId.get(3).score, 0);
  assert.deepEqual(scores.scoresByProductId.get(3).reasons, []);
  assert.ok([...scores.scoresByProductId.values()].every((entry) => entry.score >= 0 && entry.score <= 1));
});

test("standalone popularity is count-first, then mean, public ID, and applies artist diversity last", () => {
  const ranked = rankByPopularity(candidates, [
    { productPublicId: 1, ratingCount: 10, meanRating: 4 },
    { productPublicId: 2, ratingCount: 10, meanRating: 4.5 },
    { productPublicId: 3, ratingCount: 10, meanRating: 4.5 },
    { productPublicId: 4, ratingCount: 2, meanRating: null },
  ], { limit: 5 });
  assert.deepEqual(ranked.scoredCandidates.map((item) => item.product.id), [2, 3, 1, 4, 5]);
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [2, 3, 4, 5]);
  assert.ok(ranked.recommendations.every((item) => item.algorithmVersion === POPULARITY_RANKING_VERSION));
  assert.ok(ranked.recommendations.every((item) => !("ratingCount" in item) && !("meanRating" in item)));
});

test("legacy or seed candidates and zero-rating datasets make popularity unavailable deterministically", () => {
  const seedCandidates = [
    { id: 2, title: "Two", artist: "A", datasetKey: null },
    { id: 1, title: "One", artist: "B", datasetKey: null },
  ];
  const seedScores = scorePopularityCandidates(seedCandidates, [
    { productPublicId: 1, ratingCount: 50, meanRating: 5 },
  ]);
  assert.equal(seedScores.available, false);
  assert.deepEqual([...seedScores.scoresByProductId.values()], [
    { score: 0, reasons: [] },
    { score: 0, reasons: [] },
  ]);

  const zeroScores = scorePopularityCandidates(candidates, [
    { productPublicId: 1, ratingCount: 0, meanRating: null },
  ]);
  assert.equal(zeroScores.available, false);
  const ranked = rankByPopularity(candidates, zeroScores, { limit: 5 });
  assert.deepEqual(ranked.scoredCandidates.map((item) => item.product.id), [1, 2, 3, 4, 5]);
});

test("aggregate identity-like fields never enter popularity score or ranked outputs", () => {
  const scores = scorePopularityCandidates(candidates, [
    {
      datasetKey: DATASET_KEY,
      productPublicId: 1,
      ratingCount: 1,
      meanRating: 5,
      userKey: "must-not-leak",
    },
  ]);
  const ranked = rankByPopularity(candidates, scores, { limit: 2 });
  const serialized = JSON.stringify({
    scores: [...scores.scoresByProductId],
    recommendations: ranked.recommendations,
  });
  assert.doesNotMatch(serialized, /must-not-leak|userKey/);
});

test("malformed and duplicate active-release aggregates fail closed", () => {
  assert.throws(
    () => scorePopularityCandidates(candidates, [
      { productPublicId: 1, ratingCount: 1, meanRating: 5 },
      { productPublicId: 1, ratingCount: 2, meanRating: 4 },
    ]),
    /at most one row/,
  );
  assert.throws(
    () => scorePopularityCandidates(candidates, [
      { productPublicId: 1, ratingCount: -1, meanRating: null },
    ]),
    /non-negative integers/,
  );
});
