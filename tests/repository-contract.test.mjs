import test from "node:test";
import assert from "node:assert/strict";
import { catalogRecords as records } from "../src/data/catalogRecords.js";
import { toPersistenceProduct } from "../src/repositories/catalogMapping.js";
import { createMongoCatalogRepository } from "../src/repositories/mongoCatalogRepository.js";
import { seedCatalogRepository } from "../src/repositories/seedCatalogRepository.js";

const documents = records.map(toPersistenceProduct);

function matchesCondition(value, condition) {
  if (condition instanceof RegExp) return condition.test(value);
  if (condition && typeof condition === "object") {
    if (condition.$in && !condition.$in.includes(value)) return false;
    if (condition.$ne !== undefined && value === condition.$ne) return false;
    if (condition.$gte !== undefined && value < condition.$gte) return false;
    if (condition.$lte !== undefined && value > condition.$lte) return false;
    if (condition.$lt !== undefined && value >= condition.$lt) return false;
    return true;
  }
  return value === condition;
}

function matchesFilter(document, filter) {
  if (filter.$or && !filter.$or.some((clause) => matchesFilter(document, clause))) return false;
  if (filter.$and && !filter.$and.every((clause) => matchesFilter(document, clause))) return false;
  return Object.entries(filter).every(([field, condition]) => (
    field.startsWith("$") || matchesCondition(document[field], condition)
  ));
}

function makeListQuery(source) {
  let values = [...source];
  return {
    sort(specification) {
      const entries = Object.entries(specification);
      values.sort((left, right) => {
        for (const [field, direction] of entries) {
          const compared = typeof left[field] === "string"
            ? left[field].localeCompare(right[field])
            : left[field] - right[field];
          if (compared) return compared * direction;
        }
        return 0;
      });
      return this;
    },
    skip(count) { values = values.slice(count); return this; },
    limit(count) { values = values.slice(0, count); return this; },
    lean() { return this; },
    async exec() { return values; },
  };
}

const group = (field) => Object.entries(documents.reduce((result, document) => ({
  ...result,
  [document[field]]: (result[document[field]] || 0) + 1,
}), {})).map(([_id, count]) => ({ _id: field === "year" ? Number(_id) : _id, count }));

const fakeModel = {
  findOne(filter) {
    const value = documents.find((document) => matchesFilter(document, filter)) || null;
    return { lean: () => ({ exec: async () => value }) };
  },
  find(filter) { return makeListQuery(documents.filter((document) => matchesFilter(document, filter))); },
  countDocuments(filter) {
    return { exec: async () => documents.filter((document) => matchesFilter(document, filter)).length };
  },
  aggregate() {
    return {
      exec: async () => [{
        genres: group("genre"),
        conditions: group("condition"),
        stock: group("stock"),
        formats: group("format"),
        prices: [{
          _id: null,
          min: Math.min(...documents.map((document) => document.price)),
          max: Math.max(...documents.map((document) => document.price)),
        }],
        years: group("year"),
      }],
    };
  },
};

const baseQuery = {
  page: 1,
  limit: 24,
  q: "",
  genres: [],
  artist: "",
  label: "",
  conditions: [],
  formats: [],
  eras: [],
  minPrice: null,
  maxPrice: null,
  inStock: "",
  sort: "newest",
};

const cases = [
  baseQuery,
  { ...baseQuery, page: 2, limit: 10 },
  { ...baseQuery, genres: ["Jazz", "Rock"], conditions: ["NM", "VG+"] },
  { ...baseQuery, eras: ["1970s", "2000s+"], inStock: "true" },
  { ...baseQuery, q: ".*", page: 4, limit: 10 },
  { ...baseQuery, minPrice: 40, maxPrice: 50, sort: "price-desc" },
  { ...baseQuery, artist: "miles", label: "columbia", sort: "artist-asc" },
];

test("seed and MongoDB repositories share filter, sort, facet, and pagination contracts", async () => {
  const mongo = createMongoCatalogRepository(fakeModel, async () => {});
  for (const query of cases) {
    assert.deepEqual(await mongo.findProducts(query), await seedCatalogRepository.findProducts(query));
  }
  assert.deepEqual(await mongo.findByPublicId(1), await seedCatalogRepository.findByPublicId(1));
});

test("seed and MongoDB repositories expose the same bounded recommendation candidates", async () => {
  const mongo = createMongoCatalogRepository(fakeModel, async () => {});
  assert.deepEqual(
    await mongo.listRecommendationCandidates(),
    await seedCatalogRepository.listRecommendationCandidates(),
  );
});

test("MongoDB recommendation candidates reuse one short-lived repository read", async () => {
  let candidateReads = 0;
  let currentTime = 1_000;
  const countingModel = {
    ...fakeModel,
    find(filter) {
      candidateReads += 1;
      return fakeModel.find(filter);
    },
  };
  const mongo = createMongoCatalogRepository(
    countingModel,
    async () => {},
    null,
    countingModel,
    { now: () => currentTime, recommendationCandidateCacheTtlMs: 60_000 },
  );

  const first = await mongo.listRecommendationCandidates();
  const second = await mongo.listRecommendationCandidates();

  assert.equal(candidateReads, 1);
  assert.deepEqual(second, first);

  currentTime += 60_001;
  const refreshed = await mongo.listRecommendationCandidates();
  assert.equal(candidateReads, 2);
  assert.deepEqual(refreshed, first);
});

test("MongoDB recommendation candidate invalidation detaches an older in-flight read", async () => {
  let candidateReads = 0;
  let releaseFirstRead;
  let firstReadStartedResolve;
  const firstReadStarted = new Promise((resolve) => {
    firstReadStartedResolve = resolve;
  });
  const firstBatch = [documents[0]];
  const secondBatch = [documents[1]];
  const firstBatchPromise = new Promise((resolve) => {
    releaseFirstRead = () => resolve(firstBatch);
  });
  const current = { ...documents[0], updatedAt: new Date("2026-08-29T00:00:00.000Z") };
  const mutationModel = {
    ...fakeModel,
    find() {
      candidateReads += 1;
      const values = candidateReads === 1 ? firstBatchPromise : Promise.resolve(secondBatch);
      if (candidateReads === 1) firstReadStartedResolve();
      return {
        sort() { return this; },
        limit() { return this; },
        lean() { return this; },
        async exec() { return values; },
      };
    },
    findOne() {
      return { lean: async () => current };
    },
    findOneAndUpdate() {
      return {
        lean: async () => ({
          ...current,
          title: "Updated title",
          updatedAt: new Date("2026-08-29T00:00:01.000Z"),
        }),
      };
    },
  };
  const mongo = createMongoCatalogRepository(mutationModel, async () => {}, null, mutationModel);

  const olderRead = mongo.listRecommendationCandidates();
  await firstReadStarted;
  const update = await mongo.updateProduct(1, { title: "Updated title" });
  assert.equal(update.status, "ok");

  const postMutationRead = mongo.listRecommendationCandidates();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(candidateReads, 2);

  releaseFirstRead();
  const [olderCandidates, postMutationCandidates] = await Promise.all([olderRead, postMutationRead]);
  assert.equal(olderCandidates[0].id, firstBatch[0].publicId);
  assert.equal(postMutationCandidates[0].id, secondBatch[0].publicId);
});

test("MongoDB repository connection failures are mapped to a safe 503 error", async () => {
  const mongo = createMongoCatalogRepository(fakeModel, async () => {
    throw new Error("credentials must not escape");
  });
  await assert.rejects(
    () => mongo.findByPublicId(1),
    (error) => error.code === "PERSISTENCE_UNAVAILABLE" && !error.message.includes("credentials"),
  );
});
