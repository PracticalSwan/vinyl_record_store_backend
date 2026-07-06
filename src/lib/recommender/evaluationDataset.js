const RATING_TYPES = new Set(["rating_set", "rating_remove"]);
const WISHLIST_ADD_TYPES = new Set(["wishlist_add", "recommendation_wishlist_add"]);
const CART_ADD_TYPES = new Set(["cart_add", "recommendation_cart_add"]);

const chronological = (left, right) => (
  new Date(left.occurredAt) - new Date(right.occurredAt)
  || String(left.eventId).localeCompare(String(right.eventId))
);

function stateFor(states, productPublicId) {
  if (!states.has(productPublicId)) {
    states.set(productPublicId, { rating: null, wishlist: null, cart: null });
  }
  return states.get(productPublicId);
}

export function constructRelevantEvents(events) {
  const states = new Map();
  for (const event of [...events].sort(chronological)) {
    if (!Number.isInteger(event.productPublicId)) continue;
    const state = stateFor(states, event.productPublicId);
    if (RATING_TYPES.has(event.type)) {
      state.rating = event.type === "rating_set" && event.value >= 4 ? event : null;
    } else if (WISHLIST_ADD_TYPES.has(event.type)) {
      state.wishlist = event;
    } else if (event.type === "wishlist_remove") {
      state.wishlist = null;
    } else if (CART_ADD_TYPES.has(event.type)) {
      state.cart = event;
    } else if (event.type === "cart_remove") {
      state.cart = null;
    }
  }

  return [...states.entries()].flatMap(([productPublicId, signals]) => {
    const active = Object.values(signals).filter(Boolean).sort(chronological);
    if (active.length === 0) return [];
    return [{ ...active.at(-1), productPublicId }];
  }).sort(chronological);
}

export function assertLeakageSafe(subjects) {
  for (const subject of subjects) {
    for (const productId of subject.testRelevant) {
      if (subject.trainingProductIds.has(productId)) {
        throw new Error(`Evaluation leakage detected for subject ${subject.subjectId}.`);
      }
      if (subject.candidateExclusions.has(productId)) {
        throw new Error(`Held-out product was excluded for subject ${subject.subjectId}.`);
      }
    }
  }
  return true;
}

export function buildEvaluationDataset(interactions, {
  itemUniverse,
  minimumSubjects = 20,
  minimumPositiveEvents = 5,
} = {}) {
  if (!(itemUniverse instanceof Set)) throw new TypeError("itemUniverse must be a Set.");
  const eventIds = new Set();
  const bySubject = new Map();
  let duplicateEvents = 0;
  let outOfUniverseEvents = 0;

  for (const event of [...interactions].sort(chronological)) {
    if (!event?.subjectId || !event.eventId || Number.isNaN(new Date(event.occurredAt).getTime())) continue;
    if (eventIds.has(event.eventId)) {
      duplicateEvents += 1;
      continue;
    }
    eventIds.add(event.eventId);
    if (Number.isInteger(event.productPublicId) && !itemUniverse.has(event.productPublicId)) {
      outOfUniverseEvents += 1;
      continue;
    }
    const subjectEvents = bySubject.get(event.subjectId) || [];
    subjectEvents.push(event);
    bySubject.set(event.subjectId, subjectEvents);
  }

  const subjects = [];
  let positiveEvents = 0;
  for (const [subjectId, events] of bySubject) {
    const relevantEvents = constructRelevantEvents(events);
    positiveEvents += relevantEvents.length;
    if (relevantEvents.length < minimumPositiveEvents) continue;
    const heldOut = relevantEvents.at(-1);
    const trainingProductIds = new Set(
      relevantEvents.slice(0, -1).map((event) => event.productPublicId),
    );
    const testRelevant = new Set([heldOut.productPublicId]);
    const candidateExclusions = new Set(trainingProductIds);
    subjects.push({
      subjectId,
      trainingProductIds,
      testRelevant,
      candidateExclusions,
      heldOutAt: new Date(heldOut.occurredAt),
      positiveEventCount: relevantEvents.length,
    });
  }
  subjects.sort((left, right) => left.subjectId.localeCompare(right.subjectId));
  assertLeakageSafe(subjects);

  const dates = interactions
    .map((event) => new Date(event.occurredAt))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => left - right);
  return {
    status: subjects.length >= minimumSubjects ? "eligible" : "insufficient-evidence",
    subjects,
    counts: {
      interactions: eventIds.size,
      subjectsObserved: bySubject.size,
      eligibleSubjects: subjects.length,
      positiveEvents,
      products: itemUniverse.size,
      duplicateEvents,
      outOfUniverseEvents,
    },
    window: {
      from: dates[0]?.toISOString() || null,
      to: dates.at(-1)?.toISOString() || null,
    },
    minimumEvidence: {
      subjects: minimumSubjects,
      positiveEventsPerSubject: minimumPositiveEvents,
    },
  };
}
