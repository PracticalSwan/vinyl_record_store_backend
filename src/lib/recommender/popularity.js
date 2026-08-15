export const POPULARITY_RANKING_VERSION = "popularity-v1";

const key = (value) => String(value ?? "").trim().toLowerCase();

function assertCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError("Candidates must be an array.");
  const ids = new Set();
  for (const candidate of candidates) {
    if (!candidate || !Number.isInteger(candidate.id) || candidate.id <= 0 || ids.has(candidate.id)) {
      throw new TypeError("Candidates must contain unique positive numeric product IDs.");
    }
    ids.add(candidate.id);
  }
}

function normalizedDatasetKey(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getCandidateDatasetKey(candidates) {
  assertCandidates(candidates);
  if (candidates.length === 0) return null;
  const datasetKey = normalizedDatasetKey(candidates[0].datasetKey);
  for (const candidate of candidates.slice(1)) {
    if (normalizedDatasetKey(candidate.datasetKey) !== datasetKey) {
      throw new TypeError("Recommendation candidates must share one dataset key.");
    }
  }
  return datasetKey;
}

function aggregateMap(candidates, aggregates, datasetKey) {
  if (!Array.isArray(aggregates)) throw new TypeError("Popularity aggregates must be an array.");
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const byProductId = new Map();
  if (!datasetKey) return byProductId;
  for (const aggregate of aggregates) {
    if (aggregate?.datasetKey != null && normalizedDatasetKey(aggregate.datasetKey) !== datasetKey) continue;
    if (!Number.isInteger(aggregate?.productPublicId) || !candidateIds.has(aggregate.productPublicId)) continue;
    if (byProductId.has(aggregate.productPublicId)) {
      throw new TypeError("Popularity aggregates must contain at most one row per candidate.");
    }
    if (!Number.isInteger(aggregate.ratingCount) || aggregate.ratingCount < 0) {
      throw new TypeError("Popularity rating counts must be non-negative integers.");
    }
    if (
      aggregate.meanRating != null
      && (!Number.isFinite(aggregate.meanRating) || aggregate.meanRating < 1 || aggregate.meanRating > 5)
    ) {
      throw new TypeError("Popularity mean ratings must be null or between 1 and 5.");
    }
    byProductId.set(aggregate.productPublicId, {
      ratingCount: aggregate.ratingCount,
      meanRating: aggregate.ratingCount > 0 && aggregate.meanRating != null
        ? aggregate.meanRating
        : null,
    });
  }
  return byProductId;
}

export function scorePopularityCandidates(candidates, aggregates = []) {
  assertCandidates(candidates);
  const datasetKey = getCandidateDatasetKey(candidates);
  const aggregatesByProductId = aggregateMap(candidates, aggregates, datasetKey);
  const maxRatingCount = Math.max(
    0,
    ...candidates.map((candidate) => aggregatesByProductId.get(candidate.id)?.ratingCount || 0),
  );
  const scoresByProductId = new Map();
  const reasonsByProductId = new Map();
  const rankMetadataByProductId = new Map();
  for (const candidate of candidates) {
    const aggregate = aggregatesByProductId.get(candidate.id) || { ratingCount: 0, meanRating: null };
    const reasons = aggregate.ratingCount > 0
      ? ["Popular with listeners."]
      : [];
    scoresByProductId.set(candidate.id, {
      score: maxRatingCount > 0 ? aggregate.ratingCount / maxRatingCount : 0,
      reasons,
    });
    reasonsByProductId.set(candidate.id, reasons);
    rankMetadataByProductId.set(candidate.id, aggregate);
  }
  return {
    available: Boolean(datasetKey) && maxRatingCount > 0,
    scoresByProductId,
    reasonsByProductId,
    rankMetadataByProductId,
    datasetKey,
    maxRatingCount,
  };
}

function meanRatingForSort(value) {
  return Number.isFinite(value) ? value : Number.NEGATIVE_INFINITY;
}

export function rankByPopularity(
  candidates,
  scoreResultOrAggregates = [],
  { limit = candidates?.length || 0 } = {},
) {
  assertCandidates(candidates);
  const scoreResult = scoreResultOrAggregates?.scoresByProductId instanceof Map
    ? scoreResultOrAggregates
    : scorePopularityCandidates(candidates, scoreResultOrAggregates);
  const rankMetadata = scoreResult.rankMetadataByProductId || new Map();
  const scoredWithRankMetadata = candidates.map((product) => {
    const entry = scoreResult.scoresByProductId.get(product.id);
    if (!entry || !Number.isFinite(entry.score)) {
      throw new TypeError("Popularity scores must contain every candidate.");
    }
    const metadata = rankMetadata.get(product.id) || { ratingCount: 0, meanRating: null };
    return {
      product,
      score: entry.score,
      reasons: entry.reasons || [],
      algorithmVersion: POPULARITY_RANKING_VERSION,
      ratingCount: metadata.ratingCount,
      meanRating: metadata.meanRating,
    };
  }).sort((a, b) => (
    b.ratingCount - a.ratingCount
    || meanRatingForSort(b.meanRating) - meanRatingForSort(a.meanRating)
    || a.product.id - b.product.id
    || String(a.product.title || "").localeCompare(String(b.product.title || ""))
  ));
  const artistCounts = new Map();
  const recommendations = [];
  for (const item of scoredWithRankMetadata) {
    const artist = key(item.product.artist) || `unknown:${item.product.id}`;
    if ((artistCounts.get(artist) || 0) >= 2) continue;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    const { ratingCount: _ratingCount, meanRating: _meanRating, ...recommendation } = item;
    recommendations.push({ ...recommendation, rank: recommendations.length + 1 });
    if (recommendations.length >= limit) break;
  }
  const scoredCandidates = scoredWithRankMetadata.map((item) => {
    const { ratingCount: _ratingCount, meanRating: _meanRating, ...scored } = item;
    return scored;
  });
  return { ...scoreResult, scoredCandidates, recommendations };
}
