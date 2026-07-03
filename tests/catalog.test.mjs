import test from "node:test";
import assert from "node:assert/strict";
import { getProduct, listProducts } from "../src/services/catalog.js";

test("catalog filters by genre and stock", async () => {
  const params = new URLSearchParams({ genre: "Jazz", inStock: "true", limit: "100" });
  const result = await listProducts(params);

  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.genre === "Jazz" && item.stock !== "out"));
});

test("product detail returns the public API shape", async () => {
  const product = await getProduct("1");
  assert.equal(product.title, "Kind of Blue");
  assert.equal(product.currency, "USD");
  assert.equal("reason" in product, false);
});

test("catalog rejects unsupported era filters", async () => {
  const params = new URLSearchParams({ era: "future" });
  await assert.rejects(() => listProducts(params), /era contains an unsupported value/);
});

test("catalog supports repeated filters with OR within a facet", async () => {
  const params = new URLSearchParams("genre=Jazz&genre=Rock&condition=NM&condition=VG%2B&limit=100");
  const result = await listProducts(params);
  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => ["Jazz", "Rock"].includes(item.genre)));
  assert.ok(result.items.every((item) => ["NM", "VG+"].includes(item.condition)));
});

test("catalog returns deterministic sort, pagination, totals, and global facets", async () => {
  const params = new URLSearchParams({ sort: "price-desc", page: "2", limit: "5" });
  const result = await listProducts(params);
  assert.equal(result.items.length, 5);
  assert.equal(result.meta.page, 2);
  assert.equal(result.meta.total, 116);
  assert.equal(result.meta.totalPages, 24);
  assert.equal(result.meta.sort, "price-desc");
  assert.equal(result.meta.facets.genres.find(({ value }) => value === "Jazz").count, 20);
  assert.ok(result.items.every((item, index, items) => index === 0 || items[index - 1].price >= item.price));
});

test("literal search does not interpret regular-expression characters", async () => {
  const result = await listProducts(new URLSearchParams({ q: ".*", limit: "100" }));
  assert.equal(result.items.length, 0);
});

test("catalog rejects invalid sort and excessive repeated values", async () => {
  await assert.rejects(
    () => listProducts(new URLSearchParams({ sort: "random" })),
    /sort is not supported/,
  );
  const values = new URLSearchParams();
  for (let index = 0; index < 21; index += 1) values.append("genre", "Jazz");
  await assert.rejects(() => listProducts(values), /at most 20 values/);
});

test("catalog bounds every free-text filter", async () => {
  for (const name of ["q", "artist", "label"]) {
    await assert.rejects(
      () => listProducts(new URLSearchParams({ [name]: "x".repeat(101) })),
      new RegExp(`${name} must be 100 characters or fewer`),
    );
  }
});
