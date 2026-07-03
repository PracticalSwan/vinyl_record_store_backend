import test from "node:test";
import assert from "node:assert/strict";
import {
  recommendForProduct,
  recommendForUser,
} from "../src/lib/recommender/contentBased.js";
import { ndcgAtK } from "../src/lib/recommender/evaluate.js";

test("product recommendations rank the same artist first", async () => {
  const result = await recommendForProduct(1, 6);
  assert.equal(result.recommendations[0].product.artist, "Miles Davis");
  assert.ok(result.recommendations[0].reasons.some((reason) => reason.includes("Same artist")));
  assert.ok(result.recommendations.every((item) => item.product.id !== 1));
  assert.ok(result.recommendations.every((item) => item.product.stock !== "out"));
});

test("demo profile excludes its known records and labels its mode", async () => {
  const result = await recommendForUser("demo-user", 8);
  const excluded = new Set([1, 2, 3, 4]);
  assert.equal(result.mode, "demo-profile");
  assert.ok(result.recommendations.every((item) => !excluded.has(item.product.id)));
});

test("unknown users receive an explicit cold-start list", async () => {
  const result = await recommendForUser("new-user", 5);
  assert.equal(result.mode, "cold-start");
  assert.match(result.profileSummary[0], /No stored history/);
});

test("NDCG is one for an ideal ordering", () => {
  const relevant = new Set([2, 3, 4]);
  assert.equal(ndcgAtK(relevant, [2, 3, 4], 3), 1);
});
