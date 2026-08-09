const cloneDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : new Date(date.getTime());
};

const numberId = (value) => Number.isInteger(value) && value > 0 ? value : null;

function preferences(value = {}) {
  return {
    favoriteGenres: [...(value.favoriteGenres || [])],
    dislikedGenres: [...(value.dislikedGenres || [])],
    favoriteArtists: [...(value.favoriteArtists || [])],
    budget: {
      min: value.budget?.min ?? null,
      max: value.budget?.max ?? null,
    },
    conditions: [...(value.conditions || [])],
    formats: [...(value.formats || [])],
    completedAt: cloneDate(value.completedAt),
    schemaVersion: value.schemaVersion || 1,
  };
}

export function buildRecommendationProfile({
  subject,
  preferences: explicitPreferences,
  ratings = [],
  wishlist = [],
  cart = [],
  feedback = [],
  interactions = [],
} = {}) {
  if (!subject || subject.kind !== "registered" || !subject.publicId) {
    throw new TypeError("A registered recommendation subject is required.");
  }
  const sources = [...ratings, ...cart, ...feedback, ...interactions];
  for (const source of sources) {
    if (source?.userPublicId && source.userPublicId !== subject.publicId) {
      throw new TypeError("Recommendation profile sources must belong to the subject.");
    }
  }
  return {
    explicitPreferences: preferences(explicitPreferences),
    ratings: ratings
      .map((item) => ({
        productPublicId: numberId(item.productPublicId),
        rating: item.rating,
        updatedAt: cloneDate(item.updatedAt),
      }))
      .filter((item) => item.productPublicId !== null)
      .sort((a, b) => a.productPublicId - b.productPublicId),
    wishlist: [...new Set(wishlist.map(numberId).filter((id) => id !== null))].sort((a, b) => a - b),
    cart: cart
      .map((item) => ({ productPublicId: numberId(item.productPublicId), quantity: item.quantity }))
      .filter((item) => item.productPublicId !== null)
      .sort((a, b) => a.productPublicId - b.productPublicId),
    explicitFeedback: feedback
      .map((item) => ({
        productPublicId: numberId(item.productPublicId),
        kind: item.kind,
        schemaVersion: item.schemaVersion || 1,
        createdAt: cloneDate(item.createdAt),
        updatedAt: cloneDate(item.updatedAt),
      }))
      .filter((item) => item.productPublicId !== null && item.kind),
    passiveInteractions: interactions
      .map((item) => ({
        type: item.type,
        value: item.value ?? null,
        productPublicId: numberId(item.productPublicId),
        surface: item.surface || null,
        recommendationContext: item.recommendationContext || null,
        searchContext: item.searchContext || null,
        occurredAt: cloneDate(item.occurredAt),
        receivedAt: cloneDate(item.receivedAt),
        schemaVersion: item.schemaVersion || 1,
        eventId: item.eventId || null,
      }))
      .filter((item) => item.type && (item.occurredAt || item.receivedAt))
      .sort((a, b) => (
        (b.occurredAt?.getTime() || 0) - (a.occurredAt?.getTime() || 0)
        || (b.receivedAt?.getTime() || 0) - (a.receivedAt?.getTime() || 0)
        || String(a.eventId || "").localeCompare(String(b.eventId || ""))
      )),
  };
}
