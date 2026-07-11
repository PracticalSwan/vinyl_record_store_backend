import test from "node:test";
import assert from "node:assert/strict";
import { seedCatalogRepository } from "../src/repositories/seedCatalogRepository.js";
import { legacyRecommendationSubject } from "../src/lib/auth/recommendationSubject.js";
import { serveUserRecommendations } from "../src/services/recommendations.js";

const mongoEnvironment = {
  CATALOG_DATA_SOURCE: "mongodb",
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB_NAME: "test",
};

test("PERS-02 serves a verified customer cold-start parity without exposing identity", async () => {
  let logged;
  const registered = { kind: "registered", publicId: "user-owner" };
  const result = await serveUserRecommendations(registered, 12, {
    actor: registered,
    anonymousId: "forged-anonymous-id",
    surface: "recommendations",
  }, {
    repository: seedCatalogRepository,
    events: { appendRecommendationLog: async (value) => { logged = value; } },
    environment: mongoEnvironment,
  });
  const legacy = await serveUserRecommendations(legacyRecommendationSubject("any-user"), 12, {
    actor: { kind: "anonymous" },
    surface: "recommendations",
    trackingAllowed: false,
  }, {
    repository: seedCatalogRepository,
    environment: { CATALOG_DATA_SOURCE: "seed" },
  });

  assert.equal(result.mode, "cold-start");
  assert.equal("userId" in result, false);
  assert.equal(logged.subjectType, "user");
  assert.equal(logged.subjectId, "user-owner");
  assert.deepEqual(
    result.recommendations.map((item) => item.product.id),
    legacy.recommendations.map((item) => item.product.id),
  );
});

test("PERS-02 anonymous requests use an explicit fallback and bounded anonymous logging", async () => {
  let logged;
  const anonymous = { kind: "anonymous" };
  const result = await serveUserRecommendations(anonymous, 12, {
    actor: anonymous,
    anonymousId: "anonymous-browser-id",
    surface: "home",
  }, {
    repository: seedCatalogRepository,
    events: { appendRecommendationLog: async (value) => { logged = value; } },
    environment: mongoEnvironment,
  });

  assert.equal(result.mode, "anonymous-fallback");
  assert.equal("userId" in result, false);
  assert.match(result.profileSummary[0], /No signed-in customer session/);
  assert.equal(logged.subjectType, "anonymous");
  assert.equal(logged.subjectId, "anonymous-browser-id");
});

test("PERS-02 registered and anonymous results preserve content-demo-v1 ranking behavior", async () => {
  const registered = await serveUserRecommendations(
    { kind: "registered", publicId: "user-one" },
    8,
    { actor: { kind: "registered", publicId: "user-one" }, surface: "home", trackingAllowed: false },
    { repository: seedCatalogRepository, environment: { CATALOG_DATA_SOURCE: "seed" } },
  );
  const anonymous = await serveUserRecommendations(
    { kind: "anonymous" },
    8,
    { actor: { kind: "anonymous" }, surface: "home", trackingAllowed: false },
    { repository: seedCatalogRepository, environment: { CATALOG_DATA_SOURCE: "seed" } },
  );

  assert.equal(registered.algorithmVersion, "content-demo-v1");
  assert.equal(anonymous.algorithmVersion, "content-demo-v1");
  assert.deepEqual(
    registered.recommendations.map((item) => item.product.id),
    anonymous.recommendations.map((item) => item.product.id),
  );
});

test("PERS-02 rejects a missing or malformed logging actor before catalog access", async () => {
  let catalogReads = 0;
  const repository = {
    listRecommendationCandidates: async () => {
      catalogReads += 1;
      return [];
    },
  };

  await assert.rejects(
    () => serveUserRecommendations(
      { kind: "registered", publicId: "user-owner" },
      12,
      { actor: { kind: "registered" }, surface: "recommendations" },
      { repository },
    ),
    TypeError,
  );
  assert.equal(catalogReads, 0);
});
