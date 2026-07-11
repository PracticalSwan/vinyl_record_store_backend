import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createSessionToken } from "../src/lib/auth/session.js";
import {
  getOptionalRecommendationSubject,
  legacyRecommendationSubject,
  requireRecommendationSubject,
} from "../src/lib/auth/recommendationSubject.js";
import {
  personalizationIdentityStrictEnabled,
  personalizationMeEndpointEnabled,
} from "../src/lib/features.js";
import { recommendForUser } from "../src/lib/recommender/contentBased.js";

const environment = {
  AUTH_SECRET: "recommendation-identity-test-secret-with-32-characters",
};

function requestFor(user) {
  const token = createSessionToken(user, { environment });
  return new Request("http://localhost:3000/api/recommendations/me", {
    headers: { cookie: `groovehaus_session=${encodeURIComponent(token)}` },
  });
}

function repositoryFor(user) {
  return { findByPublicId: async () => user };
}

test("PERS-01 derives customer recommendation identity only from a verified session", async () => {
  const customer = {
    publicId: "user-owner",
    username: "owner",
    role: "customer",
    active: true,
    preferences: {},
  };
  assert.deepEqual(
    await getOptionalRecommendationSubject(requestFor(customer), {
      environment,
      repository: repositoryFor(customer),
    }),
    { kind: "registered", publicId: "user-owner" },
  );
  assert.deepEqual(
    await getOptionalRecommendationSubject(new Request("http://localhost/api"), { environment }),
    { kind: "anonymous" },
  );
  await assert.rejects(
    () => requireRecommendationSubject(new Request("http://localhost/api"), { environment }),
    (error) => error.code === "UNAUTHENTICATED",
  );
});

test("PERS-01 treats invalid or inactive sessions as anonymous and rejects administrators", async () => {
  const inactive = {
    publicId: "user-disabled",
    username: "disabled",
    role: "customer",
    active: false,
    preferences: {},
  };
  assert.deepEqual(
    await getOptionalRecommendationSubject(requestFor(inactive), {
      environment,
      repository: repositoryFor(inactive),
    }),
    { kind: "anonymous" },
  );
  assert.deepEqual(
    await getOptionalRecommendationSubject(new Request("http://localhost/api", {
      headers: { cookie: "groovehaus_session=tampered" },
    }), { environment }),
    { kind: "anonymous" },
  );

  const admin = {
    publicId: "demo-admin",
    username: "admin",
    role: "admin",
    active: true,
    preferences: {},
  };
  await assert.rejects(
    () => getOptionalRecommendationSubject(requestFor(admin), {
      environment,
      repository: repositoryFor(admin),
    }),
    (error) => error.code === "FORBIDDEN",
  );
});

test("PERS-01 legacy user ids can select only demo-profile or identical cold-start ranking", async () => {
  const first = await recommendForUser(legacyRecommendationSubject("user-one"), 8);
  const second = await recommendForUser(legacyRecommendationSubject("user-two"), 8);
  const demo = await recommendForUser(legacyRecommendationSubject("demo-user"), 8);

  assert.equal(first.mode, "cold-start");
  assert.equal(second.mode, "cold-start");
  assert.equal(demo.mode, "demo-profile");
  assert.deepEqual(
    first.recommendations.map((item) => item.product.id),
    second.recommendations.map((item) => item.product.id),
  );
});

test("PERS-01 rejects legacy string subjects before any catalog access", async () => {
  let catalogReads = 0;
  await assert.rejects(
    () => recommendForUser("demo-user", 8, {
      repository: {
        listRecommendationCandidates: async () => {
          catalogReads += 1;
          return [];
        },
      },
    }),
    TypeError,
  );
  assert.equal(catalogReads, 0);
});

test("PERS-01 product recommendations remain independent of session and profile code", async () => {
  const routeSource = await readFile(new URL(
    "../src/app/api/recommendations/product/[id]/route.js",
    import.meta.url,
  ), "utf8");
  assert.doesNotMatch(routeSource, /requireSession|getOptionalSession|recommendationSubject|services\/auth/);
});

test("personalization rollout flags are enabled by default and explicitly reversible", () => {
  assert.equal(personalizationIdentityStrictEnabled({}), true);
  assert.equal(personalizationMeEndpointEnabled({}), true);
  assert.equal(personalizationIdentityStrictEnabled({ PERS_IDENTITY_STRICT: "false" }), false);
  assert.equal(personalizationMeEndpointEnabled({ PERS_ME_ENDPOINT: "off" }), false);
});
