import test from "node:test";
import assert from "node:assert/strict";
import { seedCatalogRepository } from "../src/repositories/seedCatalogRepository.js";
import {
  serveProductRecommendations,
  serveUserRecommendations,
} from "../src/services/recommendations.js";

const mongoEnvironment = {
  CATALOG_DATA_SOURCE: "mongodb",
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB_NAME: "test",
};

test("BFP-02 logs the exact ordered product recommendation response", async () => {
  let logged;
  const events = { appendRecommendationLog: async (value) => { logged = value; } };
  const result = await serveProductRecommendations(1, 4, { surface: "product-detail" }, {
    repository: seedCatalogRepository,
    events,
    environment: mongoEnvironment,
  });

  assert.equal(result.recommendationLogged, true);
  assert.equal(result.requestId, logged.requestId);
  assert.equal(result.listId, logged.listId);
  assert.equal(logged.sourceProductId, 1);
  assert.deepEqual(
    logged.items.map(({ productPublicId, rank }) => ({ productPublicId, rank })),
    result.recommendations.map(({ product, rank }) => ({ productPublicId: product.id, rank })),
  );
  assert.ok(logged.items.every((item) => Array.isArray(item.reasons)));
});

test("BFP-02 derives authenticated ownership and never returns the stored subject", async () => {
  let logged;
  const result = await serveUserRecommendations("demo-user", 3, {
    user: { publicId: "user-1" },
    anonymousId: "forged-anonymous",
    surface: "recommendations",
  }, {
    repository: seedCatalogRepository,
    events: { appendRecommendationLog: async (value) => { logged = value; } },
    environment: mongoEnvironment,
  });

  assert.equal(logged.subjectType, "user");
  assert.equal(logged.subjectId, "user-1");
  assert.equal("subjectId" in result, false);
});

test("seed mode labels recommendation logging as disabled without touching MongoDB", async () => {
  let calls = 0;
  const result = await serveUserRecommendations("demo-user", 2, {
    user: null,
    anonymousId: "anon-1",
    surface: "home",
  }, {
    repository: seedCatalogRepository,
    events: { appendRecommendationLog: async () => { calls += 1; } },
    environment: { CATALOG_DATA_SOURCE: "seed" },
  });
  assert.equal(result.recommendationLogged, false);
  assert.equal(calls, 0);
});

test("usage-data opt-out suppresses MongoDB request logs", async () => {
  let calls = 0;
  const result = await serveUserRecommendations("demo-user", 2, {
    user: null,
    anonymousId: null,
    surface: "home",
    trackingAllowed: false,
  }, {
    repository: seedCatalogRepository,
    events: { appendRecommendationLog: async () => { calls += 1; } },
    environment: mongoEnvironment,
  });
  assert.equal(result.recommendationLogged, false);
  assert.equal(calls, 0);
});
