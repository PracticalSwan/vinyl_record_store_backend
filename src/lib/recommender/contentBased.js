import { getCatalogRepository } from "../db/dataSource.js";
import { getProductRecord } from "../../services/catalog.js";
import { historicalPopularityRepository } from "../../repositories/historicalPopularityRepository.js";
import { applyUserExclusions } from "./exclusions.js";
import {
  BEHAVIOR_RANKING_VERSION,
  buildBehaviorAffinity,
  rankByBehavior,
  scoreBehaviorCandidates,
} from "./behavioralProfile.js";
import {
  HYBRID_RANKING_VERSION,
  rankHybrid,
} from "./hybrid.js";
import {
  POPULARITY_RANKING_VERSION,
  getCandidateDatasetKey,
  rankByPopularity,
  scorePopularityCandidates,
} from "./popularity.js";
import {
  PREFERENCE_RANKING_VERSION,
  rankByPreferences,
  scorePreferenceCandidates,
} from "./preferenceRanking.js";

export const ALGORITHM_VERSION = process.env.RECOMMENDER_ALGORITHM_VERSION || "content-demo-v1";

const SCORE = {
  sameArtist: 6,
  sameGenre: 4,
  sameDecade: 2,
  sameLabel: 1,
  preferredGenre: 2,
};

const STOCK_BOOST = { in: 1, low: 0.5, out: 0 };

const DEMO_PROFILE = {
  purchasedIds: [1],
  wishlistIds: [2, 3, 4],
  favoriteGenres: ["Jazz", "Soul", "Electronic", "Folk"],
};

const era = (year) => Number.isInteger(year) ? Math.floor(year / 10) * 10 : null;

function compareProducts(source, candidate) {
  let score = 0;
  const reasons = [];

  if (source.artist && candidate.artist && source.artist === candidate.artist) {
    score += SCORE.sameArtist;
    reasons.push(`Same artist as ${source.title}.`);
  }
  if (source.genre && source.genre === candidate.genre) {
    score += SCORE.sameGenre;
    reasons.push(`Shares the ${source.genre} genre.`);
  }
  if (era(source.year) !== null && era(source.year) === era(candidate.year)) {
    score += SCORE.sameDecade;
    reasons.push(`Released in the same decade as ${source.title}.`);
  }
  if (source.label && candidate.label && source.label === candidate.label) {
    score += SCORE.sameLabel;
    reasons.push(`Released by ${source.label}.`);
  }
  score += STOCK_BOOST[candidate.stock] || 0;

  return { score, reasons };
}

function diversify(scored, limit) {
  const artistCounts = new Map();
  const selected = [];

  for (const item of scored) {
    const artistKey = item.product.artist || `unknown:${item.product.id}`;
    const count = artistCounts.get(artistKey) || 0;
    if (count >= 2) continue;
    selected.push(item);
    artistCounts.set(artistKey, count + 1);
    if (selected.length === limit) break;
  }

  return selected.map((item, index) => ({ ...item, rank: index + 1 }));
}

export function rankCatalogFromHistory(records, trainingProductIds, limit = 10) {
  const sources = records.filter((record) => trainingProductIds.has(record.id));
  const scored = records
    .filter((candidate) => !trainingProductIds.has(candidate.id) && candidate.stock !== "out")
    .map((candidate) => {
      let score = 0;
      for (const source of sources) score += compareProducts(source, candidate).score;
      return {
        product: candidate,
        score,
        reasons: [],
        algorithmVersion: ALGORITHM_VERSION,
      };
    })
    .sort((a, b) => b.score - a.score || a.product.id - b.product.id);
  return diversify(scored, limit).map((item) => item.product.id);
}

export async function recommendForProduct(
  sourceId,
  limit = 6,
  { repository = getCatalogRepository() } = {},
) {
  const source = await getProductRecord(sourceId, { repository });
  const candidates = await repository.listRecommendationCandidates();
  const scored = candidates
    .filter((candidate) => candidate.id !== source.id && candidate.stock !== "out")
    .map((candidate) => {
      const match = compareProducts(source, candidate);
      return {
        product: candidate,
        score: match.score,
        reasons: match.reasons.length ? match.reasons.slice(0, 2) : ["Listed in the current catalog."],
        algorithmVersion: ALGORITHM_VERSION,
      };
    })
    .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));

  return {
    sourceProductId: source.id,
    excludedProductIds: [source.id],
    mode: "content-similarity",
    recommendations: diversify(scored, limit),
    algorithmVersion: ALGORITHM_VERSION,
  };
}

function genericRecommendations(records, limit) {
  const scored = records
    .filter((record) => record.stock !== "out")
    .map((record) => ({
      product: record,
      score: STOCK_BOOST[record.stock] ?? 0,
      reasons: ["Listed in the current catalog."],
      algorithmVersion: ALGORITHM_VERSION,
    }))
    .sort((a, b) => (b.product.year || 0) - (a.product.year || 0) || a.product.title.localeCompare(b.product.title));

  return diversify(scored, limit);
}

export async function recommendForUser(
  subject,
  limit = 8,
  {
    repository = getCatalogRepository(),
    candidates: providedCandidates = null,
    profile = null,
    preferenceRankingEnabled = false,
    feedbackEnabled = false,
    behaviorRankingEnabled = false,
    popularityEnabled = false,
    hybridEnabled = false,
    popularityRepository = historicalPopularityRepository,
    trackingEnabled = true,
    now = new Date(),
  } = {},
) {
  if (
    !["anonymous", "cold-start", "demo", "registered"].includes(subject?.kind)
    || (subject.kind === "registered" && !subject.publicId)
  ) {
    throw new TypeError("A valid recommendation subject descriptor is required.");
  }
  const records = providedCandidates || await repository.listRecommendationCandidates();
  const feedbackResult = feedbackEnabled
    ? applyUserExclusions(records, profile?.explicitFeedback || [])
    : { candidates: records, excludedProductIds: [] };
  const eligibleRecords = feedbackResult.candidates;

  if (subject.kind === "demo") {
    const sourceIds = [...DEMO_PROFILE.purchasedIds, ...DEMO_PROFILE.wishlistIds];
    const sources = records.filter((record) => sourceIds.includes(record.id));
    if (sources.length !== sourceIds.length) {
      return {
        userId: subject.responseUserId || "demo-user",
        excludedProductIds: [],
        mode: "cold-start",
        profileSummary: [
          "The legacy showcase profile belongs to the reviewed 116-record catalog.",
          "Results use the active dataset catalog without remapping those source records.",
        ],
        recommendations: genericRecommendations(records, limit),
        algorithmVersion: ALGORITHM_VERSION,
      };
    }
    const excluded = new Set(sourceIds);
    const scored = records
      .filter((candidate) => !excluded.has(candidate.id) && candidate.stock !== "out")
      .map((candidate) => {
        let score = 0;
        const reasons = new Set();
        for (const source of sources) {
          const match = compareProducts(source, candidate);
          score += match.score;
          match.reasons.forEach((reason) => reasons.add(reason));
        }
        if (DEMO_PROFILE.favoriteGenres.includes(candidate.genre)) {
          score += SCORE.preferredGenre;
          reasons.add(`Matches this profile's ${candidate.genre} preference.`);
        }
        return {
          product: candidate,
          score,
          reasons: [...reasons].slice(0, 2),
          algorithmVersion: ALGORITHM_VERSION,
        };
      })
      .sort((a, b) => b.score - a.score || a.product.title.localeCompare(b.product.title));

    return {
      userId: subject.responseUserId || "demo-user",
      excludedProductIds: sourceIds,
      mode: "demo-profile",
      profileSummary: [
        "Purchased: Kind of Blue",
        "Wishlist: Innervisions, Blue, and Homework",
        "Preferred genres: Jazz, Soul, Electronic, and Folk",
      ],
      recommendations: diversify(scored, limit),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  const candidates = eligibleRecords.filter((candidate) => candidate.stock !== "out");
  const components = {
    preference: { available: false },
    behavior: { available: false },
    popularity: { available: false },
  };

  if (subject.kind === "registered" && preferenceRankingEnabled && profile) {
    const catalogMode = candidates[0]?.catalogMode || eligibleRecords[0]?.catalogMode || "commerce-preview";
    const scoreResult = scorePreferenceCandidates(
      candidates,
      profile.explicitPreferences,
      { catalogMode },
    );
    if (scoreResult.available) components.preference = scoreResult;
  }

  if (subject.kind === "registered" && behaviorRankingEnabled && profile) {
    const affinity = buildBehaviorAffinity(profile, records, {
      now,
      trackingEnabled,
      feedbackEnabled,
    });
    const scoreResult = scoreBehaviorCandidates(candidates, affinity);
    if (scoreResult.available) components.behavior = scoreResult;
  }

  const shouldLoadPopularity = popularityEnabled
    && candidates.length > 0
    && (
      (!components.preference.available && !components.behavior.available)
      || (hybridEnabled && components.preference.available && components.behavior.available)
    );
  if (shouldLoadPopularity) {
    const datasetKey = getCandidateDatasetKey(candidates);
    if (datasetKey) {
      const aggregates = await popularityRepository.listByDatasetKey(datasetKey);
      const scoreResult = scorePopularityCandidates(candidates, aggregates);
      if (scoreResult.available) components.popularity = scoreResult;
    }
  }

  const baseResponse = {
    ...(subject.responseUserId ? { userId: subject.responseUserId } : {}),
    excludedProductIds: feedbackResult.excludedProductIds,
  };
  const pureProfileSummary = {
    "preference-profile": [
      "Results use the preferences saved for this account.",
      ...(feedbackEnabled ? ["Negative feedback removes only the exact products you marked."] : []),
    ],
    "behavior-profile": [
      "Results use the account signals enabled for this profile, including saved ratings, wishlist, and cart state.",
      ...(feedbackEnabled ? ["Negative feedback removes only the exact products you marked."] : []),
    ],
    popularity: [
      "Results use aggregate ratings from the active research dataset.",
    ],
    "personalized-hybrid": [
      "Results combine saved preferences with behavioral evidence.",
      ...(components.popularity.available ? ["Aggregate research ratings provide a bounded third signal."] : []),
      ...(feedbackEnabled ? ["Negative feedback removes only the exact products you marked."] : []),
    ],
  };

  if (
    subject.kind === "registered"
    && hybridEnabled
    && components.preference.available
    && components.behavior.available
  ) {
    const ranked = rankHybrid(candidates, {
      preference: components.preference,
      behavior: components.behavior,
      popularity: popularityEnabled ? components.popularity : { available: false },
    }, { limit });
    return {
      ...baseResponse,
      mode: "personalized-hybrid",
      profileSummary: pureProfileSummary["personalized-hybrid"],
      recommendations: ranked.recommendations,
      algorithmVersion: HYBRID_RANKING_VERSION,
    };
  }

  if (subject.kind === "registered" && components.preference.available) {
    const ranked = rankByPreferences(candidates, components.preference, { limit });
    return {
      ...baseResponse,
      mode: "preference-profile",
      profileSummary: pureProfileSummary["preference-profile"],
      recommendations: ranked.recommendations,
      algorithmVersion: PREFERENCE_RANKING_VERSION,
    };
  }

  if (subject.kind === "registered" && components.behavior.available) {
    const ranked = rankByBehavior(candidates, components.behavior, { limit });
    return {
      ...baseResponse,
      mode: "behavior-profile",
      profileSummary: pureProfileSummary["behavior-profile"],
      recommendations: ranked.recommendations,
      algorithmVersion: BEHAVIOR_RANKING_VERSION,
    };
  }

  if (components.popularity.available) {
    const ranked = rankByPopularity(candidates, components.popularity, { limit });
    return {
      ...baseResponse,
      mode: "popularity",
      profileSummary: pureProfileSummary.popularity,
      recommendations: ranked.recommendations,
      algorithmVersion: POPULARITY_RANKING_VERSION,
    };
  }

  if (["anonymous", "cold-start"].includes(subject.kind)) {
    const profileSummary = subject.kind === "anonymous"
      ? [
          "No signed-in customer session is available.",
          "Results use the current eligible catalog.",
        ]
      : [
          "No stored history is available.",
          "Results use the current eligible catalog.",
        ];
    return {
      ...baseResponse,
      mode: subject.kind === "anonymous" ? "anonymous-fallback" : "cold-start",
      profileSummary,
      recommendations: genericRecommendations(eligibleRecords, limit),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  const recordsForFallback = eligibleRecords;
  if (subject.kind === "registered") {
    return {
      ...baseResponse,
      mode: "cold-start",
      profileSummary: [
        "No enabled personalized ranking signal is applicable for this profile.",
        "Results use the current eligible catalog fallback.",
      ],
      recommendations: genericRecommendations(recordsForFallback, limit),
      algorithmVersion: ALGORITHM_VERSION,
    };
  }

  throw new TypeError("Unsupported recommendation subject descriptor.");
}
