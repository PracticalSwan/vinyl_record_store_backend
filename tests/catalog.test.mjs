import test from "node:test";
import assert from "node:assert/strict";
import { getProduct, listProducts } from "../src/services/catalog.js";

test("catalog filters by genre and stock", () => {
  const params = new URLSearchParams({ genre: "Jazz", inStock: "true", limit: "100" });
  const result = listProducts(params);

  assert.ok(result.items.length > 0);
  assert.ok(result.items.every((item) => item.genre === "Jazz" && item.stock !== "out"));
});

test("product detail returns the public API shape", () => {
  const product = getProduct("1");
  assert.equal(product.title, "Kind of Blue");
  assert.equal(product.currency, "USD");
  assert.equal("reason" in product, false);
});

test("catalog rejects unsupported era filters", () => {
  const params = new URLSearchParams({ era: "future" });
  assert.throws(() => listProducts(params), /era is not supported/);
});
