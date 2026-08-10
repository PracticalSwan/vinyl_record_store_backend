import test from "node:test";
import assert from "node:assert/strict";
import {
  BEHAVIOR_AFFINITY_ASSUMPTIONS,
  BEHAVIOR_RANKING_VERSION,
  buildBehaviorAffinity,
  rankByBehavior,
  scoreBehaviorCandidates,
} from "../src/lib/recommender/behavioralProfile.js";

const NOW = new Date("2026-08-10T12:00:00.000Z");
const catalog = [
  { id: 1, title: "Alpha", artist: "Artist A", genre: "Jazz", format: "LP" },
  { id: 2, title: "Beta", artist: "Artist A", genre: "Jazz", format: "LP" },
  { id: 3, title: "Gamma", artist: "Artist B", genre: "Rock", format: "CD" },
  { id: 4, title: "Delta", artist: "Artist C", genre: "Soul", format: "EP" },
];

test("behavioral assumptions are versioned, exported, and fixed", () => {
  assert.equal(BEHAVIOR_AFFINITY_ASSUMPTIONS.version, BEHAVIOR_RANKING_VERSION);
  assert.equal(BEHAVIOR_RANKING_VERSION, "behavior-profile-v1");
  assert.equal(BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.rating5, 4);
  assert.equal(BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.passiveEventsPerProduct, 3);
  assert.ok(Object.isFrozen(BEHAVIOR_AFFINITY_ASSUMPTIONS));
});

test("current ratings are strong signed evidence and replacement or deletion changes availability", () => {
  const positive = buildBehaviorAffinity(
    { ratings: [{ productPublicId: 1, rating: 5 }] },
    catalog,
    { now: NOW },
  );
  const positiveScores = scoreBehaviorCandidates(catalog, positive);
  assert.equal(positiveScores.available, true);
  assert.equal(positiveScores.scoresByProductId.size, catalog.length);
  assert.equal(positiveScores.scoresByProductId.get(2).score, 1);
  assert.ok(positiveScores.scoresByProductId.get(2).reasons.every((reason) => reason.includes("rated highly")));
  assert.equal(positiveScores.scoresByProductId.get(3).score, 0.5);

  const replacement = buildBehaviorAffinity(
    { ratings: [{ productPublicId: 1, rating: 1 }] },
    catalog,
    { now: NOW },
  );
  const replacementScores = scoreBehaviorCandidates(catalog, replacement);
  assert.equal(replacementScores.scoresByProductId.get(2).score, 0);
  assert.deepEqual(replacementScores.scoresByProductId.get(2).reasons, []);

  const deletion = buildBehaviorAffinity({ ratings: [] }, catalog, { now: NOW });
  assert.equal(scoreBehaviorCandidates(catalog, deletion).available, false);
});

test("wishlist, cart quantity, and enabled feedback use current durable state only", () => {
  const profile = {
    wishlist: [1],
    cart: [{ productPublicId: 3, quantity: 2 }],
    explicitFeedback: [
      { productPublicId: 1, kind: "already-own" },
      { productPublicId: 4, kind: "not-interested" },
    ],
  };
  const enabled = buildBehaviorAffinity(profile, catalog, { now: NOW, feedbackEnabled: true });
  assert.ok(enabled.evidenceByAttribute.artist.get("artist a") > 0);
  assert.ok(enabled.evidenceByAttribute.artist.get("artist b") > 0);
  assert.ok(enabled.evidenceByAttribute.artist.get("artist c") < 0);
  const scores = scoreBehaviorCandidates(catalog.filter((candidate) => candidate.id !== 1), enabled);
  assert.ok(scores.scoresByProductId.get(2).score > 0.5);
  assert.ok(scores.scoresByProductId.get(2).reasons.some((reason) => reason.includes("already own")));
  assert.ok(scores.scoresByProductId.get(4).score < 0.5);
  assert.equal(scores.scoresByProductId.get(4).reasons.length, 0);

  const disabled = buildBehaviorAffinity(
    { explicitFeedback: profile.explicitFeedback },
    catalog,
    { now: NOW, feedbackEnabled: false },
  );
  assert.equal(disabled.available, false);
});

test("passive evidence honors allowed types, recency bands, UTC-day deduplication, and per-product caps", () => {
  const passiveInteractions = [
    { type: "recommendation_click", productPublicId: 1, occurredAt: "2026-08-09T10:00:00Z" },
    { type: "recommendation_click", productPublicId: 1, occurredAt: "2026-08-09T11:00:00Z" },
    { type: "product_view", productPublicId: 1, occurredAt: "2026-08-08T10:00:00Z" },
    { type: "product_view", productPublicId: 1, occurredAt: "2026-08-07T10:00:00Z" },
    { type: "search_result_click", productPublicId: 1, occurredAt: "2026-08-06T10:00:00Z" },
    { type: "recommendation_impression", productPublicId: 1, occurredAt: "2026-08-05T10:00:00Z" },
    { type: "recommendation_wishlist_add", productPublicId: 1, occurredAt: "2026-08-04T10:00:00Z" },
    { type: "recommendation_click", productPublicId: 3, occurredAt: "2026-07-26T10:00:00Z" },
    { type: "recommendation_click", productPublicId: 4, occurredAt: "2026-06-11T10:00:00Z" },
    { type: "recommendation_click", productPublicId: 4, occurredAt: "2026-04-01T10:00:00Z" },
  ];
  const affinity = buildBehaviorAffinity({ passiveInteractions }, catalog, { now: NOW });
  assert.equal(affinity.evidenceByAttribute.artist.get("artist a"), 2.25);
  assert.equal(affinity.evidenceByAttribute.artist.get("artist b"), 0.5);
  assert.equal(affinity.evidenceByAttribute.artist.get("artist c"), 0.25);
  assert.ok(
    scoreBehaviorCandidates(catalog, affinity).scoresByProductId.get(2).reasons
      .includes("Similar to records you viewed or clicked."),
  );

  const trackingOff = buildBehaviorAffinity(
    { passiveInteractions },
    catalog,
    { now: NOW, trackingEnabled: false },
  );
  assert.equal(trackingOff.available, false);
});

test("attribute caps prevent repeated weak or durable evidence from dominating", () => {
  const repeatedCatalog = Array.from({ length: 6 }, (_, index) => ({
    id: index + 1,
    title: `Record ${index + 1}`,
    artist: "Repeated Artist",
    genre: `Genre ${index + 1}`,
    format: `Format ${index + 1}`,
  }));
  const affinity = buildBehaviorAffinity(
    { wishlist: repeatedCatalog.map((candidate) => candidate.id) },
    repeatedCatalog,
    { now: NOW },
  );
  assert.equal(
    affinity.evidenceByAttribute.artist.get("repeated artist"),
    BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.attributeAbsoluteEvidence,
  );

  const passiveInteractions = repeatedCatalog.flatMap((candidate, index) => [0, 1, 2].map((offset) => ({
    type: "recommendation_click",
    productPublicId: candidate.id,
    occurredAt: new Date(NOW.getTime() - (index * 3 + offset) * 60 * 60 * 1000),
  })));
  const durablePrecedence = buildBehaviorAffinity({
    ratings: [{ productPublicId: 1, rating: 1 }],
    passiveInteractions,
  }, repeatedCatalog, { now: NOW });
  assert.equal(
    durablePrecedence.evidenceByAttribute.artist.get("repeated artist"),
    -1,
  );
});

test("behavior scoring falls back when evidence cannot affect eligible active candidates", () => {
  const sourceAffinity = buildBehaviorAffinity(
    { wishlist: [1] },
    catalog,
    { now: NOW },
  );
  const unrelated = [
    { id: 10, title: "Unrelated", artist: null, genre: null, format: null },
    { id: 11, title: "Other", artist: "Other", genre: "Other", format: "Other" },
  ];
  const scores = scoreBehaviorCandidates(unrelated, sourceAffinity);
  assert.equal(scores.available, false);
  assert.equal(scores.scoresByProductId.size, unrelated.length);
  assert.deepEqual([...scores.scoresByProductId.values()], [
    { score: 0.5, reasons: [] },
    { score: 0.5, reasons: [] },
  ]);
});

test("standalone behavior ranking is deterministic and applies the two-per-artist cap after scoring", () => {
  const candidates = [
    { id: 3, title: "Third", artist: "Same" },
    { id: 1, title: "First", artist: "Same" },
    { id: 2, title: "Second", artist: "Same" },
    { id: 4, title: "Fourth", artist: "Other" },
  ];
  const scoresByProductId = new Map(candidates.map((candidate) => [
    candidate.id,
    { score: 0.75, reasons: ["Durable evidence."] },
  ]));
  const ranked = rankByBehavior(
    candidates,
    { available: true, scoresByProductId },
    { limit: 4 },
  );
  assert.deepEqual(ranked.scoredCandidates.map((item) => item.product.id), [1, 2, 3, 4]);
  assert.deepEqual(ranked.recommendations.map((item) => item.product.id), [1, 2, 4]);
  assert.ok(ranked.recommendations.every((item) => item.algorithmVersion === BEHAVIOR_RANKING_VERSION));
});
