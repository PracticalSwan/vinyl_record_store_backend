import {
  PREFERENCE_RANKING_VERSION,
  rankByPreferences,
} from "./preferenceRanking.js";
import {
  BEHAVIOR_RANKING_VERSION,
  rankByBehavior,
} from "./behavioralProfile.js";
import {
  POPULARITY_RANKING_VERSION,
  rankByPopularity,
} from "./popularity.js";

export const HYBRID_RANKING_VERSION = "personalized-hybrid-v1";

export const HYBRID_COMPONENT_WEIGHTS = Object.freeze({
  preference: 0.45,
  behavior: 0.35,
  popularity: 0.20,
});

const COMPONENT_ORDER = Object.freeze(["preference", "behavior", "popularity"]);
const clamp = (value) => Math.max(0, Math.min(1, value));
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

function componentEntry(component, candidateId, componentName) {
  const entry = component.scoresByProductId.get(candidateId);
  if (
    !entry
    || !Number.isFinite(entry.score)
    || entry.score < 0
    || entry.score > 1
    || !Array.isArray(entry.reasons)
    || entry.reasons.some((reason) => typeof reason !== "string")
  ) {
    throw new TypeError(
      `Available ${componentName} scores must contain one bounded score and reasons array per candidate.`,
    );
  }
  return entry;
}

function validateAvailableComponents(candidates, components) {
  for (const componentName of COMPONENT_ORDER) {
    const component = components[componentName];
    if (!component?.available) continue;
    if (!(component.scoresByProductId instanceof Map)) {
      throw new TypeError(`Available ${componentName} scores must use a Map keyed by product ID.`);
    }
    for (const candidate of candidates) componentEntry(component, candidate.id, componentName);
  }
}

function selectedMode(components) {
  const preferenceAvailable = Boolean(components.preference?.available);
  const behaviorAvailable = Boolean(components.behavior?.available);
  const popularityAvailable = Boolean(components.popularity?.available);
  if (preferenceAvailable && behaviorAvailable) {
    return {
      mode: "personalized-hybrid",
      algorithmVersion: HYBRID_RANKING_VERSION,
      selectedComponent: "hybrid",
      componentNames: popularityAvailable
        ? ["preference", "behavior", "popularity"]
        : ["preference", "behavior"],
    };
  }
  if (preferenceAvailable) {
    return {
      mode: "preference-profile",
      algorithmVersion: PREFERENCE_RANKING_VERSION,
      selectedComponent: "preference",
      componentNames: ["preference"],
    };
  }
  if (behaviorAvailable) {
    return {
      mode: "behavior-profile",
      algorithmVersion: BEHAVIOR_RANKING_VERSION,
      selectedComponent: "behavior",
      componentNames: ["behavior"],
    };
  }
  if (popularityAvailable) {
    return {
      mode: "popularity",
      algorithmVersion: POPULARITY_RANKING_VERSION,
      selectedComponent: "popularity",
      componentNames: ["popularity"],
    };
  }
  return {
    mode: null,
    algorithmVersion: null,
    selectedComponent: null,
    componentNames: [],
  };
}

function normalizedWeights(componentNames) {
  const denominator = componentNames.reduce(
    (total, componentName) => total + HYBRID_COMPONENT_WEIGHTS[componentName],
    0,
  );
  return new Map(componentNames.map((componentName) => [
    componentName,
    HYBRID_COMPONENT_WEIGHTS[componentName] / denominator,
  ]));
}

function hybridReasons(candidateId, componentNames, weights, components) {
  const contributions = componentNames.map((componentName, order) => {
    const entry = componentEntry(components[componentName], candidateId, componentName);
    return {
      order,
      contribution: weights.get(componentName) * entry.score,
      reasons: entry.reasons,
    };
  }).filter((item) => item.contribution > 0 && item.reasons.length > 0)
    .sort((a, b) => b.contribution - a.contribution || a.order - b.order);
  const reasons = [];
  for (const contribution of contributions) {
    for (const reason of contribution.reasons) {
      if (!reason || reasons.includes(reason)) continue;
      reasons.push(reason);
      if (reasons.length === 2) return reasons;
    }
  }
  return reasons;
}

function copyComponentScores(candidates, component, componentName) {
  return new Map(candidates.map((candidate) => {
    const entry = componentEntry(component, candidate.id, componentName);
    return [candidate.id, { score: entry.score, reasons: [...entry.reasons] }];
  }));
}

export function combineRecommendationScores(
  candidates,
  { preference = {}, behavior = {}, popularity = {} } = {},
) {
  assertCandidates(candidates);
  const components = { preference, behavior, popularity };
  validateAvailableComponents(candidates, components);
  const selection = selectedMode(components);
  if (!selection.selectedComponent) {
    return {
      available: false,
      ...selection,
      scoresByProductId: new Map(),
    };
  }
  if (selection.selectedComponent !== "hybrid") {
    return {
      available: true,
      ...selection,
      scoresByProductId: copyComponentScores(
        candidates,
        components[selection.selectedComponent],
        selection.selectedComponent,
      ),
    };
  }

  const weights = normalizedWeights(selection.componentNames);
  const scoresByProductId = new Map();
  for (const candidate of candidates) {
    let score = 0;
    for (const componentName of selection.componentNames) {
      const entry = componentEntry(components[componentName], candidate.id, componentName);
      score += weights.get(componentName) * entry.score;
    }
    scoresByProductId.set(candidate.id, {
      score: clamp(score),
      reasons: hybridReasons(candidate.id, selection.componentNames, weights, components),
    });
  }
  return {
    available: true,
    ...selection,
    scoresByProductId,
  };
}

function rankTrueHybrid(candidates, combination, limit) {
  const scoredCandidates = candidates.map((product) => {
    const entry = combination.scoresByProductId.get(product.id);
    return {
      product,
      score: entry.score,
      reasons: entry.reasons,
      algorithmVersion: HYBRID_RANKING_VERSION,
    };
  }).sort((a, b) => (
    b.score - a.score
    || a.product.id - b.product.id
    || String(a.product.title || "").localeCompare(String(b.product.title || ""))
  ));
  const artistCounts = new Map();
  const recommendations = [];
  for (const item of scoredCandidates) {
    const artist = key(item.product.artist) || `unknown:${item.product.id}`;
    if ((artistCounts.get(artist) || 0) >= 2) continue;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    recommendations.push({ ...item, rank: recommendations.length + 1 });
    if (recommendations.length >= limit) break;
  }
  return { scoredCandidates, recommendations };
}

export function rankHybrid(
  candidates,
  { preference = {}, behavior = {}, popularity = {} } = {},
  { limit = candidates?.length || 0 } = {},
) {
  assertCandidates(candidates);
  if (!Number.isInteger(limit) || limit < 0) throw new TypeError("Limit must be a non-negative integer.");
  const components = { preference, behavior, popularity };
  const combination = combineRecommendationScores(candidates, components);
  if (!combination.available) {
    return { ...combination, scoredCandidates: [], recommendations: [] };
  }
  if (combination.selectedComponent === "preference") {
    const ranked = rankByPreferences(candidates, preference, { limit });
    return { ...combination, scoredCandidates: ranked.scoredCandidates, recommendations: ranked.recommendations };
  }
  if (combination.selectedComponent === "behavior") {
    const ranked = rankByBehavior(candidates, behavior, { limit });
    return { ...combination, scoredCandidates: ranked.scoredCandidates, recommendations: ranked.recommendations };
  }
  if (combination.selectedComponent === "popularity") {
    const ranked = rankByPopularity(candidates, popularity, { limit });
    return { ...combination, scoredCandidates: ranked.scoredCandidates, recommendations: ranked.recommendations };
  }
  return { ...combination, ...rankTrueHybrid(candidates, combination, limit) };
}
