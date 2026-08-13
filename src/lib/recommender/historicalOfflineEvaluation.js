import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import { HISTORICAL_POSITIVE_RATING } from "../dataset/historicalEvaluationAdapter.js";
import { rankCatalogFromHistory } from "./contentBased.js";
import {
  averagePrecisionAtK,
  catalogCoverage,
  hitRateAtK,
  meanOverUsers,
  ndcgAtK,
  noveltyAtK,
  personalization,
  precisionAtK,
  recallAtK,
  reciprocalRankAtK,
} from "./evaluate.js";

export const HISTORICAL_RANDOM_VERSION = "historical-random-v1";
export const HISTORICAL_POPULARITY_VERSION = "historical-popularity-positive-v1";
export const HISTORICAL_REPORT_SCHEMA_VERSION = 1;
export const HISTORICAL_CONTENT_VERSION = "historical-content-profile-v1:content-demo-v1";

const STAGES = {
  validation: {
    evidenceFields: ["training"],
    targetField: "validationRelevantProductIds",
    availableSplits: ["train"],
    targetSplit: "validation",
  },
  test: {
    evidenceFields: ["training", "validation"],
    targetField: "testRelevantProductIds",
    availableSplits: ["train", "validation"],
    targetSplit: "test",
  },
};

const round = (value) => Number(value.toFixed(6));

function seedNumber(value) {
  return createHash("sha256").update(value).digest().readUInt32LE(0);
}

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function shuffle(values, seed) {
  const result = [...values];
  const random = randomGenerator(seedNumber(seed));
  for (let index = result.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [result[index], result[target]] = [result[target], result[index]];
  }
  return result;
}

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(fraction * sorted.length));
  return sorted[index];
}

function distribution(values) {
  const sorted = [...values].sort((left, right) => left - right);
  return {
    minimum: sorted[0] || 0,
    p25: percentile(sorted, 0.25),
    median: percentile(sorted, 0.5),
    p75: percentile(sorted, 0.75),
    p90: percentile(sorted, 0.9),
    maximum: sorted.at(-1) || 0,
    mean: round(meanOverUsers(sorted)),
  };
}

function stageEvidence(subject, config) {
  return config.evidenceFields.flatMap((field) => subject[field] || []);
}

function validateProducts(products, datasetKey) {
  if (!Array.isArray(products) || products.length === 0) {
    throw new Error("Historical evaluation requires a non-empty product universe.");
  }
  const seen = new Set();
  for (const product of products) {
    if (product.datasetKey !== datasetKey) {
      throw new Error("Historical evaluation products must belong to one pinned dataset version.");
    }
    if (!Number.isInteger(product.id) || product.id < 1 || seen.has(product.id)) {
      throw new Error("Historical evaluation product IDs must be unique positive integers.");
    }
    seen.add(product.id);
  }
}

function buildCohort(subjects, config, itemUniverse, minimumTrainingRatings) {
  const cohort = [];
  const excluded = {
    insufficientTraining: 0,
    noRelevantTarget: 0,
    noCandidate: 0,
  };

  for (const subject of subjects) {
    const evidence = stageEvidence(subject, config);
    const targets = new Set(subject[config.targetField] || []);
    const candidateExclusions = new Set(evidence.map((row) => row.productId));
    for (const row of evidence) {
      if (!itemUniverse.has(row.productId)) {
        throw new Error("Historical evidence references a product outside the pinned universe.");
      }
    }
    if ((subject.training || []).length < minimumTrainingRatings) {
      excluded.insufficientTraining += 1;
      continue;
    }
    if (targets.size === 0) {
      excluded.noRelevantTarget += 1;
      continue;
    }
    for (const target of targets) {
      if (!itemUniverse.has(target)) {
        throw new Error("A held-out relevant product is outside the pinned product universe.");
      }
      if (candidateExclusions.has(target)) {
        throw new Error("A held-out relevant product leaked into available history.");
      }
    }
    const candidateCount = itemUniverse.size - candidateExclusions.size;
    if (candidateCount < 1) {
      excluded.noCandidate += 1;
      continue;
    }
    cohort.push({
      subjectKey: subject.subjectKey,
      evidence,
      positiveEvidence: evidence.filter((row) => row.rating >= HISTORICAL_POSITIVE_RATING),
      targets,
      candidateExclusions,
      candidateCount,
    });
  }
  return { cohort, excluded };
}

function supportMaps(subjects, config) {
  const observed = new Map();
  const positive = new Map();
  let evidenceSubjects = 0;
  for (const subject of subjects) {
    const evidence = stageEvidence(subject, config);
    if (!evidence.length) continue;
    evidenceSubjects += 1;
    for (const row of evidence) {
      observed.set(row.productId, (observed.get(row.productId) || 0) + 1);
      if (row.rating >= HISTORICAL_POSITIVE_RATING) {
        positive.set(row.productId, (positive.get(row.productId) || 0) + 1);
      }
    }
  }
  return { observed, positive, evidenceSubjects };
}

function candidatesFor(subject, itemIds) {
  return itemIds.filter((productId) => !subject.candidateExclusions.has(productId));
}

function validateRecommendations(recommendations, candidateSet, k) {
  if (!Array.isArray(recommendations)) {
    throw new Error("A historical recommender returned an invalid result shape.");
  }
  if (new Set(recommendations).size !== recommendations.length) {
    throw new Error("A historical recommendation list contains duplicates.");
  }
  if (recommendations.length > k) throw new Error("A historical recommendation list exceeded k.");
  for (const productId of recommendations) {
    if (!Number.isInteger(productId) || !candidateSet.has(productId)) {
      throw new Error("A historical recommendation was outside the shared candidate set.");
    }
  }
}

function aggregateMetrics(cohort, recommendationsBySubject, itemUniverse, noveltySupport, k) {
  const perSubject = {
    precision: [],
    recall: [],
    hitRate: [],
    mrr: [],
    map: [],
    ndcg: [],
    novelty: [],
  };
  const lists = [];
  for (const subject of cohort) {
    const recommended = recommendationsBySubject.get(subject.subjectKey) || [];
    lists.push(recommended);
    perSubject.precision.push(precisionAtK(subject.targets, recommended, k));
    perSubject.recall.push(recallAtK(subject.targets, recommended, k));
    perSubject.hitRate.push(hitRateAtK(subject.targets, recommended, k));
    perSubject.mrr.push(reciprocalRankAtK(subject.targets, recommended, k));
    perSubject.map.push(averagePrecisionAtK(subject.targets, recommended, k));
    perSubject.ndcg.push(ndcgAtK(subject.targets, recommended, k));
    perSubject.novelty.push(noveltyAtK(
      recommended,
      k,
      noveltySupport.observed,
      noveltySupport.evidenceSubjects,
    ));
  }
  return {
    [`precision@${k}`]: round(meanOverUsers(perSubject.precision)),
    [`recall@${k}`]: round(meanOverUsers(perSubject.recall)),
    [`hitRate@${k}`]: round(meanOverUsers(perSubject.hitRate)),
    [`mrr@${k}`]: round(meanOverUsers(perSubject.mrr)),
    [`map@${k}`]: round(meanOverUsers(perSubject.map)),
    [`ndcg@${k}`]: round(meanOverUsers(perSubject.ndcg)),
    coverage: round(catalogCoverage(lists, itemUniverse)),
    novelty: round(meanOverUsers(perSubject.novelty)),
    personalization: round(personalization(lists, k)),
  };
}

function metadataCoverage(products) {
  const fields = ["artist", "genre", "year", "label"];
  return Object.fromEntries(fields.map((field) => {
    const present = products.filter((product) => (
      field === "year" ? Number.isInteger(product[field]) : Boolean(product[field])
    )).length;
    return [field, { present, total: products.length, rate: round(present / products.length) }];
  }));
}

function modelInterpretation(name, metrics, k, stage) {
  return `${name} achieved NDCG@${k} ${metrics[`ndcg@${k}`].toFixed(3)}, MAP@${k} ${metrics[`map@${k}`].toFixed(3)}, and catalog coverage ${metrics.coverage.toFixed(3)} on the shared historical ${stage} protocol.`;
}

function deterministicEvaluationResult(result) {
  if (!result || typeof result !== "object") return null;
  const { runtime: _runtime, ...stable } = result;
  return stable;
}

function stableSealPayload(protocol, datasetDescriptor, validationResult) {
  return JSON.parse(JSON.stringify({
    protocol,
    dataset: {
      datasetKey: datasetDescriptor?.datasetKey,
      sourceVersion: datasetDescriptor?.sourceVersion,
      productCollection: datasetDescriptor?.productCollection,
      counts: datasetDescriptor?.counts,
      configDigest: datasetDescriptor?.configDigest,
      identityRegistryDigest: datasetDescriptor?.identityRegistryDigest,
      sealedAt: datasetDescriptor?.sealedAt,
    },
    validationResult: deterministicEvaluationResult(validationResult),
  }));
}

export function createImplementationDigest(sourceByName) {
  const entries = Object.entries(sourceByName || {}).sort(([left], [right]) => left.localeCompare(right));
  if (!entries.length || entries.some(([, source]) => typeof source !== "string" || source.length === 0)) {
    throw new Error("Historical implementation digest requires non-empty source files.");
  }
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export function createValidationSeal(protocol, datasetDescriptor, validationResult) {
  const payload = stableSealPayload(protocol, datasetDescriptor, validationResult);
  return {
    schemaVersion: 1,
    algorithm: "sha256",
    digest: createHash("sha256").update(JSON.stringify(payload)).digest("hex"),
    payload,
  };
}

export function verifyValidationSeal(seal, protocol, datasetDescriptor, validationResult) {
  const expected = createValidationSeal(protocol, datasetDescriptor, validationResult);
  if (
    seal?.schemaVersion !== expected.schemaVersion
    || seal?.algorithm !== expected.algorithm
    || seal?.digest !== expected.digest
    || !isDeepStrictEqual(seal?.payload, expected.payload)
  ) {
    throw new Error("Historical validation seal does not match the frozen protocol and dataset.");
  }
  return true;
}

export function assertAggregateOnlyReport(value, trail = []) {
  const forbidden = new Set([
    "anonymousId",
    "eventId",
    "externalItemKey",
    "recordDigest",
    "sessionId",
    "sourceRow",
    "subjectId",
    "subjectKey",
    "userKey",
    "userPublicId",
  ]);
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) {
      throw new Error(`Private identifier reached report output at ${[...trail, key].join(".")}.`);
    }
    assertAggregateOnlyReport(child, [...trail, key]);
  }
}

export function evaluateHistoricalStage({
  datasetKey,
  stage,
  subjects,
  products,
  k = 10,
  minimumTrainingRatings = 3,
  randomSeed = "groovehaus-historical-v1",
} = {}) {
  const config = STAGES[stage];
  if (!datasetKey) throw new Error("Historical evaluation requires a pinned dataset key.");
  if (!config) throw new Error("Historical evaluation stage must be validation or test.");
  if (!Number.isInteger(k) || k < 1 || k > 100) {
    throw new TypeError("k must be an integer from 1 through 100.");
  }
  if (!Array.isArray(subjects)) throw new TypeError("Historical subjects must be an array.");
  validateProducts(products, datasetKey);
  for (const subject of subjects) {
    if (subject.datasetKey !== datasetKey) {
      throw new Error("Historical evaluation subjects must belong to one pinned dataset version.");
    }
  }

  const itemIds = products.map((product) => product.id).sort((left, right) => left - right);
  const itemUniverse = new Set(itemIds);
  const { cohort, excluded } = buildCohort(
    subjects,
    config,
    itemUniverse,
    minimumTrainingRatings,
  );
  if (!cohort.length) throw new Error("No historical subjects satisfy the shared stage eligibility rule.");
  const modelEvidenceSubjects = subjects.filter(
    (subject) => (subject.training || []).length >= minimumTrainingRatings,
  );
  const support = supportMaps(modelEvidenceSubjects, config);
  if (support.evidenceSubjects < 1) throw new Error("Historical evaluation has no allowed history evidence.");

  const recommenders = [
    {
      name: "random",
      algorithmVersion: `${HISTORICAL_RANDOM_VERSION}:${randomSeed}`,
      rank: (subject, candidates) => shuffle(
        candidates,
        `${randomSeed}:${stage}:${subject.subjectKey}`,
      ).slice(0, k),
    },
    {
      name: "popularity",
      algorithmVersion: HISTORICAL_POPULARITY_VERSION,
      rank: (_subject, candidates) => [...candidates]
        .sort((left, right) => (
          (support.positive.get(right) || 0) - (support.positive.get(left) || 0)
          || left - right
        ))
        .slice(0, k),
    },
    {
      name: "content-based",
      algorithmVersion: HISTORICAL_CONTENT_VERSION,
      rank: (subject) => rankCatalogFromHistory(
        products,
        new Set(subject.positiveEvidence.map((row) => row.productId)),
        k,
        {
          candidateExclusions: subject.candidateExclusions,
          includeOutOfStock: true,
        },
      ),
    },
  ];

  const models = recommenders.map((recommender) => {
    const recommendations = new Map();
    for (const subject of cohort) {
      const candidates = candidatesFor(subject, itemIds);
      const ranked = recommender.rank(subject, candidates);
      validateRecommendations(ranked, new Set(candidates), k);
      recommendations.set(subject.subjectKey, ranked);
    }
    const metrics = aggregateMetrics(cohort, recommendations, itemUniverse, support, k);
    return {
      model: recommender.name,
      algorithmVersion: recommender.algorithmVersion,
      metrics,
      interpretation: modelInterpretation(recommender.name, metrics, k, stage),
    };
  });

  if (ndcgAtK(new Set([1, 2, 3]), [1, 2, 3], 3) !== 1) {
    throw new Error("Ideal-order NDCG sanity check failed.");
  }

  const userRatings = cohort.map((subject) => subject.evidence.length);
  const userPositives = cohort.map((subject) => subject.positiveEvidence.length);
  const itemSupport = itemIds.map((id) => support.observed.get(id) || 0);
  const positiveItemSupport = itemIds.map((id) => support.positive.get(id) || 0);
  const zeroObservedSupportItems = itemSupport.filter((count) => count === 0).length;
  const zeroPositiveSupportItems = positiveItemSupport.filter((count) => count === 0).length;
  const nearColdObservedItems = itemSupport.filter((count) => count <= 1).length;
  const nearColdPositiveItems = positiveItemSupport.filter((count) => count <= 1).length;
  const validationTargets = cohort.flatMap((subject) => [...subject.targets]);
  const targetSupported = validationTargets.filter((id) => (support.observed.get(id) || 0) > 0).length;
  const candidateCounts = cohort.map((subject) => subject.candidateCount);
  const totalEvidenceRatings = userRatings.reduce((sum, count) => sum + count, 0);
  const corpusEvidenceRatings = modelEvidenceSubjects.reduce(
    (sum, subject) => sum + stageEvidence(subject, config).length,
    0,
  );
  const zeroPositiveSeedSubjects = cohort.filter(
    (subject) => subject.positiveEvidence.length === 0,
  ).length;

  const result = {
    schemaVersion: HISTORICAL_REPORT_SCHEMA_VERSION,
    status: "evaluated",
    evidenceSource: "historical-amazon-ratings",
    datasetKey,
    stage,
    availableSplits: config.availableSplits,
    targetSplit: config.targetSplit,
    relevance: `rating >= ${HISTORICAL_POSITIVE_RATING}`,
    candidatePolicy: "full pinned dataset catalog excluding every item observed in allowed history",
    contentSeedPolicy: "positive allowed-history ratings only",
    popularityPolicy: "positive allowed-history support across all history subjects",
    noveltyPolicy: "all-rating observed support across all allowed-history subjects",
    k,
    randomSeed,
    idealNdcg: 1,
    cohort: {
      sourceSubjects: subjects.length,
      evaluatedSubjects: cohort.length,
      excluded,
    },
    statistics: {
      userRatings: distribution(userRatings),
      userPositiveRatings: distribution(userPositives),
      itemObservedSupport: distribution(itemSupport),
      itemPositiveSupport: distribution(positiveItemSupport),
      zeroObservedSupportItems,
      zeroObservedSupportRate: round(zeroObservedSupportItems / itemUniverse.size),
      zeroPositiveSupportItems,
      zeroPositiveSupportRate: round(zeroPositiveSupportItems / itemUniverse.size),
      nearColdObservedItems,
      nearColdObservedRate: round(nearColdObservedItems / itemUniverse.size),
      nearColdPositiveItems,
      nearColdPositiveRate: round(nearColdPositiveItems / itemUniverse.size),
      evaluationCohortDensity: round(totalEvidenceRatings / (cohort.length * itemUniverse.size)),
      trainingCorpusDensity: round(
        corpusEvidenceRatings / (support.evidenceSubjects * itemUniverse.size),
      ),
      candidateCount: distribution(candidateCounts),
      contentSignal: {
        availableSubjects: cohort.length - zeroPositiveSeedSubjects,
        zeroPositiveSeedSubjects,
      },
      targetSupport: {
        targets: validationTargets.length,
        withObservedSupport: targetSupported,
        cold: validationTargets.length - targetSupported,
        coldRate: round((validationTargets.length - targetSupported) / validationTargets.length),
      },
      evidenceSubjectsForGlobalModels: support.evidenceSubjects,
      metadataCoverage: metadataCoverage(products),
    },
    models,
    privacy: {
      aggregateOnly: true,
      rawIdentifiersIncluded: false,
      rawRatingsIncluded: false,
    },
  };
  assertAggregateOnlyReport(result);
  return result;
}
