import test from "node:test";
import assert from "node:assert/strict";
import {
  AMAZON_DATASET_KEY,
  classifyVinylMetadata,
  createDatasetUserKey,
  normalizeAmazonProduct,
  parseRatingCsvLine,
  splitUserRatings,
  stableProductPublicId,
  trainCore,
} from "../src/lib/dataset/amazonReviews2023.js";
import {
  buildHistoricalEvaluationSubject,
  summarizeHistoricalEvaluationReadiness,
} from "../src/lib/dataset/historicalEvaluationAdapter.js";
import { datasetImportSchema } from "../src/models/DatasetImport.js";
import { historicalAmazonRatingSchema } from "../src/models/HistoricalAmazonRating.js";
import { vinylRecordSchema } from "../src/models/VinylRecord.js";
import { buildMongoCatalogFilter } from "../src/repositories/mongoCatalogRepository.js";
import { toPublicProduct } from "../src/repositories/catalogMapping.js";
import { recommendForUser } from "../src/lib/recommender/contentBased.js";

const secret = "dataset-test-secret-with-at-least-thirty-two-characters";
const userKey = "a".repeat(64);

function rating(productPublicId, split, value, day, overrides = {}) {
  return {
    datasetKey: AMAZON_DATASET_KEY,
    userKey,
    productPublicId,
    rating: value,
    occurredAt: `2020-01-${String(day).padStart(2, "0")}T00:00:00.000Z`,
    split,
    ...overrides,
  };
}

test("source rating parser validates schema, rating range, and timestamps", () => {
  assert.deepEqual(
    parseRatingCsvLine("AEEXAMPLE,B000000001,4,1577836800000"),
    { userId: "AEEXAMPLE", parentAsin: "B000000001", rating: 4, timestamp: 1577836800000 },
  );
  assert.throws(() => parseRatingCsvLine("AEEXAMPLE,B000000001,6,1577836800000"), /Invalid rating/);
  assert.throws(() => parseRatingCsvLine(`AEEXAMPLE,B000000001,4,${Date.now() + 172_800_000}`), /Invalid rating/);
  assert.throws(() => parseRatingCsvLine("AEEXAMPLE,wrong,4,1577836800000"), /Invalid rating-only/);
});

test("vinyl classification is deterministic and excludes an explicit CD format", () => {
  const vinyl = classifyVinylMetadata({
    categories: ["CDs & Vinyl", "Vinyl Records"],
    store: "Example Artist Format: Vinyl",
    details: { Format: "Vinyl" },
  });
  assert.equal(vinyl.accepted, true);
  assert.equal(vinyl.confidence, "high");
  assert.equal(classifyVinylMetadata({
    categories: ["CDs & Vinyl"],
    store: "Example Artist Format: CD",
    details: { Format: "Audio CD" },
  }).accepted, false);
});

test("product normalization preserves source truth and does not simulate store fields", () => {
  const product = normalizeAmazonProduct({
    parent_asin: "B000000001",
    title: "Unicode Album – Edition",
    store: "Example Artist Format: Vinyl",
    categories: ["CDs & Vinyl", "Jazz", "Vinyl Records"],
    price: 29.99,
    details: { "Original Release Date": "1965", Label: "Example Label", "Number of discs": "2" },
  }, 100_001);
  assert.equal(product.artist, "Example Artist");
  assert.equal(product.genre, "Jazz");
  assert.equal(product.format, "Vinyl");
  assert.equal(product.price, null);
  assert.equal(product.currency, null);
  assert.equal(product.stock, null);
  assert.equal(product.condition, null);
  assert.equal(product.imageUrl, null);
  assert.equal(product.fieldOrigins.stock, "unknown");
  assert.equal(product.fieldOrigins.price, "unknown");
  assert.ok(product.qualityFlags.includes("source-reference-price-excluded-from-store-price"));
  assert.equal(product.provenance[0].sourceId, "B000000001");
});

test("product normalization does not treat Amazon availability dates as release years", () => {
  const product = normalizeAmazonProduct({
    parent_asin: "B000000002",
    title: "Availability Is Not Release",
    categories: ["Vinyl Records"],
    details: { "Date First Available": "2021-04-10" },
  }, 100_002);
  assert.equal(product.year, null);
});

test("pseudonyms and numeric product IDs are stable without exposing source IDs", () => {
  const first = createDatasetUserKey("SOURCE-USER-1", secret);
  const second = createDatasetUserKey("SOURCE-USER-1", secret);
  assert.equal(first, second);
  assert.match(first, /^[0-9a-f]{64}$/);
  assert.equal(first.includes("SOURCE-USER-1"), false);

  const occupied = new Set([stableProductPublicId("B000000001")]);
  const collisionResolved = stableProductPublicId("B000000001", occupied);
  assert.ok(collisionResolved >= 100_000);
  assert.notEqual(collisionResolved, [...occupied][0]);
});

test("chronological split and train-only core filtering are deterministic", () => {
  const split = splitUserRatings([
    { timestamp: 3, productPublicId: 3 },
    { timestamp: 1, productPublicId: 1 },
    { timestamp: 2, productPublicId: 2 },
  ]);
  assert.deepEqual(split.map((row) => row.split), ["train", "validation", "test"]);
  const rows = [
    { userKey: "a", productPublicId: 1, split: "train" },
    { userKey: "a", productPublicId: 2, split: "validation" },
    { userKey: "b", productPublicId: 1, split: "train" },
  ];
  assert.deepEqual(trainCore(rows, 2), []);
});

test("historical evaluation adapter separates training and held-out positives", () => {
  const rows = [
    rating(1, "train", 5, 1),
    rating(2, "train", 2, 2),
    rating(3, "train", 4, 3),
    rating(4, "validation", 3, 4),
    rating(5, "test", 5, 5),
  ];
  const subject = buildHistoricalEvaluationSubject(userKey, rows);
  assert.equal(subject.eligible, true);
  assert.deepEqual(subject.validationRelevantProductIds, []);
  assert.deepEqual(subject.testRelevantProductIds, [5]);
  assert.equal(subject.training.some((row) => row.productId === 5), false);
});

test("historical readiness is aggregate-only and rejects leakage-shaped duplicates", async () => {
  const rows = [
    rating(1, "train", 5, 1),
    rating(2, "train", 2, 2),
    rating(3, "train", 4, 3),
    rating(4, "test", 5, 4),
  ];
  const summary = await summarizeHistoricalEvaluationReadiness(rows, {
    datasetKey: AMAZON_DATASET_KEY,
    minimumEligibleSubjects: 1,
  });
  assert.equal(summary.status, "ready");
  assert.equal(summary.aggregateOnly, true);
  assert.equal(JSON.stringify(summary).includes(userKey), false);
  assert.equal(summary.eligibleSubjects, 1);
  await assert.rejects(
    () => summarizeHistoricalEvaluationReadiness([
      ...rows,
      rating(1, "test", 5, 5),
    ], { datasetKey: AMAZON_DATASET_KEY }),
    /duplicate user-item pair/,
  );
});

test("dataset schemas enforce version ownership and historical rows have no TTL", () => {
  assert.ok(datasetImportSchema.indexes().some(([fields, options]) => (
    fields.active === 1 && options.unique && options.partialFilterExpression?.active === true
  )));
  assert.ok(vinylRecordSchema.indexes().some(([fields, options]) => (
    fields.datasetKey === 1 && fields.externalItemKey === 1 && options.unique
  )));
  assert.equal(
    historicalAmazonRatingSchema.indexes().some(([, options]) => "expireAfterSeconds" in options),
    false,
  );
  assert.equal(historicalAmazonRatingSchema.get("collection"), "historicalAmazonRatings");
});

test("dataset-backed catalog filtering and public nullability remain explicit", () => {
  const filter = buildMongoCatalogFilter({
    q: "", genres: [], formats: [], eras: [], conditions: [],
    artist: "", label: "", minPrice: null, maxPrice: null, inStock: "",
  }, { datasetKey: AMAZON_DATASET_KEY });
  assert.equal(filter.datasetKey, AMAZON_DATASET_KEY);
  const product = toPublicProduct({
    publicId: 100_001,
    title: "Source Album",
    artist: null,
    price: null,
    currency: null,
    stock: null,
    condition: null,
    datasetKey: AMAZON_DATASET_KEY,
    source: "amazon-reviews-2023",
  });
  assert.equal(product.artist, null);
  assert.equal(product.price, null);
  assert.equal(product.currency, null);
  assert.equal(product.stock, null);
});

test("legacy showcase IDs are not remapped onto active dataset products", async () => {
  const repository = {
    listRecommendationCandidates: async () => [
      { id: 100_001, title: "Dataset Album", artist: null, genre: null, year: null, stock: null },
    ],
  };
  const result = await recommendForUser({ kind: "demo", responseUserId: "demo-user" }, 8, { repository });
  assert.equal(result.mode, "cold-start");
  assert.match(result.profileSummary[0], /legacy showcase profile/i);
  assert.equal(result.recommendations[0].score, 0);
  assert.equal(result.recommendations[0].product.id, 100_001);
});
