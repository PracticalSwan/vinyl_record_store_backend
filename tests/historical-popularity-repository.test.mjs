import test from "node:test";
import assert from "node:assert/strict";
import { createHistoricalPopularityRepository } from "../src/repositories/historicalPopularityRepository.js";

test("historical popularity aggregation is scoped to the requested dataset key and exposes no identity fields", async () => {
  let connected = 0;
  let pipeline;
  const model = {
    aggregate(value) {
      pipeline = value;
      return { exec: async () => [{ productPublicId: 7, ratingCount: 3, meanRating: 4.5 }] };
    },
  };
  const repository = createHistoricalPopularityRepository(model, async () => { connected += 1; });
  const result = await repository.listByDatasetKey("release-v3");

  assert.equal(connected, 1);
  assert.deepEqual(result, [{ productPublicId: 7, ratingCount: 3, meanRating: 4.5 }]);
  assert.deepEqual(pipeline[0], { $match: { datasetKey: "release-v3" } });
  assert.equal(pipeline[2].$project.userKey, undefined);
  assert.equal(pipeline[2].$project.datasetKey, undefined);
});

test("seed and null dataset keys do not trigger a historical read", async () => {
  let connected = false;
  const repository = createHistoricalPopularityRepository(
    { aggregate: () => { throw new Error("must not read"); } },
    async () => { connected = true; },
  );
  assert.deepEqual(await repository.listByDatasetKey(null), []);
  assert.equal(connected, false);
});
