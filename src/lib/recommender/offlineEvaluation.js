import { createHash } from "node:crypto";
import { ALGORITHM_VERSION, rankCatalogFromHistory } from "./contentBased.js";
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
import { assertLeakageSafe } from "./evaluationDataset.js";

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

function trainingPopularity(subjects) {
  const popularity = new Map();
  for (const subject of subjects) {
    for (const productId of subject.trainingProductIds) {
      popularity.set(productId, (popularity.get(productId) || 0) + 1);
    }
  }
  return popularity;
}

function candidatesFor(subject, itemIds) {
  return itemIds.filter((productId) => !subject.candidateExclusions.has(productId));
}

function validateRecommendations(subject, recommendations, candidateSet, k) {
  if (new Set(recommendations).size !== recommendations.length) {
    throw new Error(`Duplicate recommendations for subject ${subject.subjectId}.`);
  }
  if (recommendations.length > k) throw new Error("A recommendation list exceeded k.");
  for (const productId of recommendations) {
    if (!candidateSet.has(productId)) {
      throw new Error(`Recommendation ${productId} was outside the shared candidate set.`);
    }
  }
}

function aggregateMetrics(subjects, recommendationsBySubject, itemUniverse, popularity, k) {
  const perUser = {
    precision: [],
    recall: [],
    hitRate: [],
    mrr: [],
    map: [],
    ndcg: [],
    novelty: [],
  };
  const lists = [];
  for (const subject of subjects) {
    const recommended = recommendationsBySubject.get(subject.subjectId) || [];
    lists.push(recommended);
    perUser.precision.push(precisionAtK(subject.testRelevant, recommended, k));
    perUser.recall.push(recallAtK(subject.testRelevant, recommended, k));
    perUser.hitRate.push(hitRateAtK(subject.testRelevant, recommended, k));
    perUser.mrr.push(reciprocalRankAtK(subject.testRelevant, recommended, k));
    perUser.map.push(averagePrecisionAtK(subject.testRelevant, recommended, k));
    perUser.ndcg.push(ndcgAtK(subject.testRelevant, recommended, k));
    perUser.novelty.push(noveltyAtK(recommended, k, popularity, subjects.length));
  }
  return {
    [`precision@${k}`]: round(meanOverUsers(perUser.precision)),
    [`recall@${k}`]: round(meanOverUsers(perUser.recall)),
    [`hitRate@${k}`]: round(meanOverUsers(perUser.hitRate)),
    [`mrr@${k}`]: round(meanOverUsers(perUser.mrr)),
    [`map@${k}`]: round(meanOverUsers(perUser.map)),
    [`ndcg@${k}`]: round(meanOverUsers(perUser.ndcg)),
    coverage: round(catalogCoverage(lists, itemUniverse)),
    novelty: round(meanOverUsers(perUser.novelty)),
    personalization: round(personalization(lists, k)),
  };
}

function interpretation(model, metrics, k) {
  return `${model} achieved NDCG@${k} ${metrics[`ndcg@${k}`].toFixed(3)}, MAP@${k} ${metrics[`map@${k}`].toFixed(3)}, and catalog coverage ${metrics.coverage.toFixed(3)} under the shared temporal split.`;
}

export function evaluateOffline(dataset, products, { k = 10, randomSeed = "groovehaus-eval-v1" } = {}) {
  if (dataset.status !== "eligible") throw new Error("The dataset does not meet the minimum evidence boundary.");
  if (!Number.isInteger(k) || k < 1 || k > 100) throw new TypeError("k must be an integer from 1 through 100.");
  assertLeakageSafe(dataset.subjects);
  const itemIds = products.map((product) => product.id).sort((left, right) => left - right);
  const itemUniverse = new Set(itemIds);
  const popularity = trainingPopularity(dataset.subjects);
  const recommenders = [
    {
      name: "random",
      algorithmVersion: `random:${randomSeed}`,
      rank: (subject, candidates) => shuffle(candidates, `${randomSeed}:${subject.subjectId}`).slice(0, k),
    },
    {
      name: "popularity",
      algorithmVersion: "popularity-v1",
      rank: (_subject, candidates) => [...candidates]
        .sort((left, right) => (popularity.get(right) || 0) - (popularity.get(left) || 0) || left - right)
        .slice(0, k),
    },
    {
      name: "content-based",
      algorithmVersion: ALGORITHM_VERSION,
      rank: (subject) => rankCatalogFromHistory(products, subject.trainingProductIds, k),
    },
  ];

  const models = recommenders.map((recommender) => {
    const recommendations = new Map();
    for (const subject of dataset.subjects) {
      const candidates = candidatesFor(subject, itemIds);
      const ranked = recommender.rank(subject, candidates);
      validateRecommendations(subject, ranked, new Set(candidates), k);
      recommendations.set(subject.subjectId, ranked);
    }
    const metrics = aggregateMetrics(
      dataset.subjects,
      recommendations,
      itemUniverse,
      popularity,
      k,
    );
    return {
      model: recommender.name,
      algorithmVersion: recommender.algorithmVersion,
      metrics,
      interpretation: interpretation(recommender.name, metrics, k),
    };
  });

  if (ndcgAtK(new Set([1, 2, 3]), [1, 2, 3], 3) !== 1) {
    throw new Error("Ideal-order NDCG sanity check failed.");
  }
  return {
    status: "evaluated",
    k,
    usersEvaluated: dataset.subjects.length,
    candidatePolicy: "full active in-stock catalog excluding training positives",
    split: "per-subject temporal leave-last-positive-out",
    relevance: "final rating >= 4, wishlist add, or cart add per unique product",
    randomSeed,
    idealNdcg: 1,
    models,
  };
}
