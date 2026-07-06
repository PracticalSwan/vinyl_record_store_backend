import test from "node:test";
import assert from "node:assert/strict";
import {
  assertLeakageSafe,
  buildEvaluationDataset,
  constructRelevantEvents,
} from "../src/lib/recommender/evaluationDataset.js";
import { createEvaluationRepository } from "../src/repositories/evaluationRepository.js";

const event = (overrides = {}) => ({
  eventId: "event-1",
  subjectId: "subject-1",
  type: "wishlist_add",
  productPublicId: 1,
  value: null,
  occurredAt: new Date("2026-01-01T00:00:00.000Z"),
  ...overrides,
});

test("relevance uses final explicit and current wishlist/cart state per unique product", () => {
  const events = [
    event({ eventId: "rating-high", type: "rating_set", productPublicId: 1, value: 5 }),
    event({ eventId: "rating-low", type: "rating_set", productPublicId: 1, value: 2, occurredAt: new Date("2026-01-02") }),
    event({ eventId: "wish-add", productPublicId: 2, occurredAt: new Date("2026-01-03") }),
    event({ eventId: "wish-remove", type: "wishlist_remove", productPublicId: 2, occurredAt: new Date("2026-01-04") }),
    event({ eventId: "cart-add", type: "recommendation_cart_add", productPublicId: 3, occurredAt: new Date("2026-01-05") }),
    event({ eventId: "rating-four", type: "rating_set", productPublicId: 4, value: 4, occurredAt: new Date("2026-01-06") }),
  ];
  assert.deepEqual(
    constructRelevantEvents(events).map((item) => item.productPublicId),
    [3, 4],
  );
});

test("temporal split holds out the latest distinct positive and excludes all training positives", () => {
  const interactions = Array.from({ length: 5 }, (_unused, index) => event({
    eventId: `event-${index + 1}`,
    productPublicId: index + 1,
    occurredAt: new Date(Date.UTC(2026, 0, index + 1)),
  }));
  const dataset = buildEvaluationDataset(interactions, {
    itemUniverse: new Set([1, 2, 3, 4, 5, 6]),
    minimumSubjects: 1,
    minimumPositiveEvents: 5,
  });
  assert.equal(dataset.status, "eligible");
  assert.deepEqual([...dataset.subjects[0].trainingProductIds], [1, 2, 3, 4]);
  assert.deepEqual([...dataset.subjects[0].testRelevant], [5]);
  assert.equal(dataset.subjects[0].candidateExclusions.has(5), false);
  assert.equal(assertLeakageSafe(dataset.subjects), true);
});

test("minimum evidence boundary produces an explicit non-conclusion below 20 eligible subjects", () => {
  const interactions = [];
  for (let subject = 0; subject < 19; subject += 1) {
    for (let product = 1; product <= 5; product += 1) {
      interactions.push(event({
        eventId: `${subject}-${product}`,
        subjectId: `subject-${subject}`,
        productPublicId: product,
        occurredAt: new Date(Date.UTC(2026, 0, product)),
      }));
    }
  }
  const dataset = buildEvaluationDataset(interactions, {
    itemUniverse: new Set([1, 2, 3, 4, 5, 6]),
  });
  assert.equal(dataset.status, "insufficient-evidence");
  assert.equal(dataset.counts.eligibleSubjects, 19);
  assert.equal(dataset.minimumEvidence.subjects, 20);
});

function query(value) {
  const chain = {};
  chain.select = () => chain;
  chain.sort = () => chain;
  chain.lean = () => chain;
  chain.exec = async () => value;
  return chain;
}

test("dataset repository pseudonymizes subjects before returning data and never returns raw identity fields", async () => {
  const repository = createEvaluationRepository({
    interactionModel: { find: () => query([{
      eventId: "event-1",
      userPublicId: "private-user",
      anonymousId: null,
      type: "wishlist_add",
      productPublicId: 1,
      occurredAt: new Date("2026-01-01"),
    }]) },
    recommendationLogModel: { find: () => query([]) },
    productModel: { find: () => query([{ publicId: 1, title: "One", artist: "Artist", stock: "in" }]) },
  }, async () => ({}));
  const inputs = await repository.readInputs({
    from: new Date("2026-01-01"),
    to: new Date("2026-02-01"),
    pseudonymSalt: Buffer.from("test-salt"),
  });
  assert.notEqual(inputs.interactions[0].subjectId, "private-user");
  assert.equal(JSON.stringify(inputs).includes("private-user"), false);
  assert.equal("userPublicId" in inputs.interactions[0], false);
  assert.equal("anonymousId" in inputs.interactions[0], false);
  assert.deepEqual(
    inputs.capturedFieldCoverage.interactions.find((item) => item.field === "subject"),
    { field: "subject", present: 1, total: 1, rate: 1 },
  );
  assert.deepEqual(
    inputs.capturedFieldCoverage.interactions.find((item) => item.field === "source"),
    { field: "source", present: 0, total: 1, rate: 0 },
  );
  assert.ok(inputs.capturedFieldCoverage.recommendationLogs.every((item) => item.total === 0));
});
