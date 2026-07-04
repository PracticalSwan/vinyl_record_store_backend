import test from "node:test";
import assert from "node:assert/strict";
import {
  addWishlist,
  ingestInteractions,
  mergeGuestState,
  readCart,
  replacePreferences,
  setCart,
} from "../src/services/userState.js";
import { deleteAccount } from "../src/services/account.js";
import { mergeRatingsByNewest } from "../src/repositories/userStateRepository.js";

const user = {
  publicId: "user-1",
  username: "listener",
  displayName: "Listener",
  role: "customer",
  seeded: false,
  preferences: {},
};
const catalog = {
  findByPublicId: async (id) => ({
    id,
    title: `Record ${id}`,
    artist: "Artist",
    price: id === 2 ? 15.5 : 10,
    stock: id === 2 ? "out" : "in",
  }),
};

test("wishlist writes use the authenticated subject and remain idempotent", async () => {
  let stored = [];
  const state = {
    getWishlist: async (userPublicId) => ({ userPublicId, productPublicIds: stored }),
    addWishlistProduct: async (userPublicId, productPublicId) => {
      assert.equal(userPublicId, "user-1");
      stored = [...new Set([...stored, productPublicId])];
    },
  };
  await addWishlist(user, 1, { state, catalog });
  const result = await addWishlist(user, 1, { state, catalog });
  assert.deepEqual(result.productIds, [1]);
});

test("cart uses absolute quantities and returns availability warnings and totals", async () => {
  let items = [];
  const state = {
    getCart: async () => ({ items }),
    setCartItem: async (_userPublicId, productPublicId, quantity) => {
      items = [{ productPublicId, quantity }];
    },
  };
  const updated = await setCart(user, 2, 3, { state, catalog });
  assert.equal(updated.subtotal, 46.5);
  assert.equal(updated.warnings[0].code, "OUT_OF_STOCK");
  assert.equal((await readCart(user, { state, catalog })).items[0].quantity, 3);
});

test("preference writes cannot alter identity or role", async () => {
  let stored;
  const users = {
    updatePreferences: async (publicId, preferences) => {
      assert.equal(publicId, "user-1");
      stored = preferences;
      return { ...user, preferences };
    },
  };
  const result = await replacePreferences(user, { favoriteGenres: ["Jazz"] }, { users });
  assert.deepEqual(stored, { favoriteGenres: ["Jazz"] });
  assert.equal(result.role, "customer");
});

test("seeded accounts keep preferences ephemeral and skip persistence", async () => {
  let persisted = false;
  const users = {
    updatePreferences: async () => { persisted = true; },
  };
  const seededUser = { ...user, seeded: true };
  const result = await replacePreferences(seededUser, { favoriteGenres: ["Jazz"] }, { users });
  assert.equal(persisted, false);
  assert.deepEqual(result.preferences.favoriteGenres, ["Jazz"]);
});

test("interaction ingestion attaches authenticated ownership and strips anonymous identity", async () => {
  let stored;
  const repository = {
    appendInteractions: async (events) => {
      stored = events;
      return { accepted: events.length, duplicates: 0 };
    },
  };
  await ingestInteractions(user, [{ eventId: "event-1", anonymousId: "anon-1" }], { repository });
  assert.equal(stored[0].userPublicId, "user-1");
  assert.equal(stored[0].anonymousId, null);
});

test("guest merge filters unavailable products before the idempotent repository operation", async () => {
  let captured;
  const state = {
    mergeGuestState: async (...args) => {
      captured = args;
      return { wishlist: args[1].wishlist, warnings: args[3] };
    },
  };
  const mergeCatalog = {
    findByPublicId: async (id) => id === 99 ? null : catalog.findByPublicId(id),
  };
  const result = await mergeGuestState(user, {
    mergeId: "merge-1",
    wishlist: [1, 99],
    cart: [{ productPublicId: 2, quantity: 1 }],
    ratings: [],
  }, { state, catalog: mergeCatalog });
  assert.deepEqual(captured[1].wishlist, [1]);
  assert.equal(result.warnings.some((warning) => warning.productId === 99), true);
});

test("account deletion blocks seeded and administrator identities", async () => {
  await assert.rejects(
    () => deleteAccount({ ...user, seeded: true }),
    (error) => error.code === "FORBIDDEN",
  );
  await assert.rejects(
    () => deleteAccount({ ...user, role: "admin" }),
    (error) => error.code === "FORBIDDEN",
  );
});

test("sequential guest merges preserve unchanged server chronology", () => {
  const originalUpdatedAt = new Date("2026-01-01T00:00:00.000Z");
  const olderGuest = new Date("2025-12-01T00:00:00.000Z");
  const newerGuest = new Date("2026-02-01T00:00:00.000Z");
  const server = [{ productPublicId: 1, rating: 3, updatedAt: originalUpdatedAt }];

  const first = mergeRatingsByNewest(server, [
    { productPublicId: 1, rating: 2, updatedAt: olderGuest },
  ]);
  assert.equal(first.writes.length, 0);
  assert.equal(first.ratings[0].updatedAt, originalUpdatedAt);

  const second = mergeRatingsByNewest(first.ratings, [
    { productPublicId: 1, rating: 5, updatedAt: newerGuest },
  ]);
  assert.equal(second.writes.length, 1);
  assert.equal(second.ratings[0].rating, 5);
  assert.equal(second.ratings[0].updatedAt, newerGuest);
});
