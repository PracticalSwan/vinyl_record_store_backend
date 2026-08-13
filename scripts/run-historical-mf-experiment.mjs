import { createHash } from "node:crypto";
import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
let AMAZON_CURRENT_DATASET_KEY;
let disconnectMongoDB = async () => {};
let assertAggregateOnlyReport;
let evaluateHistoricalStage;
let verifyValidationSeal;
let claimHistoricalFinalTestAttempt;
let createHistoricalMfImplementationDescriptor;
let HISTORICAL_MF_IMPLEMENTATION_FILES;
let historicalMfGridFromContract;
let evaluateHistoricalMatrixFactorization;
let selectHistoricalMatrixFactorizationWinner;
let historicalEvaluationRepository;

const DEFAULT_SEED = "groovehaus-biased-mf-v1";
const VALIDATION_DIRECTORY_NAME = "next-03-validation-final-v2";

function parseArguments(argv) {
  const options = {
    stage: null,
    runId: null,
    outputRoot: path.join("reports", "recommender", "historical"),
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    if (inlineValue === undefined) index += 1;
    if (name === "--stage") options.stage = value;
    else if (name === "--run-id") options.runId = value;
    else if (name === "--output-root") options.outputRoot = value;
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!['validation', 'test'].includes(options.stage)) {
    throw new Error("--stage must be validation or test.");
  }
  if (!options.runId) throw new Error("--run-id is required for immutable historical reports.");
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(options.runId)) {
    throw new Error("--run-id contains unsupported characters.");
  }
  return options;
}

async function loadRuntime() {
  const [datasetReleases, mongodb, offlineEvaluation, authorization, mfEvaluation, repository] = await Promise.all([
    import("../src/lib/dataset/amazonDatasetReleases.js"),
    import("../src/lib/db/mongodb.js"),
    import("../src/lib/recommender/historicalOfflineEvaluation.js"),
    import("../src/lib/recommender/historicalMatrixFactorizationAuthorization.js"),
    import("../src/lib/recommender/historicalMatrixFactorizationEvaluation.js"),
    import("../src/repositories/historicalEvaluationRepository.js"),
  ]);
  AMAZON_CURRENT_DATASET_KEY = datasetReleases.AMAZON_CURRENT_DATASET_KEY;
  disconnectMongoDB = mongodb.disconnectMongoDB;
  assertAggregateOnlyReport = offlineEvaluation.assertAggregateOnlyReport;
  evaluateHistoricalStage = offlineEvaluation.evaluateHistoricalStage;
  verifyValidationSeal = offlineEvaluation.verifyValidationSeal;
  claimHistoricalFinalTestAttempt = authorization.claimHistoricalFinalTestAttempt;
  createHistoricalMfImplementationDescriptor = authorization.createHistoricalMfImplementationDescriptor;
  HISTORICAL_MF_IMPLEMENTATION_FILES = authorization.HISTORICAL_MF_IMPLEMENTATION_FILES;
  historicalMfGridFromContract = authorization.historicalMfGridFromContract;
  evaluateHistoricalMatrixFactorization = mfEvaluation.evaluateHistoricalMatrixFactorization;
  selectHistoricalMatrixFactorizationWinner = mfEvaluation.selectHistoricalMatrixFactorizationWinner;
  historicalEvaluationRepository = repository.historicalEvaluationRepository;
}

async function readJson(filename) {
  return JSON.parse(await readFile(filename, "utf8"));
}

function canonicalDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeImmutableDirectory(destination, artifacts) {
  if (await exists(destination)) throw new Error("The matrix-factorization artifact directory already exists.");
  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${process.pid}.tmp`;
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    await Promise.all(Object.entries(artifacts).map(([filename, value]) => writeFile(
      path.join(temporary, filename),
      typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    )));
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

function datasetDescriptor(active) {
  return {
    datasetKey: active.datasetKey,
    sourceVersion: active.sourceVersion,
    productCollection: active.productCollection,
    counts: active.counts,
    configDigest: active.configDigest,
    identityRegistryDigest: active.identityRegistryDigest,
    sealedAt: active.sealedAt,
  };
}

async function readCandidateImplementation() {
  const sources = Object.fromEntries(await Promise.all(HISTORICAL_MF_IMPLEMENTATION_FILES.map(async (file) => (
    [file, await readFile(path.resolve(file), "utf8")]
  ))));
  return createHistoricalMfImplementationDescriptor(sources);
}

function resourceSampler({ startRss, maximumDeltaBytes, startTime, maximumElapsedMs }) {
  let peakRssBytes = process.memoryUsage().rss;
  const sample = () => {
    peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
  };
  const assertWithin = () => {
    sample();
    if (peakRssBytes - startRss > maximumDeltaBytes) {
      throw new Error("The matrix-factorization experiment exceeded its sampled peak RSS ceiling.");
    }
    if (performance.now() - startTime > maximumElapsedMs) {
      throw new Error("The matrix-factorization experiment exceeded its wall-clock ceiling.");
    }
  };
  return {
    sample,
    assertWithin,
    snapshot: () => ({
      sampledPeakRssBytes: peakRssBytes,
      sampledPeakRssDeltaBytes: Math.max(0, peakRssBytes - startRss),
    }),
  };
}

function rounded(value) {
  return Number(value.toFixed(6));
}

function roundedMetrics(metrics) {
  return Object.fromEntries(Object.entries(metrics).map(([key, value]) => [key, rounded(value)]));
}

function validationMarkdown(report) {
  const winner = report.selection.winner;
  const lines = [
    "# NEXT-03 Biased Matrix Factorization Validation",
    "",
    "Status: validation-complete; final test not yet authorized by this artifact.",
    "",
    `Dataset: \`${report.datasetKey}\``,
    "",
    `Experiment contract digest: \`${report.experimentContractDigest}\``,
    "",
    `Candidate implementation digest: \`${report.candidateImplementation.digest}\``,
    "",
    "Every configuration fitted all observed train ratings for 2,387 structurally eligible subjects. Metrics use the canonical 1,823-subject validation-target-positive cohort and unchanged full-catalog exclusions.",
    "",
    "| Order | Factors | Learning rate | Regularization | Epochs | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization | RMSE | Elapsed ms | Peak RSS delta |",
    "| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const attempt of report.attempts) {
    lines.push(`| ${attempt.canonicalOrder} | ${attempt.configuration.factors} | ${attempt.configuration.learningRate} | ${attempt.configuration.regularization} | ${attempt.configuration.epochs} | ${attempt.metrics["ndcg@10"]} | ${attempt.metrics["map@10"]} | ${attempt.metrics["hitRate@10"]} | ${attempt.metrics.coverage} | ${attempt.metrics.novelty} | ${attempt.metrics.personalization} | ${attempt.fit.trainingRmse} | ${attempt.runtime.elapsedMs} | ${attempt.runtime.sampledPeakRssDeltaBytes} |`);
  }
  lines.push(
    "",
    "## Frozen winner",
    "",
    `Winner: order ${winner.canonicalOrder}, factors ${winner.configuration.factors}, learning rate ${winner.configuration.learningRate}, regularization ${winner.configuration.regularization}, epochs ${winner.configuration.epochs}.`,
    "",
    `Primary unrounded NDCG@10: ${winner.metrics["ndcg@10"]}.`,
    "",
    "The selection rule was frozen before validation: unrounded NDCG@10, then MAP@10, HitRate@10, fewer factors, higher regularization, lower learning rate, and canonical configuration order.",
    "",
    "## Boundaries",
    "",
    "This is biased matrix factorization trained by SGD over observed ratings, not classical SVD. Missing entries are absent, never zero-valued ratings.",
    "",
    "The training data are strongly positive-skewed; 50.02% of train users have no within-user rating variance and 64.35% have only positive ratings. The model may therefore be bias- or popularity-dominated.",
    "",
    "Historical Amazon subjects are research pseudonyms, not Groovehaus customers. No factors or subject-level records are serialized, and no model is production-integrated.",
    "",
    "The historical test split remained unread throughout grid training, scoring, and selection.",
    "",
  );
  return lines.join("\n");
}

function finalTestMarkdown(report) {
  const lines = [
    "# Historical Recommender Final Test Benchmark",
    "",
    "Status: final-test-complete",
    "",
    `Dataset: \`${report.datasetKey}\``,
    "",
    "Protocol: refit the frozen biased-MF winner on train plus validation, then evaluate the untouched test once beside the unchanged baselines on the same cohort and full catalog.",
    "",
    `Evaluated subjects: ${report.cohort.evaluatedSubjects}.`,
    "",
    "| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const model of report.models) {
    const metrics = model.metrics;
    lines.push(`| ${model.model} | ${metrics["ndcg@10"]} | ${metrics["map@10"]} | ${metrics["hitRate@10"]} | ${metrics.coverage} | ${metrics.novelty} | ${metrics.personalization} |`);
  }
  lines.push(
    "",
    "## Frozen authorization",
    "",
    `Validation seal: \`${report.authorization.validationSealDigest}\``,
    "",
    `Experiment contract: \`${report.authorization.experimentContractDigest}\``,
    "",
    `Validation selection artifact: \`${report.authorization.selectionArtifactDigest}\``,
    "",
    `Candidate implementation: \`${report.authorization.candidateImplementationDigest}\``,
    "",
    `Selected configuration: factors ${report.selectedConfiguration.factors}, learning rate ${report.selectedConfiguration.learningRate}, regularization ${report.selectedConfiguration.regularization}, epochs ${report.selectedConfiguration.epochs}.`,
    "",
    "## Model behavior",
    "",
    `Biased-MF fit ratings: ${report.matrixFactorization.fit.ratings}; unsupported subjects: ${report.matrixFactorization.cohort.unsupportedSubjects}; unsupported target items: ${report.matrixFactorization.coldEvidence.unsupportedTargetItems}; unsupported candidate items: ${report.matrixFactorization.coldEvidence.unsupportedCandidateItems}; fallback count: ${report.matrixFactorization.coldEvidence.fallbackCount}.`,
    "",
    `Final-test wall clock: ${report.runtime.elapsedMs} ms; sampled peak RSS delta: ${report.runtime.sampledPeakRssDeltaBytes} bytes.`,
    "",
    "Historical Amazon subjects are research pseudonyms, not Groovehaus customers. This offline test does not establish quality for the live preference, behavior, popularity, or hybrid rankers.",
    "",
    "No post-test tuning was performed. Negative or weak learned-model results remain part of the academic outcome.",
    "",
  );
  return lines.join("\n");
}

function validateCommonBindings({ gate, contract, seal, storedProtocol, descriptor }) {
  if (
    gate.schemaVersion !== 1
    || gate.decision !== "approve"
    || gate.datasetKey !== AMAZON_CURRENT_DATASET_KEY
    || gate.testAuthorized !== false
    || gate.validationSealDigest !== seal.digest
    || contract.schemaVersion !== 1
    || contract.experimentName !== "biased-matrix-factorization-v1"
    || contract.classification !== "offline-academic-only"
    || contract.datasetKey !== AMAZON_CURRENT_DATASET_KEY
    || contract.validationSealDigest !== seal.digest
    || gate.experimentContractDigest !== canonicalDigest(contract)
    || storedProtocol.datasetKey !== descriptor.datasetKey
  ) {
    throw new Error("The NEXT-02 gate, experiment contract, validation seal, or dataset binding is invalid.");
  }
}

async function loadBase(runDirectory, active) {
  const [storedProtocol, storedDescriptor, storedResults, seal, gate, contract] = await Promise.all([
    readJson(path.join(runDirectory, "protocol.json")),
    readJson(path.join(runDirectory, "dataset-summary.json")),
    readJson(path.join(runDirectory, "validation-results.json")),
    readJson(path.join(runDirectory, "validation-seal.json")),
    readJson(path.join(runDirectory, "next-02-decision.json")),
    readJson(path.join(runDirectory, "next-03-experiment-contract.json")),
  ]);
  verifyValidationSeal(seal, storedProtocol, storedDescriptor, storedResults);
  verifyValidationSeal(seal, storedProtocol, datasetDescriptor(active), storedResults);
  validateCommonBindings({
    gate,
    contract,
    seal,
    storedProtocol,
    descriptor: datasetDescriptor(active),
  });
  return { storedProtocol, storedDescriptor, storedResults, seal, gate, contract };
}

async function runValidation({ runDirectory, active, base }) {
  const output = path.join(runDirectory, VALIDATION_DIRECTORY_NAME);
  if (await exists(output)) throw new Error("The NEXT-03 validation artifact already exists.");
  const startMemory = process.memoryUsage();
  const gridStartedAt = performance.now();
  const gridSampler = resourceSampler({
    startRss: startMemory.rss,
    maximumDeltaBytes: base.contract.resourceGuard.sampledPeakRssDeltaBytesMaximum,
    startTime: gridStartedAt,
    maximumElapsedMs: base.contract.resourceGuard.validationGridWallClockMillisecondsMaximum,
  });
  const [products, subjects] = await Promise.all([
    historicalEvaluationRepository.readProducts(active.datasetKey),
    historicalEvaluationRepository.readSubjects(active.datasetKey, { splits: ["train", "validation"] }),
  ]);
  if (subjects.length !== base.contract.populations.validationFit.expectedSubjects) {
    throw new Error("The validation-fit subject count changed from the frozen contract.");
  }
  const candidateImplementation = await readCandidateImplementation();
  const attempts = [];
  const configurations = historicalMfGridFromContract(base.contract);
  for (let canonicalOrder = 0; canonicalOrder < configurations.length; canonicalOrder += 1) {
    gridSampler.assertWithin();
    const configuration = configurations[canonicalOrder];
    const startedAt = performance.now();
    const rssBeforeBytes = process.memoryUsage().rss;
    let peakRssBytes = rssBeforeBytes;
    const sample = () => {
      gridSampler.sample();
      peakRssBytes = Math.max(peakRssBytes, process.memoryUsage().rss);
    };
    const result = evaluateHistoricalMatrixFactorization({
      datasetKey: active.datasetKey,
      stage: "validation",
      subjects,
      products,
      configuration,
      k: base.storedProtocol.k,
      minimumTrainingRatings: base.storedProtocol.minimumTrainingRatings,
      seed: DEFAULT_SEED,
      onResourceSample: sample,
      assertWithinResourceGuard: gridSampler.assertWithin,
    });
    const elapsedMs = Math.round(performance.now() - startedAt);
    attempts.push({
      canonicalOrder,
      configuration: result.configuration,
      configurationId: result.configurationId,
      fit: result.fit,
      cohort: result.cohort,
      coldEvidence: result.coldEvidence,
      metrics: result.metrics,
      runtime: {
        elapsedMs,
        rssBeforeBytes,
        sampledPeakRssBytes: peakRssBytes,
        sampledPeakRssDeltaBytes: Math.max(0, peakRssBytes - rssBeforeBytes),
      },
    });
  }
  gridSampler.assertWithin();
  const winner = selectHistoricalMatrixFactorizationWinner(attempts);
  const report = {
    schemaVersion: 1,
    status: "validation-complete",
    datasetKey: active.datasetKey,
    validationSealDigest: base.seal.digest,
    experimentContractDigest: base.gate.experimentContractDigest,
    candidateImplementation,
    seed: DEFAULT_SEED,
    gridWallClock: {
      elapsedMs: Math.round(performance.now() - gridStartedAt),
      ...gridSampler.snapshot(),
    },
    attempts,
    selection: {
      rule: base.contract.selection,
      winner: {
        canonicalOrder: winner.canonicalOrder,
        configuration: winner.configuration,
        configurationId: winner.configurationId,
        metrics: winner.metrics,
      },
    },
    limitations: {
      zeroWithinUserRatingVarianceRate: 0.5002,
      positiveOnlyUserRate: 0.6435,
      singleTargetValidation: true,
      testRowsRead: false,
    },
    privacy: {
      aggregateOnly: true,
      rawIdentifiersIncluded: false,
      rawRatingsIncluded: false,
      factorsSerialized: false,
    },
  };
  assertAggregateOnlyReport(report);
  await historicalEvaluationRepository.assertReleaseStillActive(active);
  const selectionArtifactDigest = canonicalDigest(report);
  const authorization = {
    schemaVersion: 1,
    decision: "authorize-final-test",
    datasetKey: active.datasetKey,
    validationSealDigest: base.seal.digest,
    experimentContractDigest: base.gate.experimentContractDigest,
    validationSelectionFile: "validation-grid-results.json",
    validationSelectionCanonicalization: "sha256(JSON.stringify(parsed complete validation-grid-results.json))",
    validationSelectionArtifactDigest: selectionArtifactDigest,
    candidateVersion: "biased-matrix-factorization-v1",
    candidateImplementationFiles: candidateImplementation.files,
    candidateImplementationDigest: candidateImplementation.digest,
    winningConfiguration: winner.configuration,
    winningConfigurationId: winner.configurationId,
    selectionRule: base.contract.selection,
    allAttemptedConfigurations: attempts.length,
    testAuthorized: true,
  };
  assertAggregateOnlyReport(authorization);
  await writeImmutableDirectory(output, {
    "validation-grid-results.json": report,
    "final-test-authorization.json": authorization,
    "REPORT.md": validationMarkdown(report),
  });
  console.log(JSON.stringify({
    status: report.status,
    output,
    attempts: attempts.length,
    winner: winner.configuration,
    validationSelectionArtifactDigest: selectionArtifactDigest,
    candidateImplementationDigest: candidateImplementation.digest,
    testAuthorized: true,
  }));
}

async function runTest({ runDirectory, active, base }) {
  const validationDirectory = path.join(runDirectory, VALIDATION_DIRECTORY_NAME);
  const output = path.join(runDirectory, "final-test");
  const attemptMarker = path.join(runDirectory, "final-test-attempt-claimed.json");
  if (await exists(output)) throw new Error("The historical final-test artifact already exists.");
  if (await exists(attemptMarker)) {
    throw new Error("The one-time historical final-test attempt was already claimed.");
  }
  const [validationReport, authorization] = await Promise.all([
    readJson(path.join(validationDirectory, "validation-grid-results.json")),
    readJson(path.join(validationDirectory, "final-test-authorization.json")),
  ]);
  const candidateImplementation = await readCandidateImplementation();
  const selectionArtifactDigest = canonicalDigest(validationReport);
  const selected = selectHistoricalMatrixFactorizationWinner(validationReport.attempts);
  if (
    authorization.schemaVersion !== 1
    || authorization.decision !== "authorize-final-test"
    || authorization.testAuthorized !== true
    || authorization.datasetKey !== active.datasetKey
    || authorization.validationSealDigest !== base.seal.digest
    || authorization.experimentContractDigest !== base.gate.experimentContractDigest
    || authorization.validationSelectionArtifactDigest !== selectionArtifactDigest
    || authorization.candidateVersion !== "biased-matrix-factorization-v1"
    || authorization.candidateImplementationDigest !== candidateImplementation.digest
    || canonicalDigest(authorization.winningConfiguration) !== canonicalDigest(selected.configuration)
    || validationReport.attempts.length !== base.contract.validationGrid.configurationCount
  ) {
    throw new Error("The post-validation final-test authorization is invalid.");
  }

  // Reproduce validation from train-only evidence before the first test-row read.
  const [products, validationSubjects] = await Promise.all([
    historicalEvaluationRepository.readProducts(active.datasetKey),
    historicalEvaluationRepository.readSubjects(active.datasetKey, { splits: ["train", "validation"] }),
  ]);
  const reproducedBaselineValidation = evaluateHistoricalStage({
    datasetKey: active.datasetKey,
    stage: "validation",
    subjects: validationSubjects,
    products,
    k: base.storedProtocol.k,
    randomSeed: base.storedProtocol.randomSeed,
  });
  verifyValidationSeal(base.seal, base.storedProtocol, base.storedDescriptor, reproducedBaselineValidation);
  const reproducedWinner = evaluateHistoricalMatrixFactorization({
    datasetKey: active.datasetKey,
    stage: "validation",
    subjects: validationSubjects,
    products,
    configuration: authorization.winningConfiguration,
    k: base.storedProtocol.k,
    minimumTrainingRatings: base.storedProtocol.minimumTrainingRatings,
    seed: DEFAULT_SEED,
  });
  const storedWinner = validationReport.attempts.find(
    (attempt) => attempt.configurationId === authorization.winningConfigurationId,
  );
  if (
    !storedWinner
    || canonicalDigest(reproducedWinner.metrics) !== canonicalDigest(storedWinner.metrics)
    || canonicalDigest(reproducedWinner.configuration) !== canonicalDigest(storedWinner.configuration)
    || canonicalDigest(reproducedWinner.fit) !== canonicalDigest(storedWinner.fit)
    || canonicalDigest(reproducedWinner.cohort) !== canonicalDigest(storedWinner.cohort)
    || canonicalDigest(reproducedWinner.coldEvidence) !== canonicalDigest(storedWinner.coldEvidence)
  ) {
    throw new Error("The frozen matrix-factorization validation winner did not reproduce.");
  }
  await historicalEvaluationRepository.assertReleaseStillActive(active);

  // Claim the one permitted attempt atomically before the first test-row query. The
  // marker is intentionally never removed, including when anything later fails.
  const attemptClaim = {
    schemaVersion: 1,
    status: "claimed-before-first-test-row-query",
    datasetKey: active.datasetKey,
    validationSealDigest: base.seal.digest,
    experimentContractDigest: base.gate.experimentContractDigest,
    validationSelectionArtifactDigest: selectionArtifactDigest,
    candidateImplementationDigest: candidateImplementation.digest,
    winningConfigurationId: authorization.winningConfigurationId,
    rerunPermitted: false,
  };
  assertAggregateOnlyReport(attemptClaim);
  await claimHistoricalFinalTestAttempt(attemptMarker, attemptClaim);

  // This is the first test-row read and occurs only after all frozen bindings reproduce
  // and the durable one-time attempt claim exists.
  const testStartedAt = performance.now();
  const startRss = process.memoryUsage().rss;
  const sampler = resourceSampler({
    startRss,
    maximumDeltaBytes: base.contract.resourceGuard.sampledPeakRssDeltaBytesMaximum,
    startTime: testStartedAt,
    maximumElapsedMs: base.contract.resourceGuard.finalTestWallClockMillisecondsMaximum,
  });
  const testSubjects = await historicalEvaluationRepository.readSubjects(active.datasetKey, {
    splits: ["train", "validation", "test"],
  });
  const baselineResults = evaluateHistoricalStage({
    datasetKey: active.datasetKey,
    stage: "test",
    subjects: testSubjects,
    products,
    k: base.storedProtocol.k,
    randomSeed: base.storedProtocol.randomSeed,
  });
  sampler.assertWithin();
  const matrixFactorization = evaluateHistoricalMatrixFactorization({
    datasetKey: active.datasetKey,
    stage: "test",
    subjects: testSubjects,
    products,
    configuration: authorization.winningConfiguration,
    k: base.storedProtocol.k,
    minimumTrainingRatings: base.storedProtocol.minimumTrainingRatings,
    seed: DEFAULT_SEED,
    onResourceSample: sampler.sample,
    assertWithinResourceGuard: sampler.assertWithin,
  });
  sampler.assertWithin();
  await historicalEvaluationRepository.assertReleaseStillActive(active);
  const finalReport = {
    schemaVersion: 1,
    status: "final-test-complete",
    datasetKey: active.datasetKey,
    protocol: {
      evidenceSplits: ["train", "validation"],
      targetSplit: "test",
      relevanceThreshold: base.storedProtocol.relevanceThreshold,
      candidatePolicy: base.storedProtocol.candidatePolicy,
      k: base.storedProtocol.k,
    },
    authorization: {
      validationSealDigest: base.seal.digest,
      experimentContractDigest: base.gate.experimentContractDigest,
      selectionArtifactDigest,
      candidateImplementationDigest: candidateImplementation.digest,
    },
    selectedConfiguration: authorization.winningConfiguration,
    cohort: baselineResults.cohort,
    statistics: baselineResults.statistics,
    models: [
      ...baselineResults.models.map((model) => ({
        ...model,
        metricsPrecision: "six-decimal-reported-values",
        metrics: roundedMetrics(model.metrics),
      })),
      {
        model: "biased-matrix-factorization",
        algorithmVersion: "biased-matrix-factorization-v1",
        metricsFullPrecision: matrixFactorization.metrics,
        metricsPrecision: "full-ieee-754-plus-six-decimal-reported-values",
        metrics: roundedMetrics(matrixFactorization.metrics),
      },
    ],
    matrixFactorization,
    runtime: {
      elapsedMs: Math.round(performance.now() - testStartedAt),
      ...sampler.snapshot(),
    },
    privacy: {
      aggregateOnly: true,
      rawIdentifiersIncluded: false,
      rawRatingsIncluded: false,
      factorsSerialized: false,
    },
    limitations: {
      historicalSubjectsAreNotGroovehausCustomers: true,
      livePersonalizationNotMeasured: true,
      postTestTuningPerformed: false,
    },
  };
  assertAggregateOnlyReport(finalReport);
  await writeImmutableDirectory(output, {
    "test-results.json": finalReport,
    "REPORT.md": finalTestMarkdown(finalReport),
  });
  console.log(JSON.stringify({
    status: finalReport.status,
    output,
    evaluatedSubjects: finalReport.cohort.evaluatedSubjects,
    selectedConfiguration: finalReport.selectedConfiguration,
    elapsedMs: finalReport.runtime.elapsedMs,
  }));
}

try {
  const options = parseArguments(process.argv.slice(2));
  await loadRuntime();
  const runDirectory = path.resolve(
    options.outputRoot,
    AMAZON_CURRENT_DATASET_KEY,
    options.runId,
  );
  const active = await historicalEvaluationRepository.getActiveDataset();
  if (
    !active
    || active.datasetKey !== AMAZON_CURRENT_DATASET_KEY
    || active.productCollection !== "datasetProducts"
  ) {
    throw new Error("The active historical dataset is not the pinned current release.");
  }
  const base = await loadBase(runDirectory, active);
  if (options.stage === "validation") await runValidation({ runDirectory, active, base });
  else await runTest({ runDirectory, active, base });
} catch (error) {
  console.error(`Historical matrix-factorization experiment failed: ${error?.message || error?.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
