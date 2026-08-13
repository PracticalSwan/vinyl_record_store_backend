import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  BIASED_MATRIX_FACTORIZATION_VERSION,
  matrixFactorizationConfigurationId,
  trainBiasedMatrixFactorization,
} from "../src/lib/recommender/biasedMatrixFactorization.js";
import {
  evaluateHistoricalMatrixFactorization,
  selectHistoricalMatrixFactorizationWinner,
} from "../src/lib/recommender/historicalMatrixFactorizationEvaluation.js";
import {
  claimHistoricalFinalTestAttempt,
  createHistoricalMfImplementationDescriptor,
  HISTORICAL_MF_IMPLEMENTATION_FILES,
  historicalMfGridFromContract,
} from "../src/lib/recommender/historicalMatrixFactorizationAuthorization.js";

const CONFIGURATION = {
  factors: 2,
  learningRate: 0.01,
  regularization: 0.02,
  epochs: 12,
};

function observations() {
  return [
    { subjectKey: "user-a", productId: 1, rating: 5 },
    { subjectKey: "user-a", productId: 2, rating: 1 },
    { subjectKey: "user-b", productId: 1, rating: 4 },
    { subjectKey: "user-b", productId: 3, rating: 2 },
  ];
}

test("biased matrix factorization is deterministic and uses unbounded observed-only predictions", () => {
  const first = trainBiasedMatrixFactorization({ observations: observations(), configuration: CONFIGURATION });
  const second = trainBiasedMatrixFactorization({ observations: [...observations()].reverse(), configuration: CONFIGURATION });
  assert.equal(first.algorithmVersion, BIASED_MATRIX_FACTORIZATION_VERSION);
  assert.equal(first.configurationId, matrixFactorizationConfigurationId(CONFIGURATION));
  assert.equal(first.globalMean, 3);
  assert.equal(first.trainingRmse, second.trainingRmse);
  for (const user of ["user-a", "user-b", "unknown-user"]) {
    for (const item of [1, 2, 3, 99]) {
      assert.equal(first.predict(user, item), second.predict(user, item));
      assert.ok(Number.isFinite(first.predict(user, item)));
    }
  }
  assert.equal(first.predict("unknown-user", 99), first.globalMean);
  assert.ok(first.predict("user-a", 1) > first.predict("user-a", 2));
  assert.equal(first.trainingRmse, 1.340863015312361);
  assert.equal(first.predict("user-a", 1), 3.3175369975028106);
  assert.equal(first.predict("user-a", 2), 2.766867665484774);
  assert.equal(first.predict("user-b", 1), 3.310603410904666);
  assert.equal(first.predict("user-b", 3), 2.874004430289958);
});

test("biased matrix factorization rejects duplicate, malformed, and non-finite inputs", () => {
  assert.throws(() => trainBiasedMatrixFactorization({
    observations: [...observations(), observations()[0]],
    configuration: CONFIGURATION,
  }), /duplicate/);
  assert.throws(() => trainBiasedMatrixFactorization({
    observations: [{ subjectKey: "u", productId: 1, rating: Number.NaN }],
    configuration: CONFIGURATION,
  }), /invalid rating/);
  assert.throws(() => trainBiasedMatrixFactorization({
    observations: observations(),
    configuration: { ...CONFIGURATION, learningRate: 2 },
  }), /learning rate/);
});

function historicalInputs() {
  const datasetKey = "dataset-v1";
  const products = Array.from({ length: 6 }, (_unused, index) => ({
    datasetKey,
    id: index + 1,
  }));
  const subjects = [
    {
      datasetKey,
      subjectKey: "a",
      training: [
        { productId: 1, rating: 5 },
        { productId: 2, rating: 1 },
        { productId: 3, rating: 4 },
      ],
      validation: [{ productId: 4, rating: 5 }],
      test: [{ productId: 5, rating: 5 }],
      validationRelevantProductIds: [4],
      testRelevantProductIds: [5],
    },
    {
      datasetKey,
      subjectKey: "b",
      training: [
        { productId: 1, rating: 4 },
        { productId: 4, rating: 5 },
        { productId: 5, rating: 2 },
      ],
      validation: [{ productId: 3, rating: 4 }],
      test: [{ productId: 6, rating: 5 }],
      validationRelevantProductIds: [3],
      testRelevantProductIds: [6],
    },
  ];
  return { datasetKey, products, subjects };
}

test("historical MF validation uses train-only fit and shared full-catalog exclusions", () => {
  const input = historicalInputs();
  const first = evaluateHistoricalMatrixFactorization({
    ...input,
    stage: "validation",
    configuration: CONFIGURATION,
  });
  const second = evaluateHistoricalMatrixFactorization({
    ...input,
    stage: "validation",
    configuration: CONFIGURATION,
  });
  assert.deepEqual(first, second);
  assert.equal(first.fit.ratings, 6);
  assert.equal(first.fit.subjects, 2);
  assert.equal(first.cohort.evaluatedSubjects, 2);
  assert.equal(first.coldEvidence.unsupportedCandidateItems, 1);
  assert.equal(first.coldEvidence.fallbackCount, 0);
  for (const value of Object.values(first.metrics)) assert.ok(Number.isFinite(value));

  const testResult = evaluateHistoricalMatrixFactorization({
    ...input,
    stage: "test",
    configuration: CONFIGURATION,
  });
  assert.equal(testResult.fit.ratings, 8, "validation becomes final-fit evidence");
  assert.equal(testResult.cohort.evaluatedSubjects, 2);
});

test("winner selection follows metrics then frozen configuration tie breaks", () => {
  const base = {
    metrics: { "ndcg@10": 0.1, "map@10": 0.05, "hitRate@10": 0.2 },
    configuration: { factors: 16, learningRate: 0.01, regularization: 0.02 },
    canonicalOrder: 0,
  };
  const fewerFactors = {
    ...base,
    configuration: { factors: 8, learningRate: 0.01, regularization: 0.02 },
    canonicalOrder: 1,
  };
  const better = {
    ...base,
    metrics: { ...base.metrics, "ndcg@10": 0.11 },
    canonicalOrder: 2,
  };
  assert.equal(selectHistoricalMatrixFactorizationWinner([base, fewerFactors]), fewerFactors);
  assert.equal(selectHistoricalMatrixFactorizationWinner([fewerFactors, better]), better);
});

test("test-critical implementation binding covers and reacts to every execution boundary", () => {
  assert.deepEqual(HISTORICAL_MF_IMPLEMENTATION_FILES, [
    "scripts/run-historical-mf-experiment.mjs",
    "src/lib/dataset/historicalEvaluationAdapter.js",
    "src/lib/recommender/biasedMatrixFactorization.js",
    "src/lib/recommender/contentBased.js",
    "src/lib/recommender/evaluate.js",
    "src/lib/recommender/historicalMatrixFactorizationAuthorization.js",
    "src/lib/recommender/historicalMatrixFactorizationEvaluation.js",
    "src/lib/recommender/historicalOfflineEvaluation.js",
    "src/repositories/historicalEvaluationRepository.js",
  ]);
  const sources = Object.fromEntries(HISTORICAL_MF_IMPLEMENTATION_FILES.map((filename) => (
    [filename, `source:${filename}`]
  )));
  const initial = createHistoricalMfImplementationDescriptor(sources);
  for (const filename of HISTORICAL_MF_IMPLEMENTATION_FILES) {
    const changed = createHistoricalMfImplementationDescriptor({
      ...sources,
      [filename]: `${sources[filename]}:changed`,
    });
    assert.notEqual(changed.digest, initial.digest, filename);
  }
});

test("one-time final-test claim survives a simulated post-claim failure", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "groovehaus-mf-claim-"));
  const filename = path.join(directory, "final-test-attempt-claimed.json");
  const claim = { schemaVersion: 1, status: "claimed-before-first-test-row-query" };
  try {
    await claimHistoricalFinalTestAttempt(filename, claim);
    assert.deepEqual(JSON.parse(await readFile(filename, "utf8")), claim);
    await assert.rejects(
      claimHistoricalFinalTestAttempt(filename, claim),
      (error) => error?.code === "EEXIST",
    );
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("the frozen validation grid is exact, unique, and canonical", async () => {
  const contract = JSON.parse(await readFile(path.resolve(
    "reports/recommender/historical/amazon-reviews-2023-cds-vinyl-5core-v3/next-01-final-v3/next-03-experiment-contract.json",
  ), "utf8"));
  const configurations = historicalMfGridFromContract(contract);
  assert.equal(configurations.length, 8);
  assert.equal(new Set(configurations.map(matrixFactorizationConfigurationId)).size, 8);
  assert.deepEqual(configurations, [
    { factors: 8, learningRate: 0.005, regularization: 0.02, epochs: 50 },
    { factors: 8, learningRate: 0.005, regularization: 0.05, epochs: 50 },
    { factors: 8, learningRate: 0.01, regularization: 0.02, epochs: 50 },
    { factors: 8, learningRate: 0.01, regularization: 0.05, epochs: 50 },
    { factors: 16, learningRate: 0.005, regularization: 0.02, epochs: 50 },
    { factors: 16, learningRate: 0.005, regularization: 0.05, epochs: 50 },
    { factors: 16, learningRate: 0.01, regularization: 0.02, epochs: 50 },
    { factors: 16, learningRate: 0.01, regularization: 0.05, epochs: 50 },
  ]);
  assert.throws(() => historicalMfGridFromContract({
    validationGrid: {
      factors: [8],
      learningRate: [0.005],
      regularization: [0.02],
      epochs: [50],
      configurationCount: 2,
    },
  }), /grid size/);
});
