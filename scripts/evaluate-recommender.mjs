import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { buildEvaluationDataset } from "../src/lib/recommender/evaluationDataset.js";
import { evaluateOffline } from "../src/lib/recommender/offlineEvaluation.js";
import { evaluationRepository } from "../src/repositories/evaluationRepository.js";

const RETENTION_DAYS = 90;
const MINIMUM_SUBJECTS = 20;
const MINIMUM_POSITIVES = 5;

function dateArgument(value, name) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error(`${name} must be a valid ISO date.`);
  return date;
}

function parseArguments(argv, now = new Date()) {
  const options = {
    from: new Date(now.getTime() - RETENTION_DAYS * 24 * 60 * 60 * 1_000),
    to: now,
    k: 10,
    output: null,
    randomSeed: "groovehaus-eval-v1",
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    const [name, inlineValue] = argument.split("=", 2);
    const value = inlineValue ?? argv[index + 1];
    if (!value || value.startsWith("--")) throw new Error(`${name} requires a value.`);
    if (inlineValue === undefined) index += 1;
    if (name === "--from") options.from = dateArgument(value, "--from");
    else if (name === "--to") options.to = dateArgument(value, "--to");
    else if (name === "--k") options.k = Number(value);
    else if (name === "--output") options.output = value;
    else if (name === "--seed") options.randomSeed = value;
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (options.from >= options.to) throw new Error("--from must be earlier than --to.");
  if (!Number.isInteger(options.k) || options.k < 1 || options.k > 100) {
    throw new Error("--k must be an integer from 1 through 100.");
  }
  return options;
}

function ensureAggregateOnly(value, trail = []) {
  const forbidden = new Set(["subjectId", "anonymousId", "userPublicId", "sessionId", "eventId"]);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) throw new Error(`Private identifier reached report output at ${[...trail, key].join(".")}.`);
    ensureAggregateOnly(child, [...trail, key]);
  }
}

function markdownReport(report) {
  const lines = [
    "# Recommender Offline Evaluation",
    "",
    `Status: ${report.status}`,
    "",
    `Requested window: ${report.dataset.requestedWindow.from} through ${report.dataset.requestedWindow.to}`,
    "",
    `Eligible subjects: ${report.dataset.counts.eligibleSubjects} of ${report.dataset.minimumEvidence.subjects} required.`,
    "",
    `Positive events per eligible subject: at least ${report.dataset.minimumEvidence.positiveEventsPerSubject}.`,
    "",
  ];
  if (report.status === "insufficient-evidence") {
    lines.push(
      "No recommendation-quality conclusion is reported because the minimum evidence boundary was not met.",
      "",
      "Only aggregate event completeness and eligibility counts are valid at this stage.",
      "",
    );
  } else {
    lines.push(
      `Protocol: ${report.results.split}; k=${report.results.k}; ${report.results.candidatePolicy}.`,
      "",
      `| Model | NDCG@${report.results.k} | MAP@${report.results.k} | HitRate@${report.results.k} | Coverage | Novelty |`,
      "| --- | --- | --- | --- | --- | --- |",
    );
    for (const model of report.results.models) {
      lines.push(`| ${model.model} | ${model.metrics[`ndcg@${report.results.k}`]} | ${model.metrics[`map@${report.results.k}`]} | ${model.metrics[`hitRate@${report.results.k}`]} | ${model.metrics.coverage} | ${model.metrics.novelty} |`);
    }
    lines.push("", ...report.results.models.flatMap((model) => [`- ${model.interpretation}`, ""]));
  }
  lines.push("## Captured-field coverage", "");
  for (const [collection, fields] of Object.entries(report.dataset.capturedFieldCoverage)) {
    lines.push(`### ${collection === "interactions" ? "Interactions" : "Recommendation logs"}`, "");
    lines.push("| Field | Present | Total | Coverage |", "| --- | ---: | ---: | ---: |");
    for (const field of fields) {
      lines.push(`| ${field.field} | ${field.present} | ${field.total} | ${(field.rate * 100).toFixed(2)}% |`);
    }
    lines.push("");
  }
  lines.push("This report contains aggregate counts only and no username, browser identifier, session identifier, or raw interaction row.", "");
  return lines.join("\n");
}

try {
  const options = parseArguments(process.argv.slice(2));
  const input = await evaluationRepository.readInputs({
    from: options.from,
    to: options.to,
    pseudonymSalt: randomBytes(32),
  });
  const recommendableProducts = input.products.filter((product) => product.stock !== "out");
  const itemUniverse = new Set(recommendableProducts.map((product) => product.id));
  const dataset = buildEvaluationDataset(input.interactions, {
    itemUniverse,
    minimumSubjects: MINIMUM_SUBJECTS,
    minimumPositiveEvents: MINIMUM_POSITIVES,
  });
  const results = dataset.status === "eligible"
    ? evaluateOffline(dataset, recommendableProducts, {
        k: options.k,
        randomSeed: options.randomSeed,
      })
    : null;
  const report = {
    generatedAt: new Date().toISOString(),
    status: dataset.status === "eligible" ? "evaluated" : "insufficient-evidence",
    dataset: {
      requestedWindow: { from: options.from.toISOString(), to: options.to.toISOString() },
      observedWindow: dataset.window,
      counts: dataset.counts,
      minimumEvidence: dataset.minimumEvidence,
      capturedFieldCoverage: input.capturedFieldCoverage,
      recommendationVersions: input.recommendationVersions,
    },
    protocol: {
      relevance: "final rating >= 4, wishlist add, or cart add per unique product",
      split: "per-subject temporal leave-last-positive-out",
      candidatePolicy: "full active in-stock catalog excluding training positives",
      k: options.k,
      baselines: ["random", "popularity"],
    },
    results,
    privacy: { aggregateOnly: true, rawIdentifiersIncluded: false, rawInteractionsIncluded: false },
  };
  ensureAggregateOnly(report);

  const date = report.generatedAt.slice(0, 10);
  const output = path.resolve(options.output || path.join("reports", "recommender", `${date}-content-demo-v1`));
  await mkdir(output, { recursive: true });
  await Promise.all([
    writeFile(path.join(output, "dataset-summary.json"), `${JSON.stringify(report.dataset, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "results.json"), `${JSON.stringify(report, null, 2)}\n`, "utf8"),
    writeFile(path.join(output, "REPORT.md"), markdownReport(report), "utf8"),
  ]);
  console.log(JSON.stringify({
    status: report.status,
    output,
    eligibleSubjects: dataset.counts.eligibleSubjects,
    requiredSubjects: dataset.minimumEvidence.subjects,
    usersEvaluated: results?.usersEvaluated || 0,
  }));
} catch (error) {
  console.error(`Offline evaluation failed: ${error.message || error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
