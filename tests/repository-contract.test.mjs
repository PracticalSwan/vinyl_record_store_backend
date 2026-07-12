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

test("MongoDB repository connection failures are mapped to a safe 503 error", async () => {
  const mongo = createMongoCatalogRepository(fakeModel, async () => {
    throw new Error("credentials must not escape");
  });
  await assert.rejects(
    () => mongo.findByPublicId(1),
    (error) => error.code === "PERSISTENCE_UNAVAILABLE" && !error.message.includes("credentials"),
  );
});
