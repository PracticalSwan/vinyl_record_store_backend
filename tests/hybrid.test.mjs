import test from "node:test";
import assert from "node:assert/strict";
import {
  HYBRID_COMPONENT_WEIGHTS,
  HYBRID_RANKING_VERSION,
  combineRecommendationScores,
  rankHybrid,
} from "../src/lib/recommender/hybrid.js";
import { PREFERENCE_RANKING_VERSION } from "../src/lib/recommender/preferenceRanking.js";
import { BEHAVIOR_RANKING_VERSION } from "../src/lib/recommender/behavioralProfile.js";
import {
  POPULARITY_RANKING_VERSION,
  scorePopularityCandidates,
} from "../src/lib/recommender/popularity.js";

const DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v3";
const candidates = [
  { id: 1, title: "One", artist: "Same", datasetKey: DATASET_KEY },
  { id: 2, title: "Two", artist: "Same", datasetKey: DATASET_KEY },
  { id: 3, title: "Three", artist: "Same", datasetKey: DATASET_KEY },
  { id: 4, title: "Four", artist: "Other", datasetKey: DATASET_KEY },
];

function component(entries, available = true) {
  return {
    available,
    scoresByProductId: new Map(entries.map(([id, score, reasons = []]) => [
      id,
      { score, reasons },
    ])),
  };
}

const preference = component([
  [1, 1, ["Preference one."]],
  [2, 0, ["Unused zero preference."]],
  [3, 0.5, ["Preference three."]],
  [4, 0.5, ["Preference four."]],
]);
const behavior = component([
  [1, 0.5, ["Behavior one."]],
  [2, 1, ["Behavior two."]],
  [3, 0.5, ["Behavior three."]],
  [4, 0.5, ["Behavior four."]],
]);
const popularity = component([
  [1, 0.25, ["Popular."]],
  [2, 0.5, ["Popular."]],
  [3, 1, ["Popular."]],
  [4, 0, []],
]);

test("hybrid weights are fixed versioned assumptions and exact three-component math is bounded", () => {
  assert.deepEqual(HYBRID_COMPONENT_WEIGHTS, {
    preference: 0.45,
    behavior: 0.35,
    popularity: 0.20,
  });
  assert.ok(Object.isFrozen(HYBRID_COMPONENT_WEIGHTS));
  const result = combineRecommendationScores(candidates, { preference, behavior, popularity });
  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(result.algorithmVersion, HYBRID_RANKING_VERSION);
  assert.equal(result.scoresByProductId.get(1).score, 0.675);
  assert.ok(Math.abs(result.scoresByProductId.get(2).score - 0.45) < 1e-12);
  assert.deepEqual(result.scoresByProductId.get(1).reasons, ["Preference one.", "Behavior one."]);
  assert.deepEqual(result.scoresByProductId.get(2).reasons, ["Behavior two.", "Popular."]);
  assert.ok([...result.scoresByProductId.values()].every((entry) => entry.score >= 0 && entry.score <= 1));
});

test("preference and behavior renormalize once when popularity is absent without a second min-max pass", () => {
  const equalLow = component(candidates.map((candidate) => [candidate.id, 0.2, ["Low."]]));
  const result = combineRecommendationScores(candidates, {
    preference: equalLow,
    behavior: equalLow,
    popularity: { available: false },
  });
  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(result.scoresByProductId.get(1).score, 0.2);

  const renormalized = combineRecommendationScores(candidates, {
    preference,
    behavior,
    popularity: { available: false },
  });
  assert.equal(renormalized.scoresByProductId.get(1).score, 0.78125);
});

test("hybrid requires both personalized components and lower modes keep pure scores, reasons, and versions", () => {
  const preferenceOnly = combineRecommendationScores(candidates, {
    preference,
    behavior: { available: false },
    popularity,
  });
  assert.equal(preferenceOnly.mode, "preference-profile");
  assert.equal(preferenceOnly.algorithmVersion, PREFERENCE_RANKING_VERSION);
  assert.deepEqual(preferenceOnly.scoresByProductId.get(1), preference.scoresByProductId.get(1));

  const behaviorOnly = combineRecommendationScores(candidates, {
    preference: { available: false },
    behavior,
    popularity,
  });
  assert.equal(behaviorOnly.mode, "behavior-profile");
  assert.equal(behaviorOnly.algorithmVersion, BEHAVIOR_RANKING_VERSION);
  assert.deepEqual(behaviorOnly.scoresByProductId.get(2), behavior.scoresByProductId.get(2));

  const popularityOnly = combineRecommendationScores(candidates, {
    preference: { available: false },
    behavior: { available: false },
    popularity,
  });
  assert.equal(popularityOnly.mode, "popularity");
  assert.equal(popularityOnly.algorithmVersion, POPULARITY_RANKING_VERSION);

  const none = rankHybrid(candidates, {
    preference: { available: false },
    behavior: { available: false },
    popularity: { available: false },
  });
  assert.equal(none.available, false);
  assert.equal(none.mode, null);
  assert.deepEqual(none.recommendations, []);
});

test("rankHybrid delegates pure popularity ordering and keeps its count/mean tie-break", () => {
  const popularityScores = scorePopularityCandidates(candidates, [
    { productPublicId: 1, ratingCount: 5, meanRating: 4 },
    { productPublicId: 2, ratingCount: 5, meanRating: 5 },
    { productPublicId: 3, ratingCount: 1, meanRating: 5 },
  ]);
  const ranked = rankHybrid(candidates, {
    preference: { available: false },
    behavior: { available: false },
    popularity: popularityScores,
  }, { limit: 4 });
  assert.equal(ranked.mode, "popularity");
  assert.deepEqual(ranked.scoredCandidates.map((item) => item.product.id), [2, 1, 3, 4]);
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [2, 1, 4]);
});

test("true hybrid sorting uses public ID ties and applies the artist cap only after complete scoring", () => {
  const ties = component(candidates.map((candidate) => [candidate.id, 0.5, ["Same evidence."]]));
  const ranked = rankHybrid(candidates, {
    preference: ties,
    behavior: ties,
    popularity: ties,
  }, { limit: 4 });
  assert.deepEqual(ranked.scoredCandidates.map((item) => item.product.id), [1, 2, 3, 4]);
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [1, 2, 4]);
  assert.ok(ranked.recommendations.every((item) => item.algorithmVersion === HYBRID_RANKING_VERSION));
});

test("already-excluded feedback products stay outside every score and ranked map", () => {
  const eligible = candidates.filter((candidate) => candidate.id !== 1);
  const eligiblePreference = component([
    [2, 0.6, ["Preference."]],
    [3, 0.5, ["Preference."]],
    [4, 0.4, ["Preference."]],
  ]);
  const eligibleBehavior = component([
    [2, 0.4, ["Durable behavior."]],
    [3, 0.5, ["Durable behavior."]],
    [4, 0.6, ["Durable behavior."]],
  ]);
  const ranked = rankHybrid(eligible, {
    preference: eligiblePreference,
    behavior: eligibleBehavior,
    popularity: { available: false },
  });
  assert.equal(ranked.scoresByProductId.has(1), false);
  assert.ok(ranked.recommendations.every((item) => item.product.id !== 1));
});

test("hybrid explanations use only supplied durable behavior reasons and never invent passive evidence", () => {
  const durableBehavior = component(candidates.map((candidate) => [
    candidate.id,
    1,
    ["Similar to records you saved."],
  ]));
  const result = combineRecommendationScores(candidates, {
    preference,
    behavior: durableBehavior,
    popularity: { available: false },
  });
  assert.deepEqual(result.scoresByProductId.get(2).reasons, [
    "Similar to records you saved.",
  ]);
  assert.doesNotMatch(JSON.stringify([...result.scoresByProductId.values()]), /viewed|clicked/);
});

test("available component maps must be complete, bounded, and schema-safe", () => {
  assert.throws(
    () => combineRecommendationScores(candidates, {
      preference: component([[1, 0.5, []]]),
      behavior,
      popularity,
    }),
    /per candidate/,
  );
  assert.throws(
    () => combineRecommendationScores(candidates, {
      preference: component(candidates.map((candidate) => [candidate.id, 1.1, []])),
      behavior,
      popularity,
    }),
    /bounded score/,
  );
});
