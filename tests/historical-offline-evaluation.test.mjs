import test from "node:test";
import assert from "node:assert/strict";
import {
  assertAggregateOnlyReport,
  createImplementationDigest,
  createValidationSeal,
  evaluateHistoricalStage,
  verifyValidationSeal,
} from "../src/lib/recommender/historicalOfflineEvaluation.js";

const DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v3";

function products(count = 30) {
  return Array.from({ length: count }, (_unused, index) => ({
    datasetKey: DATASET_KEY,
    id: index + 1,
    title: `Record ${index + 1}`,
    artist: `Artist ${Math.floor(index / 3)}`,
    genre: index % 2 === 0 ? "Jazz" : "Rock",
    year: 1960 + index,
    label: `Label ${index % 4}`,
    stock: index === 20 ? "out" : null,
  }));
}

function historicalSubject(number, {
  lowTrainingId = 3,
  validationId = 10,
  testId = 20,
  trainingOffset = 0,
} = {}) {
  const subjectKey = number.toString(16).padStart(64, "0");
  const training = [
    { productId: 1 + trainingOffset, rating: 5, occurredAt: "2020-01-01T00:00:00.000Z" },
    { productId: 2 + trainingOffset, rating: 4, occurredAt: "2020-01-02T00:00:00.000Z" },
    { productId: lowTrainingId + trainingOffset, rating: 2, occurredAt: "2020-01-03T00:00:00.000Z" },
  ];
  const validation = [
    { productId: validationId, rating: 5, occurredAt: "2020-01-04T00:00:00.000Z" },
  ];
  const test = [
    { productId: testId, rating: 5, occurredAt: "2020-01-05T00:00:00.000Z" },
  ];
  return {
    datasetKey: DATASET_KEY,
    subjectKey,
    training,
    validation,
    test,
    validationRelevantProductIds: [validationId],
    testRelevantProductIds: [testId],
  };
}

test("historical validation uses train-only evidence, all-observation exclusions, and deterministic baselines", () => {
  const subjects = [
    historicalSubject(1),
    historicalSubject(2, { trainingOffset: 3, lowTrainingId: 3, validationId: 11, testId: 21 }),
    historicalSubject(3, { trainingOffset: 6, lowTrainingId: 3, validationId: 12, testId: 22 }),
  ];
  const first = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects,
    products: products(),
    randomSeed: "fixed",
  });
  const second = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects,
    products: products(),
    randomSeed: "fixed",
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first.availableSplits, ["train"]);
  assert.equal(first.targetSplit, "validation");
  assert.equal(first.cohort.evaluatedSubjects, 3);
  assert.deepEqual(first.models.map((model) => model.model), [
    "random",
    "popularity",
    "content-based",
  ]);
  assert.equal(first.idealNdcg, 1);
  assert.equal(first.statistics.contentSignal.zeroPositiveSeedSubjects, 0);
  assert.equal(first.statistics.targetSupport.targets, 3);
  assert.ok(first.models.every((model) => Number.isFinite(model.metrics.novelty)));
});

test("popularity and novelty use all allowed-history subjects, not only target-positive metric subjects", () => {
  const metricSubject = historicalSubject(1);
  const nonMetricSubject = {
    ...historicalSubject(2, { trainingOffset: 3 }),
    validation: [{ productId: 11, rating: 2, occurredAt: "2020-01-04T00:00:00.000Z" }],
    validationRelevantProductIds: [],
  };
  const result = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects: [metricSubject, nonMetricSubject],
    products: products(),
    randomSeed: "fixed",
  });

  assert.equal(result.cohort.evaluatedSubjects, 1);
  assert.equal(result.statistics.evidenceSubjectsForGlobalModels, 2);
  assert.equal(result.statistics.itemObservedSupport.maximum, 1);
});

test("global historical models exclude structurally ineligible subjects from fitting", () => {
  const metricSubject = historicalSubject(1);
  const tooShort = {
    ...historicalSubject(2),
    training: [{ productId: 30, rating: 5, occurredAt: "2020-01-01T00:00:00.000Z" }],
  };
  const result = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects: [metricSubject, tooShort],
    products: products(),
    randomSeed: "fixed",
  });

  assert.equal(result.cohort.excluded.insufficientTraining, 1);
  assert.equal(result.statistics.evidenceSubjectsForGlobalModels, 1);
  assert.equal(result.statistics.itemPositiveSupport.maximum, 1);
});

test("final-test stage admits validation into history but never test rows", () => {
  const base = historicalSubject(1, { validationId: 10, testId: 20 });
  const changedTestRating = {
    ...base,
    test: [{ ...base.test[0], rating: 4 }],
  };
  const first = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "test",
    subjects: [base],
    products: products(),
    randomSeed: "fixed",
  });
  const second = evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "test",
    subjects: [changedTestRating],
    products: products(),
    randomSeed: "fixed",
  });

  assert.deepEqual(first, second);
  assert.deepEqual(first.availableSplits, ["train", "validation"]);
  assert.equal(first.statistics.userRatings.median, 4);
});

test("historical evaluator rejects mixed releases, leaked targets, and out-of-universe evidence", () => {
  const mixed = historicalSubject(1);
  mixed.datasetKey = "other-release";
  assert.throws(() => evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects: [mixed],
    products: products(),
  }), /one pinned dataset version/);

  const leaked = historicalSubject(1, { validationId: 1 });
  assert.throws(() => evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects: [leaked],
    products: products(),
  }), /leaked into available history/);

  const invalidEvidence = historicalSubject(1, { lowTrainingId: 99 });
  assert.throws(() => evaluateHistoricalStage({
    datasetKey: DATASET_KEY,
    stage: "validation",
    subjects: [invalidEvidence],
    products: products(),
  }), /outside the pinned universe/);
});

test("validation seal binds protocol and immutable dataset descriptor", () => {
  const protocol = { k: 10, seed: "fixed", stage: "validation" };
  const descriptor = {
    datasetKey: DATASET_KEY,
    sourceVersion: "v3",
    productCollection: "datasetProducts",
    counts: { products: 30, ratings: 15, users: 3 },
    configDigest: "a".repeat(64),
    identityRegistryDigest: "b".repeat(64),
    sealedAt: new Date("2026-08-13T00:00:00.000Z"),
  };
  const validationResult = { status: "evaluated", models: [{ model: "content", score: 0.2 }] };
  const seal = createValidationSeal(protocol, descriptor, validationResult);
  assert.equal(verifyValidationSeal(seal, protocol, descriptor, validationResult), true);
  assert.throws(
    () => verifyValidationSeal(seal, { ...protocol, k: 20 }, descriptor, validationResult),
    /does not match/,
  );
  assert.throws(
    () => verifyValidationSeal(seal, protocol, descriptor, {
      ...validationResult,
      models: [{ model: "content", score: 0.3 }],
    }),
    /does not match/,
  );
});

test("historical report guard rejects identity and raw-row shaped fields", () => {
  assert.doesNotThrow(() => assertAggregateOnlyReport({ aggregateOnly: true, users: 20 }));
  assert.throws(() => assertAggregateOnlyReport({ userKey: "a".repeat(64) }), /Private identifier/);
  assert.throws(() => assertAggregateOnlyReport({ nested: { sourceRow: 12 } }), /Private identifier/);
});

test("historical content evaluation is insulated from the production version-label environment", () => {
  const previous = process.env.RECOMMENDER_ALGORITHM_VERSION;
  process.env.RECOMMENDER_ALGORITHM_VERSION = "misleading-runtime-label";
  try {
    const result = evaluateHistoricalStage({
      datasetKey: DATASET_KEY,
      stage: "validation",
      subjects: [historicalSubject(1)],
      products: products(),
      randomSeed: "fixed",
    });
    assert.equal(
      result.models.find((model) => model.model === "content-based").algorithmVersion,
      "historical-content-profile-v1:content-demo-v1",
    );
  } finally {
    if (previous === undefined) delete process.env.RECOMMENDER_ALGORITHM_VERSION;
    else process.env.RECOMMENDER_ALGORITHM_VERSION = previous;
  }
});

test("implementation digest is stable by path order and changes with scorer source", () => {
  const first = createImplementationDigest({ "b.js": "export const b = 2;", "a.js": "export const a = 1;" });
  const reordered = createImplementationDigest({ "a.js": "export const a = 1;", "b.js": "export const b = 2;" });
  const changed = createImplementationDigest({ "a.js": "export const a = 3;", "b.js": "export const b = 2;" });
  assert.equal(first, reordered);
  assert.notEqual(first, changed);
  assert.match(first, /^[0-9a-f]{64}$/);
});
