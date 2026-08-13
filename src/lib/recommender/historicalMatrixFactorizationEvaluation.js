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
import {
  BIASED_MATRIX_FACTORIZATION_SEED,
  trainBiasedMatrixFactorization,
} from "./biasedMatrixFactorization.js";

const STAGES = {
  validation: {
    evidenceFields: ["training"],
    targetField: "validationRelevantProductIds",
  },
  test: {
    evidenceFields: ["training", "validation"],
    targetField: "testRelevantProductIds",
  },
};

const compareStrings = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function stageEvidence(subject, config) {
  return config.evidenceFields.flatMap((field) => subject[field] || []);
}

function buildInputs({ datasetKey, stage, subjects, products, minimumTrainingRatings }) {
  const stageConfig = STAGES[stage];
  if (!stageConfig) throw new TypeError("Historical matrix-factorization stage must be validation or test.");
  if (!Array.isArray(subjects) || !Array.isArray(products) || products.length === 0) {
    throw new TypeError("Historical matrix-factorization evaluation requires subjects and products.");
  }
  const itemIds = products.map((product) => {
    if (product.datasetKey !== datasetKey || !Number.isInteger(product.id) || product.id < 1) {
      throw new Error("Historical matrix-factorization products must belong to one pinned universe.");
    }
    return product.id;
  }).sort((left, right) => left - right);
  if (new Set(itemIds).size !== itemIds.length) {
    throw new Error("Historical matrix-factorization products must have unique public IDs.");
  }
  const itemUniverse = new Set(itemIds);
  const fitSubjects = subjects.filter((subject) => {
    if (subject.datasetKey !== datasetKey) {
      throw new Error("Historical matrix-factorization subjects mix dataset versions.");
    }
    return (subject.training || []).length >= minimumTrainingRatings;
  }).sort((left, right) => compareStrings(left.subjectKey, right.subjectKey));
  const observations = [];
  const noveltySupport = new Map();
  for (const subject of fitSubjects) {
    for (const row of stageEvidence(subject, stageConfig)) {
      if (!itemUniverse.has(row.productId)) {
        throw new Error("Historical matrix-factorization evidence references an unknown product.");
      }
      observations.push({
        subjectKey: subject.subjectKey,
        productId: row.productId,
        rating: row.rating,
      });
      noveltySupport.set(row.productId, (noveltySupport.get(row.productId) || 0) + 1);
    }
  }
  const cohort = [];
  for (const subject of fitSubjects) {
    const evidence = stageEvidence(subject, stageConfig);
    const excluded = new Set(evidence.map((row) => row.productId));
    const targets = new Set(subject[stageConfig.targetField] || []);
    if (!targets.size) continue;
    for (const target of targets) {
      if (!itemUniverse.has(target) || excluded.has(target)) {
        throw new Error("Historical matrix-factorization target leaked or left the pinned universe.");
      }
    }
    if (itemIds.length - excluded.size < 1) continue;
    cohort.push({ subjectKey: subject.subjectKey, targets, excluded });
  }
  if (!cohort.length || !observations.length) {
    throw new Error("Historical matrix-factorization evaluation has no eligible evidence.");
  }
  return { cohort, fitSubjects, itemIds, itemUniverse, noveltySupport, observations };
}

function fullPrecisionMetrics(cohort, recommendationsBySubject, itemUniverse, noveltySupport, subjectCount, k) {
  const lists = [];
  const perSubject = {
    precision: [], recall: [], hitRate: [], mrr: [], map: [], ndcg: [], novelty: [],
  };
  for (const subject of cohort) {
    const recommendations = recommendationsBySubject.get(subject.subjectKey) || [];
    lists.push(recommendations);
    perSubject.precision.push(precisionAtK(subject.targets, recommendations, k));
    perSubject.recall.push(recallAtK(subject.targets, recommendations, k));
    perSubject.hitRate.push(hitRateAtK(subject.targets, recommendations, k));
    perSubject.mrr.push(reciprocalRankAtK(subject.targets, recommendations, k));
    perSubject.map.push(averagePrecisionAtK(subject.targets, recommendations, k));
    perSubject.ndcg.push(ndcgAtK(subject.targets, recommendations, k));
    perSubject.novelty.push(noveltyAtK(recommendations, k, noveltySupport, subjectCount));
  }
  return {
    [`precision@${k}`]: meanOverUsers(perSubject.precision),
    [`recall@${k}`]: meanOverUsers(perSubject.recall),
    [`hitRate@${k}`]: meanOverUsers(perSubject.hitRate),
    [`mrr@${k}`]: meanOverUsers(perSubject.mrr),
    [`map@${k}`]: meanOverUsers(perSubject.map),
    [`ndcg@${k}`]: meanOverUsers(perSubject.ndcg),
    coverage: catalogCoverage(lists, itemUniverse),
    novelty: meanOverUsers(perSubject.novelty),
    personalization: personalization(lists, k),
  };
}

function rankTopK(model, subjectKey, itemIds, excluded, k) {
  const ranked = [];
  for (const productId of itemIds) {
    if (excluded.has(productId)) continue;
    const entry = { productId, score: model.predict(subjectKey, productId) };
    let index = ranked.length;
    while (index > 0) {
      const previous = ranked[index - 1];
      if (previous.score > entry.score || (
        previous.score === entry.score && previous.productId < entry.productId
      )) break;
      index -= 1;
    }
    if (index < k) {
      ranked.splice(index, 0, entry);
      if (ranked.length > k) ranked.pop();
    }
  }
  return ranked.map((entry) => entry.productId);
}

export function evaluateHistoricalMatrixFactorization({
  datasetKey,
  stage,
  subjects,
  products,
  configuration,
  k = 10,
  minimumTrainingRatings = 3,
  seed = BIASED_MATRIX_FACTORIZATION_SEED,
  onResourceSample = () => {},
  assertWithinResourceGuard = () => {},
} = {}) {
  if (!datasetKey) throw new TypeError("Historical matrix-factorization evaluation requires a dataset key.");
  if (!Number.isInteger(k) || k < 1 || k > 100) throw new TypeError("k must be from 1 through 100.");
  const inputs = buildInputs({ datasetKey, stage, subjects, products, minimumTrainingRatings });
  const model = trainBiasedMatrixFactorization({
    observations: inputs.observations,
    configuration,
    seed,
    onResourceSample,
    assertWithinResourceGuard,
  });
  let unsupportedSubjects = 0;
  let unsupportedCandidateOccurrences = 0;
  const unsupportedCandidateItems = new Set();
  let unsupportedTargetOccurrences = 0;
  const unsupportedTargetItems = new Set();
  const recommendationsBySubject = new Map();
  for (let index = 0; index < inputs.cohort.length; index += 1) {
    const subject = inputs.cohort[index];
    if (!model.hasUser(subject.subjectKey)) unsupportedSubjects += 1;
    for (const target of subject.targets) {
      if (!model.hasItem(target)) {
        unsupportedTargetOccurrences += 1;
        unsupportedTargetItems.add(target);
      }
    }
    for (const productId of inputs.itemIds) {
      if (subject.excluded.has(productId)) continue;
      if (!model.hasItem(productId)) {
        unsupportedCandidateOccurrences += 1;
        unsupportedCandidateItems.add(productId);
      }
    }
    const ranked = rankTopK(model, subject.subjectKey, inputs.itemIds, subject.excluded, k);
    if (new Set(ranked).size !== ranked.length) {
      throw new Error("Historical matrix-factorization ranking produced duplicate recommendations.");
    }
    recommendationsBySubject.set(subject.subjectKey, ranked);
    if ((index + 1) % 100 === 0) {
      onResourceSample({ phase: "scoring", scoredSubjects: index + 1, configurationId: model.configurationId });
      assertWithinResourceGuard({ phase: "scoring", scoredSubjects: index + 1, configurationId: model.configurationId });
    }
  }
  onResourceSample({ phase: "scored", scoredSubjects: inputs.cohort.length, configurationId: model.configurationId });
  assertWithinResourceGuard({ phase: "scored", scoredSubjects: inputs.cohort.length, configurationId: model.configurationId });
  const metrics = fullPrecisionMetrics(
    inputs.cohort,
    recommendationsBySubject,
    inputs.itemUniverse,
    inputs.noveltySupport,
    inputs.fitSubjects.length,
    k,
  );
  for (const value of Object.values(metrics)) {
    if (!Number.isFinite(value)) throw new Error("Historical matrix-factorization metrics are non-finite.");
  }
  return {
    schemaVersion: 1,
    model: model.algorithmVersion,
    configuration: model.configuration,
    configurationId: model.configurationId,
    stage,
    k,
    fit: {
      subjects: model.userCount,
      items: model.itemCount,
      ratings: model.ratingCount,
      globalMean: model.globalMean,
      trainingRmse: model.trainingRmse,
    },
    cohort: {
      evaluatedSubjects: inputs.cohort.length,
      unsupportedSubjects,
    },
    coldEvidence: {
      unsupportedCandidateItems: unsupportedCandidateItems.size,
      unsupportedCandidateOccurrences,
      unsupportedTargetItems: unsupportedTargetItems.size,
      unsupportedTargetOccurrences,
      fallbackCount: 0,
      fallbackModel: null,
    },
    metrics,
  };
}

export function selectHistoricalMatrixFactorizationWinner(results) {
  if (!Array.isArray(results) || results.length === 0) {
    throw new TypeError("Matrix-factorization selection requires validation results.");
  }
  const ordered = [...results].sort((left, right) => (
    right.metrics["ndcg@10"] - left.metrics["ndcg@10"]
    || right.metrics["map@10"] - left.metrics["map@10"]
    || right.metrics["hitRate@10"] - left.metrics["hitRate@10"]
    || left.configuration.factors - right.configuration.factors
    || right.configuration.regularization - left.configuration.regularization
    || left.configuration.learningRate - right.configuration.learningRate
    || left.canonicalOrder - right.canonicalOrder
  ));
  return ordered[0];
}
