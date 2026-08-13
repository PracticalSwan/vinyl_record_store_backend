import test from "node:test";
import assert from "node:assert/strict";
import { createHistoricalEvaluationRepository } from "../src/repositories/historicalEvaluationRepository.js";

const DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v3";

function chain(finalValue) {
  const state = { select: null, sort: null, query: null, projection: null, cursorOptions: null };
  const value = {
    select(selection) { state.select = selection; return value; },
    sort(sort) { state.sort = sort; return value; },
    lean() { return value; },
    exec: async () => finalValue,
    cursor: (options) => { state.cursorOptions = options; return finalValue; },
  };
  return { value, state };
}

test("historical repository validation read filters out test rows and explicitly selects pseudonyms", async () => {
  const rows = [{
    datasetKey: DATASET_KEY,
    userKey: "1".padStart(64, "0"),
    productPublicId: 1,
    rating: 5,
    occurredAt: new Date("2020-01-01T00:00:00.000Z"),
    split: "train",
  }];
  const query = chain(rows);
  const ratingModel = {
    find(filter, projection) {
      query.state.query = filter;
      query.state.projection = projection;
      return query.value;
    },
  };
  const repository = createHistoricalEvaluationRepository({ historicalRatingModel: ratingModel }, async () => {});
  const subjects = await repository.readSubjects(DATASET_KEY, { splits: ["train", "validation"] });

  assert.equal(subjects.length, 1);
  assert.deepEqual(query.state.query, { datasetKey: DATASET_KEY, split: { $in: ["train", "validation"] } });
  assert.equal(query.state.select, "+userKey");
  assert.deepEqual(query.state.sort, { userKey: 1, occurredAt: 1, productPublicId: 1 });
  assert.deepEqual(query.state.cursorOptions, { batchSize: 1_000 });
  assert.equal(query.state.projection.externalItemKey, undefined);
});

test("historical repository projects only evaluation metadata and preserves research stock nullability", async () => {
  const query = chain([{
    datasetKey: DATASET_KEY,
    publicId: 100001,
    title: "Record",
    artist: null,
    genre: "Jazz",
    year: null,
    originalReleaseYear: 1965,
    label: null,
    stock: null,
  }]);
  const productModel = {
    find(filter, projection) {
      query.state.query = filter;
      query.state.projection = projection;
      return query.value;
    },
  };
  const repository = createHistoricalEvaluationRepository({ datasetProductModel: productModel }, async () => {});
  const result = await repository.readProducts(DATASET_KEY);

  assert.deepEqual(query.state.query, { datasetKey: DATASET_KEY, deletedAt: null });
  assert.equal(query.state.projection.externalItemKey, undefined);
  assert.deepEqual(result, [{
    datasetKey: DATASET_KEY,
    id: 100001,
    title: "Record",
    artist: null,
    genre: "Jazz",
    year: 1965,
    label: null,
    stock: null,
  }]);
});

test("historical repository masks persistence failures", async () => {
  const repository = createHistoricalEvaluationRepository({}, async () => {
    throw new Error("secret connection detail");
  });
  await assert.rejects(
    () => repository.getActiveDataset(),
    (error) => error.code === "PERSISTENCE_UNAVAILABLE" && !error.message.includes("secret"),
  );
});
