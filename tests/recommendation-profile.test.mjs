import test from "node:test";
import assert from "node:assert/strict";
import { buildRecommendationProfile } from "../src/lib/recommender/recommendationProfile.js";
import { buildUserRecommendationProfile } from "../src/services/recommendationProfile.js";

test("recommendation profile is bounded, deterministic, and does not expose owners", () => {
  const profile = buildRecommendationProfile({
    subject: { kind: "registered", publicId: "user-1" },
    preferences: { favoriteGenres: ["Jazz"], budget: { min: null, max: 30 } },
    ratings: [{ productPublicId: 2, rating: 5, updatedAt: "2026-01-01" }],
    wishlist: [3, 1, 3],
    cart: [{ productPublicId: 4, quantity: 2 }],
    feedback: [{ productPublicId: 5, kind: "not-interested", userPublicId: "user-1" }],
    interactions: [
      { eventId: "b", type: "product_view", occurredAt: "2026-01-01T00:00:00Z", receivedAt: "2026-01-01T00:00:00Z", userPublicId: "user-1", sessionId: "secret" },
      { eventId: "a", type: "product_view", occurredAt: "2026-01-01T00:00:00Z", receivedAt: "2026-01-01T00:00:00Z", userPublicId: "user-1", sessionId: "secret" },
    ],
  });
  assert.deepEqual(profile.wishlist, [1, 3]);
  assert.deepEqual(profile.ratings.map((item) => item.productPublicId), [2]);
  assert.deepEqual(profile.passiveInteractions.map((item) => item.eventId), ["a", "b"]);
  assert.equal("userPublicId" in profile.explicitFeedback[0], false);
  assert.equal("sessionId" in profile.passiveInteractions[0], false);
});

test("profile service gates feedback and passive interactions independently", async () => {
  const calls = [];
  const profile = await buildUserRecommendationProfile(
    { kind: "registered", publicId: "user-1" },
    {
      users: { findByPublicId: async () => ({ publicId: "user-1", preferences: {} }) },
      state: {
        getWishlist: async () => ({ productPublicIds: [] }),
        getCart: async () => ({ items: [] }),
        listRatings: async () => [],
        listRecentInteractions: async () => { calls.push("interactions"); return []; },
      },
      feedback: { listByUser: async () => { calls.push("feedback"); return []; } },
      trackingAllowed: false,
      feedbackAllowed: false,
    },
  );
  assert.equal(profile.passiveInteractions.length, 0);
  assert.deepEqual(calls, []);
});

test("profile builder rejects foreign durable sources", () => {
  assert.throws(() => buildRecommendationProfile({
    subject: { kind: "registered", publicId: "user-1" },
    ratings: [{ productPublicId: 1, rating: 4, userPublicId: "user-2" }],
  }), /belong to the subject/);
});
