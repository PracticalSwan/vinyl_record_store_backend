import test from "node:test";
import assert from "node:assert/strict";
import { serveUserRecommendations } from "../src/services/recommendations.js";

const candidates = [
  {
    id: 1,
    title: "Jazz One",
    artist: "Artist A",
    genre: "Jazz",
    format: "LP",
    stock: "in",
    catalogMode: "research-only",
    datasetKey: "release-v3",
  },
  {
    id: 2,
    title: "Jazz Two",
    artist: "Artist A",
    genre: "Jazz",
    format: "LP",
    stock: "in",
    catalogMode: "research-only",
    datasetKey: "release-v3",
  },
  {
    id: 3,
    title: "Rock Three",
    artist: "Artist B",
    genre: "Rock",
    format: "CD",
    stock: "in",
    catalogMode: "research-only",
    datasetKey: "release-v3",
  },
  {
    id: 4,
    title: "Soul Four",
    artist: "Artist C",
    genre: "Soul",
    format: "EP",
    stock: "in",
    catalogMode: "research-only",
    datasetKey: "release-v3",
  },
];

const actor = { kind: "registered", publicId: "customer-1" };
const context = { actor, surface: "home", trackingAllowed: false };
const repository = { listRecommendationCandidates: async () => candidates };

test("registered behavior mode uses the complete candidate set and versioned reasons", async () => {
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: { ratings: [{ productPublicId: 1, rating: 5 }] },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_BEHAVIORAL_RANKING: "true",
    },
  });
  assert.equal(result.mode, "behavior-profile");
  assert.equal(result.algorithmVersion, "behavior-profile-v1");
  assert.ok(result.recommendations.every((item) => Array.isArray(item.reasons)));
  assert.ok(result.recommendations.some((item) => item.reasons.length > 0));
});

test("tracking opt-out keeps passive profile evidence out of behavior mode", async () => {
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: {
      passiveInteractions: [{
        type: "recommendation_click",
        productPublicId: 1,
        occurredAt: "2026-08-10T10:00:00.000Z",
      }],
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_BEHAVIORAL_RANKING: "true",
    },
  });
  assert.equal(result.mode, "cold-start");
  assert.equal(result.algorithmVersion, "content-demo-v1");
  assert.ok(result.recommendations.every((item) => item.reasons[0] === "Listed in the current catalog."));
});

test("preference and behavior components form one hybrid after exact feedback exclusion", async () => {
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: {
      explicitPreferences: { favoriteGenres: ["Jazz"] },
      ratings: [{ productPublicId: 1, rating: 5 }],
      explicitFeedback: [{ productPublicId: 1, kind: "not-interested" }],
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_PREFERENCE_RANKING: "true",
      PERS_BEHAVIORAL_RANKING: "true",
      PERS_NEGATIVE_FEEDBACK: "true",
      PERS_HYBRID: "true",
    },
  });
  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(result.algorithmVersion, "personalized-hybrid-v1");
  assert.ok(result.recommendations.every((item) => item.product.id !== 1));
  assert.equal("excludedProductIds" in result, false);
});

test("anonymous popularity uses one candidate-owned dataset key read and never falls through to identities", async () => {
  let reads = 0;
  const result = await serveUserRecommendations(
    { kind: "anonymous" },
    3,
    { actor: { kind: "anonymous" }, surface: "home", trackingAllowed: false },
    {
      repository,
      popularityRepository: {
        listByDatasetKey: async (datasetKey) => {
          reads += 1;
          assert.equal(datasetKey, "release-v3");
          return [
            { datasetKey, productPublicId: 3, ratingCount: 9, meanRating: 4.8 },
            { datasetKey, productPublicId: 2, ratingCount: 3, meanRating: 4.2 },
          ];
        },
      },
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_POPULARITY: "true",
      },
    },
  );
  assert.equal(reads, 1);
  assert.equal(result.mode, "popularity");
  assert.equal(result.algorithmVersion, "popularity-v1");
  assert.ok(result.recommendations.every((item) => !JSON.stringify(item).includes("userKey")));
});

test("pure preference mode does not depend on an unused popularity read", async () => {
  let popularityReads = 0;
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: { explicitPreferences: { favoriteGenres: ["Jazz"] } },
    popularityRepository: {
      listByDatasetKey: async () => {
        popularityReads += 1;
        throw new Error("unused popularity should not be queried");
      },
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_PREFERENCE_RANKING: "true",
      PERS_POPULARITY: "true",
    },
  });
  assert.equal(popularityReads, 0);
  assert.equal(result.mode, "preference-profile");
  assert.equal(result.algorithmVersion, "preference-profile-v1");
});

test("pure behavior mode does not depend on an unused popularity read", async () => {
  let popularityReads = 0;
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: { ratings: [{ productPublicId: 1, rating: 5 }] },
    popularityRepository: {
      listByDatasetKey: async () => {
        popularityReads += 1;
        throw new Error("unused popularity should not be queried");
      },
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_BEHAVIORAL_RANKING: "true",
      PERS_POPULARITY: "true",
    },
  });
  assert.equal(popularityReads, 0);
  assert.equal(result.mode, "behavior-profile");
  assert.equal(result.algorithmVersion, "behavior-profile-v1");
});
