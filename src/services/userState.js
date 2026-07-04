import { createHash, randomUUID } from "node:crypto";
import { conflict, notFound } from "../lib/errors.js";
import { getCatalogRepository } from "../lib/db/dataSource.js";
import { RETENTION_MS } from "../models/constants.js";
import { eventRepository } from "../repositories/eventRepository.js";
import { userRepository } from "../repositories/userRepository.js";
import { userStateRepository } from "../repositories/userStateRepository.js";

function defaultPreferences() {
  return {
    favoriteGenres: [],
    dislikedGenres: [],
    favoriteArtists: [],
    budget: { min: null, max: null },
    conditions: [],
    formats: [],
    completedAt: null,
    schemaVersion: 1,
  };
}

export function profile(user) {
  return {
    publicId: user.publicId,
    username: user.username,
    displayName: user.displayName,
    role: user.role,
    onboardingComplete: Boolean(user.preferences?.completedAt),
    preferences: user.preferences || defaultPreferences(),
    seeded: Boolean(user.seeded),
  };
}

export async function replacePreferences(user, preferences, {
  users = userRepository,
} = {}) {
  // Env-backed demo accounts have ephemeral preferences by design: they are
  // shared classroom accounts, and not persisting keeps every tester on a
  // clean profile. Registered customers persist through updatePreferences.
  if (user.seeded) {
    return profile({ ...user, preferences });
  }
  const updated = await users.updatePreferences(user.publicId, preferences);
  if (!updated) throw notFound("The active account was not found.");
  return profile(updated);
}

async function productOrThrow(productPublicId, catalog) {
  const product = await catalog.findByPublicId(productPublicId);
  if (!product) throw notFound(`Product ${productPublicId} was not found.`);
  return product;
}

async function resolveProducts(productPublicIds, catalog) {
  const products = await Promise.all(productPublicIds.map((id) => catalog.findByPublicId(id)));
  return products.filter(Boolean);
}

export async function readWishlist(user, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  const value = await state.getWishlist(user.publicId);
  const productIds = value?.productPublicIds || [];
  return { productIds, items: await resolveProducts(productIds, catalog) };
}

export async function addWishlist(user, productPublicId, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  await productOrThrow(productPublicId, catalog);
  await state.addWishlistProduct(user.publicId, productPublicId);
  return readWishlist(user, { state, catalog });
}

export async function removeWishlist(user, productPublicId, options = {}) {
  const state = options.state || userStateRepository;
  await state.removeWishlistProduct(user.publicId, productPublicId);
  return readWishlist(user, { ...options, state });
}

function cartResponse(value, products) {
  const productMap = new Map(products.map((product) => [product.id, product]));
  const warnings = [];
  const items = (value?.items || []).map((item) => {
    const product = productMap.get(item.productPublicId) || null;
    if (!product) {
      warnings.push({
        code: "PRODUCT_UNAVAILABLE",
        productId: item.productPublicId,
        message: "A cart item is no longer available.",
      });
    } else if (product.stock === "out") {
      warnings.push({
        code: "OUT_OF_STOCK",
        productId: item.productPublicId,
        message: `${product.title} is out of stock.`,
      });
    }
    return {
      productId: item.productPublicId,
      quantity: item.quantity,
      product,
      lineTotal: product ? Number((product.price * item.quantity).toFixed(2)) : null,
    };
  });
  return {
    items,
    subtotal: Number(items.reduce((sum, item) => sum + (item.lineTotal || 0), 0).toFixed(2)),
    currency: "USD",
    warnings,
  };
}

export async function readCart(user, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  const value = await state.getCart(user.publicId);
  const products = await resolveProducts(
    (value?.items || []).map((item) => item.productPublicId),
    catalog,
  );
  return cartResponse(value, products);
}

export async function setCart(user, productPublicId, quantity, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  await productOrThrow(productPublicId, catalog);
  await state.setCartItem(user.publicId, productPublicId, quantity);
  return readCart(user, { state, catalog });
}

export async function removeCart(user, productPublicId, options = {}) {
  const state = options.state || userStateRepository;
  await state.removeCartItem(user.publicId, productPublicId);
  return readCart(user, { ...options, state });
}

export async function readRatings(user, { state = userStateRepository } = {}) {
  const items = await state.listRatings(user.publicId);
  return {
    items: items.map(({ productPublicId, rating, updatedAt }) => ({
      productId: productPublicId,
      rating,
      updatedAt,
    })),
  };
}

function ratingEvent(productPublicId, type, rating = null) {
  const receivedAt = new Date();
  return {
    eventId: randomUUID(),
    type,
    productPublicId,
    value: rating,
    source: "groovehaus-backend",
    surface: "product-detail",
    sessionId: randomUUID(),
    occurredAt: receivedAt,
    receivedAt,
    expiresAt: new Date(receivedAt.getTime() + RETENTION_MS),
    schemaVersion: 1,
  };
}

export async function setRating(user, productPublicId, rating, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  await productOrThrow(productPublicId, catalog);
  await state.setRatingWithEvent(
    user.publicId,
    productPublicId,
    rating,
    ratingEvent(productPublicId, "rating_set", rating),
  );
  return readRatings(user, { state });
}

export async function removeRating(user, productPublicId, {
  state = userStateRepository,
} = {}) {
  await state.removeRatingWithEvent(
    user.publicId,
    productPublicId,
    ratingEvent(productPublicId, "rating_remove"),
  );
  return readRatings(user, { state });
}

export async function ingestInteractions(user, events, {
  repository = eventRepository,
} = {}) {
  const owned = events.map((event) => ({
    ...event,
    userPublicId: user?.publicId || null,
    anonymousId: user ? null : event.anonymousId,
  }));
  return repository.appendInteractions(owned);
}

function stableHash(value) {
  const stable = {
    mergeId: value.mergeId,
    wishlist: value.wishlist,
    cart: value.cart,
    ratings: value.ratings.map((rating) => ({
      ...rating,
      updatedAt: rating.updatedAt.toISOString(),
    })),
  };
  return createHash("sha256").update(JSON.stringify(stable)).digest("hex");
}

export async function mergeGuestState(user, input, {
  state = userStateRepository,
  catalog = getCatalogRepository(),
} = {}) {
  const ids = [...new Set([
    ...input.wishlist,
    ...input.cart.map((item) => item.productPublicId),
    ...input.ratings.map((item) => item.productPublicId),
  ])];
  const products = await Promise.all(ids.map(async (id) => ({
    id,
    product: await catalog.findByPublicId(id),
  })));
  const missing = new Set(products.filter(({ product }) => !product).map(({ id }) => id));
  const stock = new Map(products.filter(({ product }) => product).map(({ id, product }) => [id, product.stock]));

  const filtered = {
    ...input,
    wishlist: input.wishlist.filter((id) => !missing.has(id)),
    cart: input.cart.filter((item) => !missing.has(item.productPublicId)),
    ratings: input.ratings.filter((item) => !missing.has(item.productPublicId)),
  };
  const warnings = [
    ...[...missing].map((id) => ({
      code: "PRODUCT_UNAVAILABLE",
      productId: id,
      message: "A guest-state product is no longer available.",
    })),
    ...filtered.cart
      .filter((item) => stock.get(item.productPublicId) === "out")
      .map((item) => ({
        code: "OUT_OF_STOCK",
        productId: item.productPublicId,
        message: "An out-of-stock item remains in the merged cart for review.",
      })),
  ];
  const result = await state.mergeGuestState(
    user.publicId,
    filtered,
    stableHash(input),
    warnings,
  );
  if (!result) throw conflict("The guest state could not be merged.");
  return result;
}
