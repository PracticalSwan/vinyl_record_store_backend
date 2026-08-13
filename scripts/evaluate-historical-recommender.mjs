import { access, mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { AMAZON_CURRENT_DATASET_KEY } from "../src/lib/dataset/amazonDatasetReleases.js";
import { disconnectMongoDB } from "../src/lib/db/mongodb.js";
import {
  assertAggregateOnlyReport,
  createImplementationDigest,
  createValidationSeal,
  evaluateHistoricalStage,
  HISTORICAL_CONTENT_VERSION,
  HISTORICAL_POPULARITY_VERSION,
  HISTORICAL_RANDOM_VERSION,
  verifyValidationSeal,
} from "../src/lib/recommender/historicalOfflineEvaluation.js";
import { historicalEvaluationRepository } from "../src/repositories/historicalEvaluationRepository.js";

const DEFAULT_SEED = "groovehaus-historical-v1";
const K = 10;

function parseArguments(argv) {
  const options = {
    stage: "validation",
    runId: null,
    seed: DEFAULT_SEED,
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
    else if (name === "--seed") options.seed = value;
    else if (name === "--output-root") options.outputRoot = value;
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!["validation", "test"].includes(options.stage)) {
    throw new Error("--stage must be validation or test.");
  }
  if (!options.runId) throw new Error("--run-id is required for immutable historical reports.");
  if (!/^[a-z0-9][a-z0-9._-]{0,79}$/i.test(options.runId)) {
    throw new Error("--run-id contains unsupported characters.");
  }
  return options;
}

async function frozenProtocol(seed) {
  const implementationFiles = [
    "src/lib/recommender/contentBased.js",
    "src/lib/recommender/evaluate.js",
    "src/lib/recommender/historicalOfflineEvaluation.js",
  ];
  const implementationSources = Object.fromEntries(await Promise.all(
    implementationFiles.map(async (file) => [file, await readFile(path.resolve(file), "utf8")]),
  ));
  return {
    schemaVersion: 1,
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    relevanceThreshold: 4,
    minimumTrainingRatings: 3,
    k: K,
    randomSeed: seed,
    evaluatorVersion: "historical-offline-evaluation-v1",
    implementationFiles,
    implementationDigest: createImplementationDigest(implementationSources),
    baselineVersions: {
      random: `${HISTORICAL_RANDOM_VERSION}:${seed}`,
      popularity: HISTORICAL_POPULARITY_VERSION,
      content: HISTORICAL_CONTENT_VERSION,
    },
    candidatePolicy: "full pinned dataset catalog excluding all allowed-history observations",
    popularityEvidence: "positive allowed-history ratings from all history subjects",
    contentEvidence: "positive allowed-history ratings for the evaluated subject",
    noveltyEvidence: "all allowed-history ratings from all history subjects",
    noveltyZeroSupportFloor: "1 / (allowed-history subjects + 1)",
    validation: { evidenceSplits: ["train"], targetSplit: "validation" },
    test: { evidenceSplits: ["train", "validation"], targetSplit: "test" },
    finalTestRule: "run once after NEXT-02 and any approved NEXT-03 validation tuning are frozen",
  };
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

function markdownValidation(report) {
  const k = report.results.k;
  const statistics = report.results.statistics;
  const lines = [
    "# Historical Recommender Validation Benchmark",
    "",
    `Status: ${report.status}`,
    "",
    `Dataset: \`${report.dataset.datasetKey}\``,
    "",
    `Protocol: train evidence to validation targets; k=${k}; relevance is rating >= 4.`,
    "",
    `Evaluated subjects: ${report.results.cohort.evaluatedSubjects}.`,
    "",
    "The validation cohort is stage-specific. It is not the 1,708-subject test-readiness cohort reported by the historical readiness command.",
    "",
    `| Model | NDCG@${k} | MAP@${k} | HitRate@${k} | Coverage | Novelty | Personalization |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const model of report.results.models) {
    lines.push(`| ${model.model} | ${model.metrics[`ndcg@${k}`]} | ${model.metrics[`map@${k}`]} | ${model.metrics[`hitRate@${k}`]} | ${model.metrics.coverage} | ${model.metrics.novelty} | ${model.metrics.personalization} |`);
  }
  lines.push(
    "",
    "## Support and sparsity",
    "",
    `Training-corpus density: ${statistics.trainingCorpusDensity}. Evaluation-cohort density: ${statistics.evaluationCohortDensity}.`,
    "",
    `Eligible-subject train ratings: median ${statistics.userRatings.median}, mean ${statistics.userRatings.mean}, range ${statistics.userRatings.minimum}-${statistics.userRatings.maximum}.`,
    "",
    `Positive train ratings: median ${statistics.userPositiveRatings.median}, mean ${statistics.userPositiveRatings.mean}.`,
    "",
    `Observed item support: median ${statistics.itemObservedSupport.median}, p90 ${statistics.itemObservedSupport.p90}, maximum ${statistics.itemObservedSupport.maximum}.`,
    "",
    `Positive item support: median ${statistics.itemPositiveSupport.median}; ${statistics.zeroPositiveSupportItems} zero-support (${statistics.zeroPositiveSupportRate}) and ${statistics.nearColdPositiveItems} zero-or-one-support products (${statistics.nearColdPositiveRate}).`,
    "",
    `Validation targets cold to train: ${statistics.targetSupport.cold} of ${statistics.targetSupport.targets} (${statistics.targetSupport.coldRate}).`,
    "",
    `Candidate count: median ${statistics.candidateCount.median}, mean ${statistics.candidateCount.mean}, range ${statistics.candidateCount.minimum}-${statistics.candidateCount.maximum}.`,
    "",
    `Content-positive evidence was available for ${statistics.contentSignal.availableSubjects} subjects; ${statistics.contentSignal.zeroPositiveSeedSubjects} subjects had no positive content seed and therefore received deterministic zero-score content ties.`,
    "",
    "The content baseline reuses content-demo-v1 metadata weights, deterministic public-ID ties, and its maximum-two-items-per-artist diversification cap.",
    "",
    "## Content metadata coverage",
    "",
    "| Field | Present | Total | Coverage |",
    "| --- | ---: | ---: | ---: |",
    ...Object.entries(statistics.metadataCoverage).map(([field, coverage]) => (
      `| ${field} | ${coverage.present} | ${coverage.total} | ${coverage.rate} |`
    )),
    "",
    "## Runtime observation",
    "",
    `Elapsed ${report.results.runtime.elapsedMs} ms; RSS changed from ${report.results.runtime.rssBeforeBytes} to ${report.results.runtime.rssAfterBytes} bytes; heap used changed from ${report.results.runtime.heapUsedBeforeBytes} to ${report.results.runtime.heapUsedAfterBytes} bytes. These are process observations, not a cross-machine benchmark.`,
    "",
    "## Test status",
    "",
    "The live historical test split remains sealed. No test metric or test-target support statistic was computed for NEXT-02.",
    "",
    "## Interpretation boundaries",
    "",
    "Historical Amazon subjects are research pseudonyms, not Groovehaus application customers.",
    "",
    "This validation result does not measure the live preference, behavior, popularity, or hybrid personalization modes because those application signals are absent from the historical dataset.",
    "",
    "Each stored validation split has at most one row per subject, so NDCG, MAP, and MRR provide closely related single-target rank evidence rather than independent multi-relevance evidence.",
    "",
    "The absolute hit rates are low. Content produced 98 top-10 hits versus 78 for popularity, but no uncertainty interval or significance test was run; this is directional gate evidence, not a robust superiority claim.",
    "",
    "Dataset readiness and validation metrics are evidence inputs, not a claim of production recommendation quality.",
    "",
  );
  return lines.join("\n");
}

function markdownTest(report) {
  const k = report.results.k;
  const statistics = report.results.statistics;
  const runtime = report.results.runtime || {
    elapsedMs: "not-recorded",
    rssBeforeBytes: "not-recorded",
    rssAfterBytes: "not-recorded",
  };
  const lines = [
    "# Historical Recommender Final Test Benchmark",
    "",
    `Status: ${report.status}`,
    "",
    `Dataset: \`${report.dataset.datasetKey}\``,
    "",
    `Protocol: train plus validation evidence to untouched test targets; k=${k}; relevance is rating >= 4.`,
    "",
    `Evaluated subjects: ${report.results.cohort.evaluatedSubjects}.`,
    "",
    `| Model | NDCG@${k} | MAP@${k} | HitRate@${k} | Coverage | Novelty | Personalization |`,
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
  ];
  for (const model of report.results.models) {
    lines.push(`| ${model.model} | ${model.metrics[`ndcg@${k}`]} | ${model.metrics[`map@${k}`]} | ${model.metrics[`hitRate@${k}`]} | ${model.metrics.coverage} | ${model.metrics.novelty} | ${model.metrics.personalization} |`);
  }
  lines.push(
    "",
    "## Frozen authorization",
    "",
    "This table was produced only after the NEXT-02 decision record matched the sealed validation protocol, deterministic validation result, dataset descriptor, and implementation digest.",
    "",
    "## Support and model behavior",
    "",
    `Test cohort: ${report.results.cohort.evaluatedSubjects}; training-corpus density: ${statistics.trainingCorpusDensity}; evaluation-cohort density: ${statistics.evaluationCohortDensity}.`,
    "",
    `Test targets cold to train-plus-validation: ${statistics.targetSupport.cold} of ${statistics.targetSupport.targets} (${statistics.targetSupport.coldRate}).`,
    "",
    `Candidate count: median ${statistics.candidateCount.median}, mean ${statistics.candidateCount.mean}.`,
    "",
    `Content-positive evidence was available for ${statistics.contentSignal.availableSubjects} subjects; ${statistics.contentSignal.zeroPositiveSeedSubjects} had no positive seed and used deterministic zero-score ties.`,
    "",
    "The content baseline retains the maximum-two-items-per-artist diversification cap declared in the sealed implementation.",
    "",
    "## Metadata and runtime",
    "",
    `Artist/genre/year/label coverage: ${statistics.metadataCoverage.artist.rate}/${statistics.metadataCoverage.genre.rate}/${statistics.metadataCoverage.year.rate}/${statistics.metadataCoverage.label.rate}.`,
    "",
    `Elapsed ${runtime.elapsedMs} ms; RSS changed from ${runtime.rssBeforeBytes} to ${runtime.rssAfterBytes} bytes. This is an approximate process observation, not peak memory or a cross-machine benchmark.`,
    "",
    "Historical Amazon subjects are research pseudonyms, not Groovehaus application customers.",
    "",
    "This final test does not establish quality for live Groovehaus personalization signals.",
    "",
  );
  return lines.join("\n");
}

async function readGateDecision(output) {
  const gatePath = path.join(output, "next-02-decision.json");
  const gate = await readFile(gatePath, "utf8").then(JSON.parse).catch((error) => {
    if (error?.code === "ENOENT") {
      throw new Error("Final test requires a frozen NEXT-02 decision record.");
    }
    throw error;
  });
  if (
    gate?.schemaVersion !== 1
    || !["approve", "reject", "defer"].includes(gate?.decision)
    || gate?.datasetKey !== AMAZON_CURRENT_DATASET_KEY
    || !/^[0-9a-f]{64}$/.test(gate?.validationSealDigest || "")
    || gate?.testAuthorized !== true
  ) {
    throw new Error("The frozen NEXT-02 decision record is invalid.");
  }
  if (gate.decision === "approve") {
    if (!gate.experimentContractDigest?.match(/^[0-9a-f]{64}$/)) {
      throw new Error("Approved NEXT-03 work requires a frozen experiment contract digest.");
    }
    throw new Error("The baseline-only runner cannot execute test after NEXT-03 approval; add the frozen candidate comparison first.");
  }
  return gate;
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

async function writeNewValidationRun(output, artifacts) {
  if (await exists(output)) throw new Error("The historical validation run directory already exists.");
  const parent = path.dirname(output);
  await mkdir(parent, { recursive: true });
  const temporary = `${output}.${process.pid}.tmp`;
  await rm(temporary, { recursive: true, force: true });
  await mkdir(temporary, { recursive: true });
  try {
    await Promise.all(Object.entries(artifacts).map(([filename, value]) => writeFile(
      path.join(temporary, filename),
      typeof value === "string" ? value : `${JSON.stringify(value, null, 2)}\n`,
      "utf8",
    )));
    await rename(temporary, output);
  } catch (error) {
    await rm(temporary, { recursive: true, force: true }).catch(() => {});
    throw error;
  }
}

async function writeNewTestReport(output, report) {
  const destination = path.join(output, "final-test");
  if (await exists(destination)) throw new Error("The historical final-test report already exists.");
  await writeNewValidationRun(destination, {
    "protocol.json": report.protocol,
    "dataset-summary.json": report.dataset,
    "test-results.json": report.results,
    "REPORT.md": markdownTest(report),
  });
}

try {
  const options = parseArguments(process.argv.slice(2));
  const protocol = await frozenProtocol(options.seed);
  const output = path.resolve(options.outputRoot, AMAZON_CURRENT_DATASET_KEY, options.runId);
  const active = await historicalEvaluationRepository.getActiveDataset();
  if (!active) throw new Error("No active historical dataset release exists.");
  if (active.datasetKey !== AMAZON_CURRENT_DATASET_KEY) {
    throw new Error("The active historical dataset is not the pinned current release.");
  }
  if (active.productCollection !== "datasetProducts") {
    throw new Error("The active historical release does not use the dataset product collection.");
  }
  const descriptor = datasetDescriptor(active);

  if (options.stage === "test") {
    const [storedProtocol, storedDescriptor, storedResults, storedSeal, gate] = await Promise.all([
      readFile(path.join(output, "protocol.json"), "utf8").then(JSON.parse),
      readFile(path.join(output, "dataset-summary.json"), "utf8").then(JSON.parse),
      readFile(path.join(output, "validation-results.json"), "utf8").then(JSON.parse),
      readFile(path.join(output, "validation-seal.json"), "utf8").then(JSON.parse),
      readGateDecision(output),
    ]);
    verifyValidationSeal(storedSeal, storedProtocol, storedDescriptor, storedResults);
    if (gate.validationSealDigest !== storedSeal.digest) {
      throw new Error("The NEXT-02 decision does not authorize this sealed validation run.");
    }
  }

  const beforeMemory = process.memoryUsage();
  const startedAt = performance.now();
  const splits = ["train", "validation"];
  const [products, subjects] = await Promise.all([
    historicalEvaluationRepository.readProducts(active.datasetKey),
    historicalEvaluationRepository.readSubjects(active.datasetKey, { splits }),
  ]);
  if (products.length !== active.counts?.products || subjects.length !== active.counts?.users) {
    throw new Error("Historical evaluation inputs do not match the active release counts.");
  }
  const validationResults = evaluateHistoricalStage({
    datasetKey: active.datasetKey,
    stage: "validation",
    subjects,
    products,
    k: K,
    randomSeed: options.seed,
  });
  let results = validationResults;
  if (options.stage === "test") {
    const [storedResults, storedSeal] = await Promise.all([
      readFile(path.join(output, "validation-results.json"), "utf8").then(JSON.parse),
      readFile(path.join(output, "validation-seal.json"), "utf8").then(JSON.parse),
    ]);
    verifyValidationSeal(storedSeal, protocol, descriptor, validationResults);
    verifyValidationSeal(storedSeal, protocol, descriptor, storedResults);
    const testSubjects = await historicalEvaluationRepository.readSubjects(active.datasetKey, {
      splits: ["train", "validation", "test"],
    });
    if (testSubjects.length !== active.counts?.users) {
      throw new Error("Historical test inputs do not match the active release counts.");
    }
    results = evaluateHistoricalStage({
      datasetKey: active.datasetKey,
      stage: "test",
      subjects: testSubjects,
      products,
      k: K,
      randomSeed: options.seed,
    });
  }
  await historicalEvaluationRepository.assertReleaseStillActive(active);
  const afterMemory = process.memoryUsage();
  const runtime = {
    elapsedMs: Math.round(performance.now() - startedAt),
    rssBeforeBytes: beforeMemory.rss,
    rssAfterBytes: afterMemory.rss,
    heapUsedBeforeBytes: beforeMemory.heapUsed,
    heapUsedAfterBytes: afterMemory.heapUsed,
    note: "Process observations, not a cross-machine performance benchmark.",
  };
  const report = {
    schemaVersion: 1,
    status: "evaluated",
    protocol,
    dataset: descriptor,
    results: { ...results, runtime },
    privacy: { aggregateOnly: true, rawIdentifiersIncluded: false, rawRatingsIncluded: false },
  };
  assertAggregateOnlyReport(report);

  if (options.stage === "validation") {
    const seal = createValidationSeal(protocol, descriptor, report.results);
    await writeNewValidationRun(output, {
      "protocol.json": protocol,
      "dataset-summary.json": descriptor,
      "validation-results.json": report.results,
      "validation-seal.json": seal,
      "REPORT.md": markdownValidation(report),
    });
  } else {
    await writeNewTestReport(output, report);
  }

  console.log(JSON.stringify({
    status: report.status,
    stage: options.stage,
    datasetKey: active.datasetKey,
    output: options.stage === "validation" ? output : path.join(output, "final-test"),
    evaluatedSubjects: results.cohort.evaluatedSubjects,
    elapsedMs: runtime.elapsedMs,
  }));
} catch (error) {
  console.error(`Historical evaluation failed: ${error?.message || error?.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
