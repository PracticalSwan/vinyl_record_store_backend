import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import {
  AMAZON_DATASET_KEY,
  AMAZON_PRODUCT_COLLECTION,
  AMAZON_SOURCE,
  AMAZON_SOURCE_VERSION,
  readJsonlRows,
  verifySourceFile,
} from "../src/lib/dataset/amazonReviews2023.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { DatasetProduct } from "../src/models/DatasetProduct.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";
import {
  assertDatasetImportOwnership,
  assertDatasetImportEvidenceOwnership,
  canResumeInactiveImport,
  isSealedDatasetImport,
  sameDigestSet,
  validRecordDigest,
} from "../src/lib/dataset/integrity.js";

const apply = process.argv.includes("--apply");
const activate = process.argv.includes("--activate");
if (activate && !apply) throw new Error("--activate requires --apply.");

function batchOption(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1 || value > 5_000) {
    throw new Error(`--${name} must be an integer from 1 through 5000.`);
  }
  return value;
}

const productBatchSize = batchOption("product-batch", 500);
const ratingBatchSize = batchOption("rating-batch", 1_000);
const dataRoot = path.join(process.cwd(), "data", "amazon-reviews-2023");
const stagingRoot = path.join(dataRoot, "staging", AMAZON_DATASET_KEY);
const report = JSON.parse(await readFile(path.join(stagingRoot, "report.json"), "utf8"));
const config = JSON.parse(await readFile(path.join(dataRoot, "transformation-config.json"), "utf8"));
const identityRegistry = JSON.parse(await readFile(path.join(dataRoot, "product-identity-registry.json"), "utf8"));
const artworkEnrichment = JSON.parse(await readFile(path.join(dataRoot, "artwork-enrichment-v2.json"), "utf8"));
const canonicalConfigDigest = createHash("sha256").update(JSON.stringify({
  config,
  identityRegistryDigest: identityRegistry.entriesDigest,
  artworkEntriesDigest: artworkEnrichment.entriesDigest,
})).digest("hex");
if (
  report.datasetKey !== AMAZON_DATASET_KEY
  || config.datasetKey !== AMAZON_DATASET_KEY
  || artworkEnrichment.datasetKey !== AMAZON_DATASET_KEY
  || report.configDigest !== canonicalConfigDigest
  || report.identityRegistry?.entriesDigest !== identityRegistry.entriesDigest
  || report.artwork?.entriesDigest !== artworkEnrichment.entriesDigest
) {
  throw new Error("Staging does not match the committed v2 configuration, identity registry, and artwork manifest.");
}

const productsPath = path.join(stagingRoot, "products.jsonl");
const ratingsPath = path.join(stagingRoot, "ratings.jsonl");
if (!report.stagingFiles) throw new Error("Staging report does not contain output checksums.");
await Promise.all([
  verifySourceFile(productsPath, report.stagingFiles.products),
  verifySourceFile(ratingsPath, report.stagingFiles.ratings),
]);

let productCount = 0;
let ratingCount = 0;
const uniqueUsers = new Set();
const productIds = new Set();
const expectedProductDigests = new Set();
const expectedRatingDigests = new Set();
const ratingKeys = new Set();
for await (const product of readJsonlRows(productsPath, "staged product")) {
  if (
    product.datasetKey !== AMAZON_DATASET_KEY
    || !validRecordDigest(product)
    || productIds.has(product.publicId)
  ) throw new Error("A staged product has invalid version ownership, digest, or duplicate public ID.");
  productIds.add(product.publicId);
  expectedProductDigests.add(product.recordDigest);
  productCount += 1;
}
for await (const rating of readJsonlRows(ratingsPath, "staged rating")) {
  const ratingKey = `${rating.userKey}:${rating.productPublicId}`;
  if (
    rating.datasetKey !== AMAZON_DATASET_KEY
    || !validRecordDigest(rating)
    || !productIds.has(rating.productPublicId)
    || ratingKeys.has(ratingKey)
  ) throw new Error("A staged rating has invalid version ownership, digest, or product reference.");
  ratingKeys.add(ratingKey);
  expectedRatingDigests.add(rating.recordDigest);
  uniqueUsers.add(rating.userKey);
  ratingCount += 1;
}
if (productCount !== report.staged.products || ratingCount !== report.staged.ratings) {
  throw new Error("Staging counts do not match report.json.");
}

const summary = {
  mode: apply ? "apply" : "dry-run",
  activate,
  datasetKey: AMAZON_DATASET_KEY,
  productCollection: AMAZON_PRODUCT_COLLECTION,
  products: productCount,
  users: uniqueUsers.size,
  ratings: ratingCount,
  batchSizes: { products: productBatchSize, ratings: ratingBatchSize },
};
if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

async function writeImmutableRows(filePath, label, model, batchSize, identityFilter, transform = (value) => value) {
  let batch = [];
  for await (const row of readJsonlRows(filePath, label)) {
    batch.push(row);
    if (batch.length < batchSize) continue;
    const current = batch;
    await model.bulkWrite(current.map((value) => ({
      updateOne: {
        filter: identityFilter(value),
        update: { $setOnInsert: transform(value) },
        upsert: true,
      },
    })), { ordered: false });
    batch = [];
  }
  if (batch.length) {
    await model.bulkWrite(batch.map((value) => ({
      updateOne: {
        filter: identityFilter(value),
        update: { $setOnInsert: transform(value) },
        upsert: true,
      },
    })), { ordered: false });
  }
}

async function assertPersistedRowsMatchStaging() {
  const [storedProducts, storedRatings, storedUsers, storedProductDigests, storedRatingDigests] = await Promise.all([
    DatasetProduct.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.collection.distinct("userKey", { datasetKey: AMAZON_DATASET_KEY }),
    DatasetProduct.distinct("recordDigest", { datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.distinct("recordDigest", { datasetKey: AMAZON_DATASET_KEY }).exec(),
  ]);
  if (
    storedProducts !== productCount
    || storedRatings !== ratingCount
    || storedUsers.length !== uniqueUsers.size
    || !sameDigestSet(storedProductDigests, expectedProductDigests)
    || !sameDigestSet(storedRatingDigests, expectedRatingDigests)
  ) throw new Error("Persisted immutable dataset rows do not exactly match the validated staging report.");
}

async function activateCompleted(connection) {
  await connection.transaction(async (session) => {
    await DatasetImport.updateMany(
      { active: true, datasetKey: { $ne: AMAZON_DATASET_KEY } },
      { $set: { active: false, status: "superseded" } },
      { session },
    );
    const activation = await DatasetImport.updateOne(
      {
        datasetKey: AMAZON_DATASET_KEY,
        status: { $in: ["completed", "active", "superseded"] },
        sealedAt: { $ne: null },
      },
      { $set: { active: true, status: "active", activatedAt: new Date() } },
      { session },
    );
    if (activation.matchedCount !== 1) throw new Error("The sealed dataset import could not be activated.");
  });
}

try {
  const connection = await connectMongoDB();
  await Promise.all([
    DatasetImport.createIndexes(),
    DatasetProduct.createIndexes(),
    HistoricalAmazonRating.createIndexes(),
  ]);
  let existing = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().exec();
  assertDatasetImportOwnership(existing, {
    configDigest: report.configDigest,
    productCollection: AMAZON_PRODUCT_COLLECTION,
    sourceVersion: AMAZON_SOURCE_VERSION,
  });
  assertDatasetImportEvidenceOwnership(existing, {
    identityRegistryDigest: report.identityRegistry.entriesDigest,
    artworkEntriesDigest: report.artwork.entriesDigest,
    sourceFiles: report.sourceFiles,
    stagingFiles: report.stagingFiles,
  });

  const sealed = isSealedDatasetImport(existing);
  if (existing && !sealed && !canResumeInactiveImport(existing)) {
    throw new Error("The existing unsealed dataset import is not in a resumable inactive state.");
  }
  if (!sealed) {
    await DatasetImport.findOneAndUpdate(
      { datasetKey: AMAZON_DATASET_KEY },
      {
        $setOnInsert: {
          datasetKey: AMAZON_DATASET_KEY,
          source: AMAZON_SOURCE,
          sourceVersion: AMAZON_SOURCE_VERSION,
          productCollection: AMAZON_PRODUCT_COLLECTION,
          sourceFiles: report.sourceFiles,
          stagingFiles: report.stagingFiles,
          configDigest: report.configDigest,
          identityRegistryDigest: report.identityRegistry.entriesDigest,
          artworkEntriesDigest: report.artwork.entriesDigest,
          pseudonymKeyFingerprint: report.pseudonymKeyFingerprint,
          stagedAt: new Date(report.generatedAt),
        },
        $set: {
          status: "importing",
          active: false,
          counts: { products: 0, users: 0, ratings: 0 },
          completedAt: null,
          sealedAt: null,
          activatedAt: null,
          failure: null,
        },
      },
      { upsert: true, runValidators: true },
    );

    await writeImmutableRows(
      productsPath,
      "staged product",
      DatasetProduct,
      productBatchSize,
      (product) => ({ datasetKey: AMAZON_DATASET_KEY, externalItemKey: product.externalItemKey }),
    );
    await writeImmutableRows(
      ratingsPath,
      "staged rating",
      HistoricalAmazonRating,
      ratingBatchSize,
      (rating) => ({
        datasetKey: AMAZON_DATASET_KEY,
        userKey: rating.userKey,
        productPublicId: rating.productPublicId,
      }),
      (rating) => ({ ...rating, occurredAt: new Date(rating.occurredAt) }),
    );

    await assertPersistedRowsMatchStaging();

    const completed = new Date();
    const completion = await DatasetImport.updateOne(
      { datasetKey: AMAZON_DATASET_KEY, status: "importing", active: false },
      {
        $set: {
          status: "completed",
          counts: { products: productCount, users: uniqueUsers.size, ratings: ratingCount },
          completedAt: completed,
          sealedAt: completed,
          failure: null,
        },
      },
    );
    if (completion.matchedCount !== 1) {
      throw new Error("The inactive dataset import changed before it could be sealed.");
    }
    existing = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().exec();
    if (!isSealedDatasetImport(existing)) {
      throw new Error("The completed dataset import did not persist its immutable seal.");
    }
  } else {
    await assertPersistedRowsMatchStaging();
    if (
      existing.counts?.products !== productCount
      || existing.counts?.users !== uniqueUsers.size
      || existing.counts?.ratings !== ratingCount
    ) throw new Error("The sealed dataset import counts do not match validated staging.");
  }

  if (activate) await activateCompleted(connection);
  console.log(JSON.stringify({
    ...summary,
    status: activate ? "active" : existing?.status || "completed",
    immutableExisting: sealed,
  }, null, 2));
} catch (error) {
  const current = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().catch(() => null);
  if (current && !current.sealedAt && !current.active) {
    await DatasetImport.updateOne(
      { datasetKey: AMAZON_DATASET_KEY, sealedAt: null, active: false },
      { $set: { status: "failed", failure: String(error?.message || error).slice(0, 500) } },
    ).catch(() => {});
  }
  throw error;
} finally {
  await disconnectMongoDB();
}
