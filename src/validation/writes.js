import { invalid } from "../lib/errors.js";
import { assertOnlyKeys } from "../lib/request.js";
import {
  INTERACTION_TYPES,
  PRODUCT_CONDITIONS,
  PRODUCT_FORMATS,
  PRODUCT_GENRES,
  RETENTION_MS,
} from "../models/constants.js";
import { productId } from "./catalog.js";

const MAX_STATE_ITEMS = 100;
const MAX_EVENTS = 50;
const MAX_FUTURE_SKEW_MS = 5 * 60 * 1000;
export const INTERACTION_SURFACES = [
  "home",
  "recommendations",
  "product-detail",
  "catalog",
  "search",
  "wishlist",
  "cart",
  "checkout",
];
const PRODUCT_EVENT_TYPES = new Set([
  "recommendation_impression",
  "recommendation_click",
  "recommendation_wishlist_add",
  "recommendation_cart_add",
  "recommendation_dismiss",
  "product_view",
  "wishlist_add",
  "wishlist_remove",
  "cart_add",
  "cart_remove",
  "cart_quantity",
  "rating_set",
  "rating_remove",
  "search_result_click",
]);
const RECOMMENDATION_EVENT_TYPES = new Set([
  "recommendation_impression",
  "recommendation_click",
  "recommendation_wishlist_add",
  "recommendation_cart_add",
  "recommendation_dismiss",
]);

function uniqueControlled(values, allowed, name, max = 5) {
  if (!Array.isArray(values) || values.length > max) {
    throw invalid(`${name} must be an array with at most ${max} values.`);
  }
  const canonical = new Map(allowed.map((value) => [value.toLowerCase(), value]));
  const normalized = values.map((value) => canonical.get(String(value).trim().toLowerCase()));
  if (normalized.some((value) => !value) || new Set(normalized).size !== normalized.length) {
    throw invalid(`${name} contains unsupported or duplicate values.`);
  }
  return normalized;
}

function optionalMoney(value, name) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1_000_000) {
    throw invalid(`${name} must be a non-negative number.`);
  }
  return value;
}

export function parsePreferences(body) {
  assertOnlyKeys(body, [
    "favoriteGenres",
    "dislikedGenres",
    "favoriteArtists",
    "budget",
    "conditions",
    "formats",
    "completed",
    "schemaVersion",
  ]);
  const favoriteGenres = uniqueControlled(body.favoriteGenres || [], PRODUCT_GENRES, "favoriteGenres");
  const dislikedGenres = uniqueControlled(body.dislikedGenres || [], PRODUCT_GENRES, "dislikedGenres");
  if (favoriteGenres.some((genre) => dislikedGenres.includes(genre))) {
    throw invalid("Favorite and disliked genres cannot overlap.");
  }

  const artistInput = body.favoriteArtists || [];
  if (!Array.isArray(artistInput) || artistInput.length > 5) {
    throw invalid("favoriteArtists must contain at most 5 values.");
  }
  const favoriteArtists = artistInput.map((value) => String(value).trim());
  if (
    favoriteArtists.some((value) => !value || value.length > 200)
    || new Set(favoriteArtists.map((value) => value.toLowerCase())).size !== favoriteArtists.length
  ) throw invalid("favoriteArtists contains blank, duplicate, or overlong values.");

  const budgetInput = body.budget ?? {};
  if (!budgetInput || typeof budgetInput !== "object" || Array.isArray(budgetInput)) {
    throw invalid("budget must be an object.");
  }
  assertOnlyKeys(budgetInput, ["min", "max"], "budget");
  const budget = {
    min: optionalMoney(budgetInput.min, "budget.min"),
    max: optionalMoney(budgetInput.max, "budget.max"),
  };
  if (budget.min !== null && budget.max !== null && budget.min > budget.max) {
    throw invalid("budget.min cannot be greater than budget.max.");
  }

  if (body.completed !== undefined && typeof body.completed !== "boolean") {
    throw invalid("completed must be a boolean.");
  }
  if (body.completed && favoriteGenres.length === 0) {
    throw invalid("At least one favorite genre is required to complete onboarding.");
  }
  if (body.schemaVersion !== undefined && body.schemaVersion !== 1) {
    throw invalid("schemaVersion is not supported.");
  }

  return {
    favoriteGenres,
    dislikedGenres,
    favoriteArtists,
    budget,
    conditions: uniqueControlled(body.conditions || [], PRODUCT_CONDITIONS, "conditions", 5),
    formats: uniqueControlled(body.formats || [], PRODUCT_FORMATS, "formats", 5),
    completedAt: body.completed ? new Date() : null,
    schemaVersion: 1,
  };
}

export function parseQuantity(body) {
  assertOnlyKeys(body, ["quantity"]);
  if (!Number.isInteger(body.quantity) || body.quantity < 1 || body.quantity > 99) {
    throw invalid("quantity must be an integer from 1 through 99.");
  }
  return body.quantity;
}

export function parseRating(body) {
  assertOnlyKeys(body, ["rating"]);
  if (!Number.isInteger(body.rating) || body.rating < 1 || body.rating > 5) {
    throw invalid("rating must be an integer from 1 through 5.");
  }
  return body.rating;
}

function boundedId(value, name, maxLength = 128) {
  const result = String(value || "").trim();
  if (!result || result.length > maxLength || !/^[a-zA-Z0-9_.:-]+$/.test(result)) {
    throw invalid(`${name} is invalid.`);
  }
  return result;
}

function occurredAt(value, now) {
  const date = new Date(value);
  if (
    Number.isNaN(date.getTime())
    || date.getTime() > now + MAX_FUTURE_SKEW_MS
    || date.getTime() < now - RETENTION_MS
  ) throw invalid("occurredAt must be a valid timestamp within the retention window.");
  return date;
}

function stateUpdatedAt(value, now) {
  const date = new Date(value);
  if (
    Number.isNaN(date.getTime())
    || date.getTime() > now + MAX_FUTURE_SKEW_MS
    || date.getTime() < Date.UTC(2000, 0, 1)
  ) throw invalid("updatedAt must be a valid timestamp that is not in the future.");
  return date;
}

function recommendationContext(value) {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw invalid("recommendationContext must be an object.");
  }
  assertOnlyKeys(value, ["requestId", "algorithmVersion", "mode", "rank", "listId"]);
  if (value.rank !== undefined && (!Number.isInteger(value.rank) || value.rank < 1 || value.rank > 1_000)) {
    throw invalid("recommendationContext.rank must be an integer from 1 through 1000.");
  }
  return {
    requestId: value.requestId ? boundedId(value.requestId, "requestId") : null,
    algorithmVersion: value.algorithmVersion
      ? boundedId(value.algorithmVersion, "algorithmVersion", 100)
      : null,
    mode: value.mode ? boundedId(value.mode, "mode", 64) : null,
    rank: value.rank ?? null,
    listId: value.listId ? boundedId(value.listId, "listId") : null,
  };
}

function searchContext(value, type) {
  if (value === null || value === undefined) return null;
  if (type !== "search_result_click" || typeof value !== "object" || Array.isArray(value)) {
    throw invalid("searchContext is supported only for search_result_click events.");
  }
  assertOnlyKeys(value, ["rank", "queryLength"], "searchContext");
  if (!Number.isInteger(value.rank) || value.rank < 1 || value.rank > 1_000) {
    throw invalid("searchContext.rank must be an integer from 1 through 1000.");
  }
  if (!Number.isInteger(value.queryLength) || value.queryLength < 0 || value.queryLength > 100) {
    throw invalid("searchContext.queryLength must be an integer from 0 through 100.");
  }
  return { rank: value.rank, queryLength: value.queryLength };
}

function parseEvent(event, { authenticated, now }) {
  if (!event || typeof event !== "object" || Array.isArray(event)) {
    throw invalid("Each event must be an object.");
  }
  assertOnlyKeys(event, [
    "eventId",
    "v",
    "type",
    "anonymousId",
    "sessionId",
    "productId",
    "occurredAt",
    "source",
    "surface",
    "value",
    "recommendationContext",
    "searchContext",
  ], "Event");
  if (event.v !== 1) throw invalid("Event schema version is not supported.");
  if (!INTERACTION_TYPES.includes(event.type)) throw invalid("Event type is not supported.");
  if (event.source !== "groovehaus-frontend") throw invalid("Event source is not supported.");
  if (!INTERACTION_SURFACES.includes(event.surface)) throw invalid("Event surface is not supported.");

  const anonymousId = event.anonymousId
    ? boundedId(event.anonymousId, "anonymousId")
    : null;
  if (!authenticated && !anonymousId) throw invalid("Anonymous events require anonymousId.");

  let value = event.value ?? null;
  if (value !== null && (typeof value !== "number" || !Number.isFinite(value))) {
    throw invalid("Event value must be a number.");
  }
  if (value !== null && (value < -99 || value > 99)) {
    throw invalid("Event value must be between -99 and 99.");
  }
  if (event.type === "rating_set" && (!Number.isInteger(value) || value < 1 || value > 5)) {
    throw invalid("rating_set events require a value from 1 through 5.");
  }
  if (event.type === "cart_quantity" && (!Number.isInteger(value) || value < 1 || value > 99)) {
    throw invalid("cart_quantity events require a value from 1 through 99.");
  }

  const parsedProductId = event.productId === null || event.productId === undefined
    ? null
    : productId(event.productId);
  if (PRODUCT_EVENT_TYPES.has(event.type) && parsedProductId === null) {
    throw invalid(`${event.type} events require productId.`);
  }
  const parsedRecommendationContext = recommendationContext(event.recommendationContext);
  if (
    RECOMMENDATION_EVENT_TYPES.has(event.type)
    && (
      !parsedRecommendationContext?.requestId
      || !parsedRecommendationContext.algorithmVersion
      || !parsedRecommendationContext.mode
      || !parsedRecommendationContext.rank
      || !parsedRecommendationContext.listId
    )
  ) {
    throw invalid(`${event.type} events require complete recommendationContext.`);
  }

  return {
    eventId: boundedId(event.eventId, "eventId"),
    schemaVersion: 1,
    type: event.type,
    anonymousId,
    sessionId: boundedId(event.sessionId, "sessionId"),
    productPublicId: parsedProductId,
    occurredAt: occurredAt(event.occurredAt, now),
    source: event.source,
    surface: event.surface,
    value,
    recommendationContext: parsedRecommendationContext,
    searchContext: searchContext(event.searchContext, event.type),
  };
}

export function parseInteractionBatch(body, { authenticated = false, now = Date.now() } = {}) {
  assertOnlyKeys(body, ["events"]);
  if (!Array.isArray(body.events) || body.events.length < 1 || body.events.length > MAX_EVENTS) {
    throw invalid(`events must contain between 1 and ${MAX_EVENTS} items.`);
  }
  const events = body.events.map((event) => parseEvent(event, { authenticated, now }));
  if (new Set(events.map((event) => event.eventId)).size !== events.length) {
    throw invalid("Event IDs must be unique within a batch.");
  }
  return events;
}

export function parseInteractionSurface(value, fallback) {
  const surface = String(value || fallback || "").trim();
  if (!INTERACTION_SURFACES.includes(surface)) throw invalid("surface is not supported.");
  return surface;
}

export function parseAnonymousId(value) {
  return value ? boundedId(value, "anonymousId") : null;
}

function productIds(values, name) {
  if (!Array.isArray(values) || values.length > MAX_STATE_ITEMS) {
    throw invalid(`${name} must contain at most ${MAX_STATE_ITEMS} items.`);
  }
  const parsed = values.map(productId);
  if (new Set(parsed).size !== parsed.length) throw invalid(`${name} contains duplicate products.`);
  return parsed;
}

export function parseGuestMerge(body, { now = Date.now() } = {}) {
  assertOnlyKeys(body, ["mergeId", "wishlist", "cart", "ratings"]);
  const wishlist = productIds(body.wishlist || [], "wishlist");
  const cartInput = body.cart || [];
  if (!Array.isArray(cartInput) || cartInput.length > MAX_STATE_ITEMS) {
    throw invalid(`cart must contain at most ${MAX_STATE_ITEMS} items.`);
  }
  const cart = cartInput.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid("Cart items must be objects.");
    assertOnlyKeys(item, ["productId", "quantity"], "Cart item");
    return { productPublicId: productId(item.productId), quantity: parseQuantity({ quantity: item.quantity }) };
  });
  if (new Set(cart.map((item) => item.productPublicId)).size !== cart.length) {
    throw invalid("cart contains duplicate products.");
  }

  const ratingInput = body.ratings || [];
  if (!Array.isArray(ratingInput) || ratingInput.length > MAX_STATE_ITEMS) {
    throw invalid(`ratings must contain at most ${MAX_STATE_ITEMS} items.`);
  }
  const ratings = ratingInput.map((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw invalid("Ratings must be objects.");
    assertOnlyKeys(item, ["productId", "rating", "updatedAt"], "Rating");
    return {
      productPublicId: productId(item.productId),
      rating: parseRating({ rating: item.rating }),
      updatedAt: stateUpdatedAt(item.updatedAt, now),
    };
  });
  if (new Set(ratings.map((item) => item.productPublicId)).size !== ratings.length) {
    throw invalid("ratings contains duplicate products.");
  }

  return {
    mergeId: boundedId(body.mergeId, "mergeId"),
    wishlist,
    cart,
    ratings,
  };
}
