export const BEHAVIOR_RANKING_VERSION = "behavior-profile-v1";

export const BEHAVIOR_AFFINITY_ASSUMPTIONS = Object.freeze({
  version: BEHAVIOR_RANKING_VERSION,
  sourceWeights: Object.freeze({
    rating5: 4,
    rating4: 3,
    ratingLow: -4,
    wishlist: 3,
    cartBase: 3,
    cartExtraUnit: 0.5,
    alreadyOwn: 3,
    notInterested: -2,
    recommendationClick: 1,
    productView: 0.5,
    searchResultClick: 0.75,
  }),
  caps: Object.freeze({
    cartQuantity: 3,
    passiveEventsPerProduct: 3,
    passiveAttributeAbsoluteEvidence: 3,
    attributeAbsoluteEvidence: 12,
  }),
  passiveRecency: Object.freeze({
    recentMaxDays: 7,
    mediumMaxDays: 30,
    oldestMaxDays: 90,
    recentMultiplier: 1,
    mediumMultiplier: 0.5,
    oldestMultiplier: 0.25,
  }),
});

const ATTRIBUTE_NAMES = Object.freeze(["artist", "genre", "format"]);
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const key = (value) => String(value ?? "").trim().toLowerCase();
const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));

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

function dateValue(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function signalProductId(value) {
  return Number.isInteger(value) && value > 0 ? value : null;
}

function createAttributeMaps() {
  return Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, new Map()]));
}

function createReasonMaps() {
  return Object.fromEntries(ATTRIBUTE_NAMES.map((name) => [name, new Map()]));
}

function reasonFor(source, attribute) {
  if (source === "rating") return `Matches ${attribute}s you rated highly.`;
  if (source === "wishlist") return "Similar to records you saved.";
  if (source === "cart") return "Similar to records in your cart.";
  if (source === "already-own") return "Similar to records you already own.";
  if (source === "passive") return "Similar to records you viewed or clicked.";
  return null;
}

function addProductEvidence(rawEvidence, rawReasons, product, amount, source) {
  if (!product || !Number.isFinite(amount) || amount === 0) return;
  for (const attribute of ATTRIBUTE_NAMES) {
    const attributeKey = key(product[attribute]);
    if (!attributeKey) continue;
    rawEvidence[attribute].set(
      attributeKey,
      (rawEvidence[attribute].get(attributeKey) || 0) + amount,
    );
    const reason = amount > 0 ? reasonFor(source, attribute) : null;
    if (!reason) continue;
    if (!rawReasons[attribute].has(attributeKey)) {
      rawReasons[attribute].set(attributeKey, new Map());
    }
    const reasons = rawReasons[attribute].get(attributeKey);
    reasons.set(reason, (reasons.get(reason) || 0) + amount);
  }
}

function ratingWeight(rating) {
  if (rating === 5) return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.rating5;
  if (rating === 4) return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.rating4;
  if (rating === 3) return 0;
  if (rating === 1 || rating === 2) return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.ratingLow;
  return 0;
}

function passiveWeight(type) {
  if (type === "recommendation_click") {
    return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.recommendationClick;
  }
  if (type === "product_view") return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.productView;
  if (type === "search_result_click") {
    return BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.searchResultClick;
  }
  return 0;
}

function recencyMultiplier(occurredAt, now) {
  const elapsedDays = Math.floor((now.getTime() - occurredAt.getTime()) / MILLISECONDS_PER_DAY);
  const recency = BEHAVIOR_AFFINITY_ASSUMPTIONS.passiveRecency;
  if (elapsedDays > recency.oldestMaxDays) return 0;
  if (elapsedDays <= recency.recentMaxDays) return recency.recentMultiplier;
  if (elapsedDays <= recency.mediumMaxDays) return recency.mediumMultiplier;
  return recency.oldestMultiplier;
}

function passiveEvidence(interactions, catalogById, now) {
  const deduplicated = new Map();
  for (const interaction of interactions) {
    const productPublicId = signalProductId(interaction?.productPublicId);
    const occurredAt = dateValue(interaction?.occurredAt) || dateValue(interaction?.receivedAt);
    const baseWeight = passiveWeight(interaction?.type);
    if (!productPublicId || !occurredAt || baseWeight === 0 || !catalogById.has(productPublicId)) continue;
    const multiplier = recencyMultiplier(occurredAt, now);
    if (multiplier === 0) continue;
    const day = occurredAt.toISOString().slice(0, 10);
    const deduplicationKey = `${interaction.type}:${productPublicId}:${day}`;
    const evidence = {
      productPublicId,
      type: interaction.type,
      occurredAt,
      amount: baseWeight * multiplier,
    };
    const current = deduplicated.get(deduplicationKey);
    if (!current || evidence.occurredAt.getTime() > current.occurredAt.getTime()) {
      deduplicated.set(deduplicationKey, evidence);
    }
  }

  const byProduct = new Map();
  for (const evidence of deduplicated.values()) {
    if (!byProduct.has(evidence.productPublicId)) byProduct.set(evidence.productPublicId, []);
    byProduct.get(evidence.productPublicId).push(evidence);
  }
  const selected = [];
  for (const evidence of byProduct.values()) {
    evidence.sort((a, b) => (
      b.amount - a.amount
      || b.occurredAt.getTime() - a.occurredAt.getTime()
      || a.type.localeCompare(b.type)
    ));
    selected.push(...evidence.slice(0, BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.passiveEventsPerProduct));
  }
  return selected.sort((a, b) => (
    a.productPublicId - b.productPublicId
    || a.type.localeCompare(b.type)
    || b.occurredAt.getTime() - a.occurredAt.getTime()
  ));
}

function finalizeEvidence(rawEvidence, rawReasons) {
  const evidenceByAttribute = createAttributeMaps();
  const reasonsByAttribute = createReasonMaps();
  const cap = BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.attributeAbsoluteEvidence;
  let profileAbsoluteEvidenceSum = 0;
  for (const attribute of ATTRIBUTE_NAMES) {
    for (const [attributeKey, rawAmount] of rawEvidence[attribute]) {
      const amount = clamp(rawAmount, -cap, cap);
      if (amount === 0) continue;
      evidenceByAttribute[attribute].set(attributeKey, amount);
      profileAbsoluteEvidenceSum += Math.abs(amount);
      if (amount > 0 && rawReasons[attribute].has(attributeKey)) {
        reasonsByAttribute[attribute].set(attributeKey, rawReasons[attribute].get(attributeKey));
      }
    }
  }
  return { evidenceByAttribute, reasonsByAttribute, profileAbsoluteEvidenceSum };
}

function mergePassiveEvidence(rawEvidence, rawReasons, passiveEvidence, passiveReasons) {
  const cap = BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.passiveAttributeAbsoluteEvidence;
  for (const attribute of ATTRIBUTE_NAMES) {
    for (const [attributeKey, rawAmount] of passiveEvidence[attribute]) {
      const amount = clamp(rawAmount, -cap, cap);
      rawEvidence[attribute].set(
        attributeKey,
        (rawEvidence[attribute].get(attributeKey) || 0) + amount,
      );
      if (!passiveReasons[attribute].has(attributeKey)) continue;
      if (!rawReasons[attribute].has(attributeKey)) {
        rawReasons[attribute].set(attributeKey, new Map());
      }
      const destination = rawReasons[attribute].get(attributeKey);
      for (const [reason, contribution] of passiveReasons[attribute].get(attributeKey)) {
        destination.set(reason, (destination.get(reason) || 0) + Math.min(contribution, cap));
      }
    }
  }
}

export function buildBehaviorAffinity(
  profile = {},
  candidates = [],
  { now = new Date(), trackingEnabled = true, feedbackEnabled = true } = {},
) {
  assertCandidates(candidates);
  const referenceTime = dateValue(now);
  if (!referenceTime) throw new TypeError("A valid reference time is required.");
  const catalogById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
  const rawEvidence = createAttributeMaps();
  const rawReasons = createReasonMaps();
  const rawPassiveEvidence = createAttributeMaps();
  const rawPassiveReasons = createReasonMaps();

  for (const rating of profile.ratings || []) {
    const product = catalogById.get(signalProductId(rating?.productPublicId));
    addProductEvidence(rawEvidence, rawReasons, product, ratingWeight(rating?.rating), "rating");
  }
  for (const productPublicId of profile.wishlist || []) {
    const product = catalogById.get(signalProductId(productPublicId));
    addProductEvidence(
      rawEvidence,
      rawReasons,
      product,
      BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.wishlist,
      "wishlist",
    );
  }
  for (const cartItem of profile.cart || []) {
    const product = catalogById.get(signalProductId(cartItem?.productPublicId));
    const quantity = Number.isFinite(cartItem?.quantity)
      ? clamp(cartItem.quantity, 0, BEHAVIOR_AFFINITY_ASSUMPTIONS.caps.cartQuantity)
      : 0;
    const amount = quantity > 0
      ? BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.cartBase
        + (Math.max(1, quantity) - 1) * BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.cartExtraUnit
      : 0;
    addProductEvidence(rawEvidence, rawReasons, product, amount, "cart");
  }
  if (feedbackEnabled) {
    for (const feedback of profile.explicitFeedback || []) {
      const product = catalogById.get(signalProductId(feedback?.productPublicId));
      if (feedback?.kind === "already-own") {
        addProductEvidence(
          rawEvidence,
          rawReasons,
          product,
          BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.alreadyOwn,
          "already-own",
        );
      } else if (feedback?.kind === "not-interested") {
        addProductEvidence(
          rawEvidence,
          rawReasons,
          product,
          BEHAVIOR_AFFINITY_ASSUMPTIONS.sourceWeights.notInterested,
          "not-interested",
        );
      }
    }
  }
  if (trackingEnabled) {
    const passive = passiveEvidence(profile.passiveInteractions || [], catalogById, referenceTime);
    for (const interaction of passive) {
      addProductEvidence(
        rawPassiveEvidence,
        rawPassiveReasons,
        catalogById.get(interaction.productPublicId),
        interaction.amount,
        "passive",
      );
    }
    mergePassiveEvidence(rawEvidence, rawReasons, rawPassiveEvidence, rawPassiveReasons);
  }

  const finalized = finalizeEvidence(rawEvidence, rawReasons);
  return {
    available: finalized.profileAbsoluteEvidenceSum > 0,
    ...finalized,
    assumptionsVersion: BEHAVIOR_RANKING_VERSION,
  };
}

function reasonsForCandidate(candidate, affinity) {
  const contributions = new Map();
  for (const attribute of ATTRIBUTE_NAMES) {
    const attributeKey = key(candidate[attribute]);
    if (!attributeKey || (affinity.evidenceByAttribute?.[attribute]?.get(attributeKey) || 0) <= 0) continue;
    const reasons = affinity.reasonsByAttribute?.[attribute]?.get(attributeKey);
    for (const [reason, amount] of reasons || []) {
      contributions.set(reason, (contributions.get(reason) || 0) + amount);
    }
  }
  return [...contributions]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([reason]) => reason)
    .slice(0, 3);
}

export function scoreBehaviorCandidates(candidates, affinity = {}) {
  assertCandidates(candidates);
  const denominator = Number.isFinite(affinity.profileAbsoluteEvidenceSum)
    ? affinity.profileAbsoluteEvidenceSum
    : 0;
  const scoresByProductId = new Map();
  const reasonsByProductId = new Map();
  let hasMatchedSignedEvidence = false;
  for (const candidate of candidates) {
    let matchedSignedEvidence = 0;
    for (const attribute of ATTRIBUTE_NAMES) {
      const attributeKey = key(candidate[attribute]);
      if (attributeKey) {
        matchedSignedEvidence += affinity.evidenceByAttribute?.[attribute]?.get(attributeKey) || 0;
      }
    }
    if (matchedSignedEvidence !== 0) hasMatchedSignedEvidence = true;
    const score = denominator > 0
      ? clamp((matchedSignedEvidence / denominator + 1) / 2, 0, 1)
      : 0.5;
    const reasons = matchedSignedEvidence === 0 ? [] : reasonsForCandidate(candidate, affinity);
    const entry = { score, reasons };
    scoresByProductId.set(candidate.id, entry);
    reasonsByProductId.set(candidate.id, reasons);
  }
  return {
    available: Boolean(affinity.available) && denominator > 0 && hasMatchedSignedEvidence,
    scoresByProductId,
    reasonsByProductId,
    profileAbsoluteEvidenceSum: denominator,
  };
}

export function rankByBehavior(
  candidates,
  scoreResultOrAffinity = {},
  { limit = candidates?.length || 0 } = {},
) {
  assertCandidates(candidates);
  const scoreResult = scoreResultOrAffinity?.scoresByProductId instanceof Map
    ? scoreResultOrAffinity
    : scoreBehaviorCandidates(candidates, scoreResultOrAffinity);
  const scoredCandidates = candidates.map((product) => {
    const entry = scoreResult.scoresByProductId.get(product.id);
    if (!entry || !Number.isFinite(entry.score)) {
      throw new TypeError("Behavior scores must contain every candidate.");
    }
    return {
      product,
      score: entry.score,
      reasons: entry.reasons || [],
      algorithmVersion: BEHAVIOR_RANKING_VERSION,
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
  return { ...scoreResult, scoredCandidates, recommendations };
}
