export const ITEM_COLLABORATIVE_VERSION = "item-cf-v1";

export const ITEM_COLLABORATIVE_ASSUMPTIONS = Object.freeze({
  positiveRatingThreshold: 4,
  minimumCoPositiveUsers: 2,
  shrinkage: 5,
});

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

export function buildItemCollaborativeAnchors(profile = {}) {
  const anchors = new Set();
  for (const rating of profile.ratings || []) {
    if (
      Number.isInteger(rating?.productPublicId)
      && rating.productPublicId > 0
      && Number.isFinite(rating.rating)
      && rating.rating >= ITEM_COLLABORATIVE_ASSUMPTIONS.positiveRatingThreshold
    ) anchors.add(rating.productPublicId);
  }
  for (const productPublicId of profile.wishlist || []) {
    if (Number.isInteger(productPublicId) && productPublicId > 0) anchors.add(productPublicId);
  }
  for (const item of profile.cart || []) {
    if (
      Number.isInteger(item?.productPublicId)
      && item.productPublicId > 0
      && Number.isFinite(item.quantity)
      && item.quantity > 0
    ) anchors.add(item.productPublicId);
  }
  return [...anchors].sort((a, b) => a - b);
}

function supportMap(supports = []) {
  if (!Array.isArray(supports)) throw new TypeError("Collaborative supports must be an array.");
  const map = new Map();
  for (const support of supports) {
    if (
      !Number.isInteger(support?.productPublicId)
      || support.productPublicId <= 0
      || !Number.isInteger(support.positiveUserCount)
      || support.positiveUserCount < 0
    ) throw new TypeError("Collaborative positive support must use positive product IDs and non-negative integer counts.");
    if (map.has(support.productPublicId)) throw new TypeError("Collaborative positive support must be unique per product.");
    map.set(support.productPublicId, support.positiveUserCount);
  }
  return map;
}

function pairMap(pairs = []) {
  if (!Array.isArray(pairs)) throw new TypeError("Collaborative pairs must be an array.");
  const map = new Map();
  for (const pair of pairs) {
    if (
      !Number.isInteger(pair?.sourceProductPublicId)
      || pair.sourceProductPublicId <= 0
      || !Number.isInteger(pair.candidateProductPublicId)
      || pair.candidateProductPublicId <= 0
      || pair.sourceProductPublicId === pair.candidateProductPublicId
      || !Number.isInteger(pair.coPositiveUsers)
      || pair.coPositiveUsers < 1
    ) throw new TypeError("Collaborative pairs must contain distinct positive product IDs and positive co-user counts.");
    const pairKey = `${pair.sourceProductPublicId}:${pair.candidateProductPublicId}`;
    if (map.has(pairKey)) throw new TypeError("Collaborative pair evidence must be unique.");
    map.set(pairKey, pair.coPositiveUsers);
  }
  return map;
}

function shrunkCosine(sourceId, candidateId, supports, pairs) {
  const coPositiveUsers = pairs.get(`${sourceId}:${candidateId}`) || 0;
  if (coPositiveUsers < ITEM_COLLABORATIVE_ASSUMPTIONS.minimumCoPositiveUsers) return 0;
  const sourceSupport = supports.get(sourceId) || 0;
  const candidateSupport = supports.get(candidateId) || 0;
  if (sourceSupport <= 0 || candidateSupport <= 0) return 0;
  const cosine = coPositiveUsers / Math.sqrt(sourceSupport * candidateSupport);
  const significance = coPositiveUsers / (coPositiveUsers + ITEM_COLLABORATIVE_ASSUMPTIONS.shrinkage);
  return Math.max(0, Math.min(1, cosine * significance));
}

export function scoreItemCollaborativeCandidates(candidates, profile = {}, evidence = {}) {
  assertCandidates(candidates);
  const anchors = buildItemCollaborativeAnchors(profile);
  const supports = supportMap(evidence.supports || []);
  const pairs = pairMap(evidence.pairs || []);
  const rawByProductId = new Map();
  const matchedAnchorsByProductId = new Map();
  let maxRawScore = 0;

  for (const candidate of candidates) {
    let rawScore = 0;
    let matchedAnchors = 0;
    for (const anchorId of anchors) {
      const similarity = shrunkCosine(anchorId, candidate.id, supports, pairs);
      if (similarity <= 0) continue;
      rawScore += similarity;
      matchedAnchors += 1;
    }
    const averaged = anchors.length > 0 ? rawScore / anchors.length : 0;
    rawByProductId.set(candidate.id, averaged);
    matchedAnchorsByProductId.set(candidate.id, matchedAnchors);
    maxRawScore = Math.max(maxRawScore, averaged);
  }

  const scoresByProductId = new Map();
  const reasonsByProductId = new Map();
  for (const candidate of candidates) {
    const rawScore = rawByProductId.get(candidate.id) || 0;
    const score = maxRawScore > 0 ? rawScore / maxRawScore : 0;
    const matchedAnchors = matchedAnchorsByProductId.get(candidate.id) || 0;
    const reasons = matchedAnchors > 1
      ? ["Listeners who liked several records you rated, saved, or added to your cart also liked this."]
      : matchedAnchors === 1
        ? ["Listeners who liked a record you rated, saved, or added to your cart also liked this."]
        : [];
    scoresByProductId.set(candidate.id, { score, reasons });
    reasonsByProductId.set(candidate.id, reasons);
  }

  return {
    available: anchors.length > 0 && maxRawScore > 0,
    anchors,
    scoresByProductId,
    reasonsByProductId,
  };
}

export function rankByItemCollaborative(
  candidates,
  scoreResultOrProfile = {},
  { evidence = {}, limit = candidates?.length || 0 } = {},
) {
  assertCandidates(candidates);
  if (!Number.isInteger(limit) || limit < 0) throw new TypeError("Limit must be a non-negative integer.");
  const scoreResult = scoreResultOrProfile?.scoresByProductId instanceof Map
    ? scoreResultOrProfile
    : scoreItemCollaborativeCandidates(candidates, scoreResultOrProfile, evidence);
  const scoredCandidates = candidates.map((product) => {
    const entry = scoreResult.scoresByProductId.get(product.id);
    if (!entry || !Number.isFinite(entry.score) || entry.score < 0 || entry.score > 1) {
      throw new TypeError("Item collaborative scores must contain one bounded score per candidate.");
    }
    return {
      product,
      score: entry.score,
      reasons: entry.reasons || [],
      algorithmVersion: ITEM_COLLABORATIVE_VERSION,
    };
  }).sort((a, b) => (
    b.score - a.score
    || a.product.id - b.product.id
    || String(a.product.title || "").localeCompare(String(b.product.title || ""))
  ));

  const artistCounts = new Map();
  const recommendations = [];
  for (const item of scoredCandidates) {
    if (item.score <= 0) continue;
    const artist = key(item.product.artist) || `unknown:${item.product.id}`;
    if ((artistCounts.get(artist) || 0) >= 2) continue;
    artistCounts.set(artist, (artistCounts.get(artist) || 0) + 1);
    recommendations.push({ ...item, rank: recommendations.length + 1 });
    if (recommendations.length >= limit) break;
  }
  return { ...scoreResult, scoredCandidates, recommendations };
}
