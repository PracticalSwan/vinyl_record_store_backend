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

test("PERS-09 fail-closed parent and hybrid dependencies preserve the lower mode matrix", async () => {
  const cases = [
    {
      name: "profile off keeps all child ranking flags inert",
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_PROFILE_DOMAIN: "false",
        PERS_PREFERENCE_RANKING: "true",
        PERS_BEHAVIORAL_RANKING: "true",
        PERS_NEGATIVE_FEEDBACK: "true",
        PERS_HYBRID: "true",
      },
      mode: "cold-start",
      version: "content-demo-v1",
    },
    {
      name: "hybrid flag cannot substitute for missing behavior dependency",
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_PROFILE_DOMAIN: "true",
        PERS_PREFERENCE_RANKING: "true",
        PERS_HYBRID: "true",
      },
      mode: "preference-profile",
      version: "preference-profile-v1",
    },
    {
      name: "hybrid flag cannot substitute for missing preference dependency",
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_PROFILE_DOMAIN: "true",
        PERS_BEHAVIORAL_RANKING: "true",
        PERS_HYBRID: "true",
      },
      mode: "behavior-profile",
      version: "behavior-profile-v1",
    },
    {
      name: "hybrid disabled preserves preference precedence when both components exist",
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_PROFILE_DOMAIN: "true",
        PERS_PREFERENCE_RANKING: "true",
        PERS_BEHAVIORAL_RANKING: "true",
        PERS_HYBRID: "false",
      },
      mode: "preference-profile",
      version: "preference-profile-v1",
    },
  ];
  const profile = {
    explicitPreferences: { favoriteGenres: ["Jazz"] },
    ratings: [{ productPublicId: 1, rating: 5 }],
    explicitFeedback: [{ productPublicId: 1, kind: "not-interested" }],
  };

  for (const fixture of cases) {
    const result = await serveUserRecommendations(actor, 3, context, {
      repository,
      profile,
      environment: fixture.environment,
    });
    assert.equal(result.mode, fixture.mode, fixture.name);
    assert.equal(result.algorithmVersion, fixture.version, fixture.name);
    assert.ok(result.recommendations.some((item) => item.product.id === 1), `${fixture.name}: feedback is inert`);
  }
});

test("popularity remains independent of the profile domain flag", async () => {
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
          return [{ datasetKey, productPublicId: 3, ratingCount: 2, meanRating: 5 }];
        },
      },
      environment: {
        CATALOG_DATA_SOURCE: "seed",
        PERS_PROFILE_DOMAIN: "false",
        PERS_POPULARITY: "true",
      },
    },
  );
  assert.equal(reads, 1);
  assert.equal(result.mode, "popularity");
  assert.equal(result.algorithmVersion, "popularity-v1");
});

test("full hybrid uses one candidate read, one popularity read, and logs the exact safe served list", async () => {
  let candidateReads = 0;
  let popularityReads = 0;
  let logged;
  const result = await serveUserRecommendations(actor, 3, { ...context, trackingAllowed: true }, {
    repository: {
      listRecommendationCandidates: async () => {
        candidateReads += 1;
        return candidates;
      },
    },
    profile: {
      explicitPreferences: { favoriteGenres: ["Jazz"] },
      ratings: [{ productPublicId: 1, rating: 5 }],
      explicitFeedback: [{ productPublicId: 4, kind: "already-own" }],
    },
    popularityRepository: {
      listByDatasetKey: async (datasetKey) => {
        popularityReads += 1;
        return [
          { datasetKey, productPublicId: 1, ratingCount: 2, meanRating: 4 },
          { datasetKey, productPublicId: 2, ratingCount: 5, meanRating: 5 },
          { datasetKey, productPublicId: 3, ratingCount: 1, meanRating: 3 },
        ];
      },
    },
    events: { appendRecommendationLog: async (value) => { logged = value; return {}; } },
    environment: {
      CATALOG_DATA_SOURCE: "mongodb",
      MONGODB_URI: "mongodb://localhost:27017",
      MONGODB_DB_NAME: "test",
      PERS_PROFILE_DOMAIN: "true",
      PERS_PREFERENCE_RANKING: "true",
      PERS_BEHAVIORAL_RANKING: "true",
      PERS_NEGATIVE_FEEDBACK: "true",
      PERS_POPULARITY: "true",
      PERS_HYBRID: "true",
    },
  });

  assert.equal(candidateReads, 1);
  assert.equal(popularityReads, 1);
  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(result.algorithmVersion, "personalized-hybrid-v1");
  assert.deepEqual(logged.items, result.recommendations.map((item) => ({
    productPublicId: item.product.id,
    score: item.score,
    rank: item.rank,
    reasons: item.reasons,
  })));
  assert.equal(logged.mode, result.mode);
  assert.equal(logged.algorithmVersion, result.algorithmVersion);
  assert.deepEqual(logged.excludedProductIds, [4]);
  const serialized = JSON.stringify(result);
  for (const privateName of [
    "_id",
    "subjectId",
    "userPublicId",
    "userKey",
    "explicitPreferences",
    "explicitFeedback",
    "passiveInteractions",
    "ratingCount",
    "meanRating",
    "excludedProductIds",
    "componentWeights",
  ]) {
    assert.equal(serialized.includes(`\"${privateName}\"`), false, privateName);
  }
});

test("service prepares preference and behavior components exactly once before popularity", async () => {
  let preferenceReads = 0;
  let ratingReads = 0;
  const profile = {
    get explicitPreferences() {
      preferenceReads += 1;
      return { favoriteGenres: ["Jazz"] };
    },
    get ratings() {
      ratingReads += 1;
      return [{ productPublicId: 1, rating: 5 }];
    },
  };
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile,
    popularityRepository: {
      listByDatasetKey: async (datasetKey) => ([
        { datasetKey, productPublicId: 1, ratingCount: 2, meanRating: 4 },
      ]),
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_PREFERENCE_RANKING: "true",
      PERS_BEHAVIORAL_RANKING: "true",
      PERS_POPULARITY: "true",
      PERS_HYBRID: "true",
    },
  });

  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(preferenceReads, 1);
  assert.equal(ratingReads, 1);
});

test("rating 5 plus not-interested suppresses only that item while preserving rating affinity", async () => {
  const result = await serveUserRecommendations(actor, 3, context, {
    repository,
    profile: {
      ratings: [{ productPublicId: 1, rating: 5 }],
      explicitFeedback: [{ productPublicId: 1, kind: "not-interested" }],
    },
    environment: {
      CATALOG_DATA_SOURCE: "seed",
      PERS_PROFILE_DOMAIN: "true",
      PERS_NEGATIVE_FEEDBACK: "true",
      PERS_BEHAVIORAL_RANKING: "true",
    },
  });
  assert.equal(result.mode, "behavior-profile");
  assert.equal(result.recommendations.some((item) => item.product.id === 1), false);
  assert.equal(result.recommendations[0].product.id, 2);
  assert.ok(result.recommendations[0].reasons.some((reason) => reason.includes("rated highly")));
});

test("required catalog and popularity failures propagate instead of becoming fallbacks", async () => {
  const catalogFailure = new Error("catalog unavailable");
  await assert.rejects(
    () => serveUserRecommendations(
      { kind: "anonymous" },
      3,
      { actor: { kind: "anonymous" }, surface: "home", trackingAllowed: false },
      {
        repository: { listRecommendationCandidates: async () => { throw catalogFailure; } },
        environment: { CATALOG_DATA_SOURCE: "seed" },
      },
    ),
    catalogFailure,
  );

  const popularityFailure = new Error("popularity unavailable");
  await assert.rejects(
    () => serveUserRecommendations(
      { kind: "anonymous" },
      3,
      { actor: { kind: "anonymous" }, surface: "home", trackingAllowed: false },
      {
        repository,
        popularityRepository: { listByDatasetKey: async () => { throw popularityFailure; } },
        environment: { CATALOG_DATA_SOURCE: "seed", PERS_POPULARITY: "true" },
      },
    ),
    popularityFailure,
  );
});
