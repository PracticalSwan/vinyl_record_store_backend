import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_USERS } from "../src/data/demoUsers.js";
import { recommendForUser } from "../src/lib/recommender/contentBased.js";

const otherGenres = ["Rock", "Soul", "Jazz"];

test("canonical showcase roles produce hybrid lists without recommending known records", async () => {
  assert.deepEqual(
    DEMO_USERS.map((user) => user.personalization.role),
    ["jazz_listener", "rock_collector", "soul_seeker"],
  );

  for (const [index, user] of DEMO_USERS.entries()) {
    const fixture = user.personalization;
    const favoriteGenre = fixture.preferences.favoriteGenres[0];
    const knownSignals = [...fixture.ratings, ...fixture.wishlist];
    const knownIds = new Set(knownSignals.map((signal) => signal.productPublicId));
    const candidates = [
      ...knownSignals.map((signal) => ({
        id: signal.productPublicId,
        title: signal.title,
        artist: signal.artist,
        genre: signal.genre,
        format: "Vinyl",
        stock: "in",
        catalogMode: "research-only",
        datasetKey: "release-v3",
      })),
      {
        id: 990_000 + index,
        title: `${favoriteGenre} discovery`,
        artist: `New ${favoriteGenre} artist`,
        genre: favoriteGenre,
        format: "Vinyl",
        stock: "in",
        catalogMode: "research-only",
        datasetKey: "release-v3",
      },
      {
        id: 991_000 + index,
        title: "Different discovery",
        artist: "Different artist",
        genre: otherGenres[index],
        format: "Vinyl",
        stock: "in",
        catalogMode: "research-only",
        datasetKey: "release-v3",
      },
    ];
    const profile = {
      explicitPreferences: fixture.preferences,
      ratings: fixture.ratings.map(({ productPublicId, rating }) => ({ productPublicId, rating })),
      wishlist: fixture.wishlist.map((signal) => signal.productPublicId),
      cart: [],
      explicitFeedback: [],
      passiveInteractions: [],
    };

    const result = await recommendForUser(
      { kind: "registered", publicId: user.publicId },
      5,
      {
        candidates,
        profile,
        preferenceRankingEnabled: true,
        behaviorRankingEnabled: true,
        popularityEnabled: true,
        hybridEnabled: true,
        popularityAggregates: candidates.map((candidate, rank) => ({
          datasetKey: "release-v3",
          productPublicId: candidate.id,
          ratingCount: candidates.length - rank,
          meanRating: 4,
        })),
      },
    );

    assert.equal(result.mode, "personalized-hybrid", user.publicId);
    assert.equal(result.algorithmVersion, "personalized-hybrid-v1", user.publicId);
    assert.equal(result.recommendations[0].product.genre, favoriteGenre, user.publicId);
    assert.equal(
      result.recommendations.some((item) => knownIds.has(item.product.id)),
      false,
      `${user.publicId} resurfaced known profile state`,
    );
  }
});
