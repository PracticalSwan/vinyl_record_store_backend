import assert from "node:assert/strict";
import test from "node:test";
import { personalizationItemCollaborativeEnabled } from "../src/lib/features.js";
import { serveUserRecommendations } from "../src/services/recommendations.js";

const candidates = [
  { id: 1, title: "Known Jazz", artist: "Artist A", genre: "Jazz", format: "LP", stock: "in", catalogMode: "research-only", datasetKey: "release-v3" },
  { id: 2, title: "Collaborative Jazz", artist: "Artist B", genre: "Jazz", format: "LP", stock: "in", catalogMode: "research-only", datasetKey: "release-v3" },
  { id: 3, title: "Rock", artist: "Artist C", genre: "Rock", format: "LP", stock: "in", catalogMode: "research-only", datasetKey: "release-v3" },
];
const actor = { kind: "registered", publicId: "customer-1" };
const context = { actor, surface: "recommendations", trackingAllowed: false };
const repository = { listRecommendationCandidates: async () => candidates };
const profile = {
  explicitPreferences: { favoriteGenres: ["Jazz"] },
  ratings: [{ productPublicId: 1, rating: 5 }],
  wishlist: [],
  cart: [],
};
const environment = {
  CATALOG_DATA_SOURCE: "seed",
  PERS_PROFILE_DOMAIN: "true",
  PERS_PREFERENCE_RANKING: "true",
  PERS_ITEM_CF: "true",
  PERS_HYBRID: "true",
};

test("item-CF feature gate defaults off and is explicitly reversible", () => {
  assert.equal(personalizationItemCollaborativeEnabled({}), false);
  assert.equal(personalizationItemCollaborativeEnabled({ PERS_ITEM_CF: "true" }), true);
  assert.equal(personalizationItemCollaborativeEnabled({ PERS_ITEM_CF: "false" }), false);
});

test("item CF is fetched once and contributes to the live weighted hybrid", async () => {
  let reads = 0;
  const result = await serveUserRecommendations(actor, 2, context, {
    repository,
    profile,
    collaborativeRepository: {
      listItemEvidence: async (datasetKey, anchors) => {
        reads += 1;
        assert.equal(datasetKey, "release-v3");
        assert.deepEqual(anchors, [1]);
        return {
          supports: [
            { productPublicId: 1, positiveUserCount: 4 },
            { productPublicId: 2, positiveUserCount: 4 },
            { productPublicId: 3, positiveUserCount: 4 },
          ],
          pairs: [
            { sourceProductPublicId: 1, candidateProductPublicId: 2, coPositiveUsers: 2 },
          ],
        };
      },
    },
    environment,
  });

  assert.equal(reads, 1);
  assert.equal(result.mode, "personalized-hybrid");
  assert.equal(result.algorithmVersion, "weighted-hybrid-v2");
  assert.equal(result.recommendations[0].product.id, 2);
  assert.match(result.recommendations[0].reasons.join(" "), /listeners/i);
  assert.match(result.profileSummary.join(" "), /Item-based collaborative filtering/i);
  assert.ok(result.recommendations.every((item) => item.product.id !== 1));
});

test("insufficient collaborative overlap falls back truthfully to preference ranking", async () => {
  const result = await serveUserRecommendations(actor, 2, context, {
    repository,
    profile,
    collaborativeRepository: {
      listItemEvidence: async () => ({
        supports: [
          { productPublicId: 1, positiveUserCount: 4 },
          { productPublicId: 2, positiveUserCount: 4 },
        ],
        pairs: [
          { sourceProductPublicId: 1, candidateProductPublicId: 2, coPositiveUsers: 1 },
        ],
      }),
    },
    environment,
  });

  assert.equal(result.mode, "preference-profile");
  assert.equal(result.algorithmVersion, "preference-profile-v1");
  assert.ok(result.recommendations.every((item) => item.product.id !== 1));
});
