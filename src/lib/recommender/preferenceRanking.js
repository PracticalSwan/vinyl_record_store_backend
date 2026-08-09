export const PREFERENCE_RANKING_VERSION = "preference-profile-v1";

export const PREFERENCE_GROUP_WEIGHTS = Object.freeze({
  favoriteGenre: 1,
  dislikedGenre: 1,
  favoriteArtist: 1,
  format: 1,
  budget: 1,
  condition: 1,
});

const key = (value) => String(value ?? "").trim().toLowerCase();
const values = (list) => (Array.isArray(list) ? list.map(key).filter(Boolean) : []);

function compilePreferences(preferences = {}, catalogMode = "commerce-preview") {
  const favoriteGenres = values(preferences.favoriteGenres);
  const dislikedGenres = values(preferences.dislikedGenres);
  const disliked = new Set(dislikedGenres);
  const favorite = new Set(favoriteGenres);
  for (const genre of [...favorite]) {
    if (disliked.has(genre)) {
      favorite.delete(genre);
      disliked.delete(genre);
    }
  }
  const favoriteArtists = values(preferences.favoriteArtists);
  const formats = values(preferences.formats);
  const conditions = values(preferences.conditions);
  const budget = preferences.budget || {};
  const budgetActive = catalogMode !== "research-only"
    && (Number.isFinite(budget.min) || Number.isFinite(budget.max));
  const conditionActive = catalogMode !== "research-only" && conditions.length > 0;
  const groups = [
    ["favoriteGenre", favorite.size > 0],
    ["dislikedGenre", disliked.size > 0],
    ["favoriteArtist", favoriteArtists.length > 0],
    ["format", formats.length > 0],
    ["budget", budgetActive],
    ["condition", conditionActive],
  ];
  const activeGroups = new Set(groups.filter(([, active]) => active).map(([name]) => name));
  const denominator = [...activeGroups]
    .reduce((total, name) => total + Math.abs(PREFERENCE_GROUP_WEIGHTS[name]), 0);
  return {
    favoriteGenres: favorite,
    dislikedGenres: disliked,
    favoriteArtists: new Set(favoriteArtists),
    formats: new Set(formats),
    conditions: new Set(conditions),
    budget: { min: Number.isFinite(budget.min) ? budget.min : null, max: Number.isFinite(budget.max) ? budget.max : null },
    activeGroups,
    denominator,
  };
}

function candidateContribution(candidate, compiled) {
  let contribution = 0;
  const reasons = [];
  if (compiled.activeGroups.has("favoriteGenre") && compiled.favoriteGenres.has(key(candidate.genre))) {
    contribution += PREFERENCE_GROUP_WEIGHTS.favoriteGenre;
    reasons.push(`Matches your ${candidate.genre} preference.`);
  }
  if (compiled.activeGroups.has("dislikedGenre") && compiled.dislikedGenres.has(key(candidate.genre))) {
    contribution -= PREFERENCE_GROUP_WEIGHTS.dislikedGenre;
  }
  if (compiled.activeGroups.has("favoriteArtist") && compiled.favoriteArtists.has(key(candidate.artist))) {
    contribution += PREFERENCE_GROUP_WEIGHTS.favoriteArtist;
    reasons.push("Matches an artist you selected.");
  }
  if (compiled.activeGroups.has("format") && compiled.formats.has(key(candidate.format))) {
    contribution += PREFERENCE_GROUP_WEIGHTS.format;
    reasons.push("You prefer this format.");
  }
  if (compiled.activeGroups.has("budget") && Number.isFinite(candidate.price)) {
    const inRange = (compiled.budget.min === null || candidate.price >= compiled.budget.min)
      && (compiled.budget.max === null || candidate.price <= compiled.budget.max);
    if (inRange) {
      contribution += PREFERENCE_GROUP_WEIGHTS.budget;
      reasons.push("Fits your budget.");
    }
  }
  if (compiled.activeGroups.has("condition") && compiled.conditions.has(key(candidate.condition))) {
    contribution += PREFERENCE_GROUP_WEIGHTS.condition;
    reasons.push("Matches your selected condition.");
  }
  return { contribution, reasons };
}

function assertCandidates(candidates) {
  if (!Array.isArray(candidates)) throw new TypeError("Candidates must be an array.");
  const ids = new Set();
  for (const candidate of candidates) {
    if (!candidate || !Number.isInteger(candidate.id) || ids.has(candidate.id)) {
      throw new TypeError("Candidates must contain unique numeric product IDs.");
    }
    ids.add(candidate.id);
  }
}

export function scorePreferenceCandidate(candidate, preferences = {}, options = {}) {
  const catalogMode = typeof options === "string"
    ? options
    : options?.catalogMode || "commerce-preview";
  assertCandidates([candidate]);
  const compiled = compilePreferences(preferences, catalogMode);
  const { contribution, reasons } = candidateContribution(candidate, compiled);
  const score = compiled.denominator === 0
    ? 0.5
    : Math.max(0, Math.min(1, (contribution / compiled.denominator + 1) / 2));
  return {
    product: candidate,
    score,
    reasons: reasons.slice(0, 3),
    contribution,
    available: compiled.denominator > 0 && contribution !== 0,
  };
}

export function scorePreferenceCandidates(
  candidates,
  preferences = {},
  { catalogMode = candidates?.[0]?.catalogMode || "commerce-preview" } = {},
) {
  assertCandidates(candidates);
  const compiled = compilePreferences(preferences, catalogMode);
  const scoresByProductId = new Map();
  const reasonsByProductId = new Map();
  let hasSignedContribution = false;
  for (const candidate of candidates) {
    const { contribution, reasons } = candidateContribution(candidate, compiled);
    if (contribution !== 0) hasSignedContribution = true;
    const score = compiled.denominator === 0
      ? 0.5
      : Math.max(0, Math.min(1, (contribution / compiled.denominator + 1) / 2));
    const entry = { score, reasons: reasons.slice(0, 3) };
    scoresByProductId.set(candidate.id, entry);
    reasonsByProductId.set(candidate.id, entry.reasons);
  }
  return {
    available: compiled.denominator > 0 && hasSignedContribution,
    scoresByProductId,
    reasonsByProductId,
    catalogMode,
    denominator: compiled.denominator,
  };
}

export function rankByPreferences(
  candidates,
  scoreResultOrPreferences = {},
  { limit = candidates?.length || 0, catalogMode = candidates?.[0]?.catalogMode || "commerce-preview" } = {},
) {
  const scoreResult = scoreResultOrPreferences?.scoresByProductId instanceof Map
    ? scoreResultOrPreferences
    : scorePreferenceCandidates(candidates, scoreResultOrPreferences, { catalogMode });
  const reasons = scoreResult.reasonsByProductId || new Map();
  const scored = candidates.map((product) => {
    const entry = scoreResult.scoresByProductId.get(product.id);
    return {
      product,
      score: typeof entry === "number" ? entry : entry?.score ?? 0.5,
      reasons: reasons.get(product.id) || entry?.reasons || [],
      algorithmVersion: PREFERENCE_RANKING_VERSION,
    };
  }).sort((a, b) => (
    b.score - a.score
    || a.product.id - b.product.id
    || String(a.product.title || "").localeCompare(String(b.product.title || ""))
  ));
  const artistCounts = new Map();
  const recommendations = [];
  for (const item of scored) {
    const artist = key(item.product.artist) || `unknown:${item.product.id}`;
    if ((artistCounts.get(artist) || 0) >= 2) continue;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    recommendations.push({ ...item, rank: recommendations.length + 1 });
    if (recommendations.length >= limit) break;
  }
  return { ...scoreResult, scoredCandidates: scored, recommendations };
}
