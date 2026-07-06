import test from "node:test";
import assert from "node:assert/strict";
import { buildEvaluationDataset } from "../src/lib/recommender/evaluationDataset.js";
import {
  averagePrecisionAtK,
  catalogCoverage,
  ndcgAtK,
  noveltyAtK,
  personalization,
  reciprocalRankAtK,
} from "../src/lib/recommender/evaluate.js";
import { evaluateOffline } from "../src/lib/recommender/offlineEvaluation.js";

test("ranking and beyond-accuracy helpers pass ideal, empty, and bounded sanity cases", () => {
  const relevant = new Set([1, 2]);
  assert.equal(ndcgAtK(relevant, [1, 2], 2), 1);
  assert.equal(averagePrecisionAtK(relevant, [1, 2], 2), 1);
  assert.equal(reciprocalRankAtK(relevant, [9, 2], 2), 0.5);
  assert.equal(catalogCoverage([[1, 2], [2, 3]], new Set([1, 2, 3, 4])), 0.75);
  assert.equal(noveltyAtK([], 10, new Map(), 20), 0);
  assert.equal(personalization([[1, 2], [1, 2]], 2), 0);
  assert.equal(personalization([[1, 2], [3, 4]], 2), 1);
  assert.throws(() => ndcgAtK(relevant, [1], 0), /positive integer/);
});

function syntheticInputs() {
  const products = Array.from({ length: 30 }, (_unused, index) => ({
    id: index + 1,
    title: `Record ${index + 1}`,
    artist: `Artist ${Math.floor(index / 3)}`,
    genre: index % 2 === 0 ? "Jazz" : "Rock",
    year: 1960 + index,
    label: `Label ${index % 4}`,
    stock: "in",
  }));
  const interactions = [];
  for (let subject = 0; subject < 20; subject += 1) {
    for (let offset = 0; offset < 5; offset += 1) {
      const productPublicId = ((subject + offset) % 20) + 1;
      interactions.push({
        eventId: `${subject}-${offset}`,
        subjectId: `subject-${String(subject).padStart(2, "0")}`,
        type: offset % 2 === 0 ? "wishlist_add" : "cart_add",
        productPublicId,
        occurredAt: new Date(Date.UTC(2026, 0, offset + 1, subject)),
      });
    }
  }
  return { products, interactions };
}

test("offline benchmark uses one split, candidate policy, k, and user set for all three models", () => {
  const { products, interactions } = syntheticInputs();
  const dataset = buildEvaluationDataset(interactions, {
    itemUniverse: new Set(products.map((product) => product.id)),
  });
  const first = evaluateOffline(dataset, products, { k: 10, randomSeed: "fixed" });
  const second = evaluateOffline(dataset, products, { k: 10, randomSeed: "fixed" });
  assert.deepEqual(first, second, "evaluation must be deterministic for the stored seed");
  assert.equal(first.usersEvaluated, 20);
  assert.equal(first.k, 10);
  assert.deepEqual(first.models.map((model) => model.model), ["random", "popularity", "content-based"]);
  for (const model of first.models) {
    for (const key of ["ndcg@10", "map@10", "hitRate@10", "coverage"]) {
      assert.ok(model.metrics[key] >= 0 && model.metrics[key] <= 1, `${model.model} ${key}`);
    }
    assert.ok(Number.isFinite(model.metrics.novelty));
    assert.match(model.interpretation, /NDCG@10/);
  }
});

test("offline benchmark refuses to turn insufficient evidence into quality metrics", () => {
  const { products, interactions } = syntheticInputs();
  const dataset = buildEvaluationDataset(interactions.slice(0, 19), {
    itemUniverse: new Set(products.map((product) => product.id)),
  });
  assert.equal(dataset.status, "insufficient-evidence");
  assert.throws(() => evaluateOffline(dataset, products), /minimum evidence/);
});
