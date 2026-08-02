import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import {
  AMAZON_DATASET_KEY,
  AMAZON_SOURCE,
  AMAZON_SOURCE_VERSION,
  readJsonlRows,
  verifySourceFile,
} from "../src/lib/dataset/amazonReviews2023.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";
import { VinylRecord } from "../src/models/VinylRecord.js";

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
const root = path.join(process.cwd(), "data", "amazon-reviews-2023", "staging", AMAZON_DATASET_KEY);
const report = JSON.parse(await readFile(path.join(root, "report.json"), "utf8"));
const config = JSON.parse(await readFile(
  path.join(process.cwd(), "data", "amazon-reviews-2023", "transformation-config.json"),
  "utf8",
));
const canonicalConfigDigest = createHash("sha256").update(JSON.stringify(config)).digest("hex");
if (report.datasetKey !== AMAZON_DATASET_KEY || report.configDigest !== canonicalConfigDigest) {
  throw new Error("Staging does not match the committed transformation configuration.");
}
const productsPath = path.join(root, "products.jsonl");
const ratingsPath = path.join(root, "ratings.jsonl");
if (!report.stagingFiles) throw new Error("Staging report does not contain output checksums.");
await Promise.all([
  verifySourceFile(productsPath, report.stagingFiles.products),
  verifySourceFile(ratingsPath, report.stagingFiles.ratings),
]);
let productCount = 0;
let ratingCount = 0;
const uniqueUsers = new Set();
for await (const product of readJsonlRows(productsPath, "staged product")) {
  if (product.datasetKey !== AMAZON_DATASET_KEY) throw new Error("Staged product has the wrong dataset key.");
  productCount += 1;
}
for await (const rating of readJsonlRows(ratingsPath, "staged rating")) {
  if (rating.datasetKey !== AMAZON_DATASET_KEY) throw new Error("Staged rating has the wrong dataset key.");
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
  products: productCount,
  users: uniqueUsers.size,
  ratings: ratingCount,
  batchSizes: { products: productBatchSize, ratings: ratingBatchSize },
};
if (!apply) {
  console.log(JSON.stringify(summary, null, 2));
  process.exit(0);
}

try {
  const connection = await connectMongoDB();
  const existing = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().exec();
  if (existing?.configDigest && existing.configDigest !== report.configDigest) {
    throw new Error("This dataset key already belongs to a different transformation configuration.");
  }
  const wasActive = existing?.active === true && existing?.status === "active";
  await Promise.all([
    DatasetImport.createIndexes(),
    VinylRecord.createIndexes(),
    HistoricalAmazonRating.createIndexes(),
  ]);
  await DatasetImport.findOneAndUpdate(
    { datasetKey: AMAZON_DATASET_KEY },
    {
      $set: {
        source: AMAZON_SOURCE,
        sourceVersion: AMAZON_SOURCE_VERSION,
        status: wasActive ? "active" : "importing",
        active: wasActive,
        counts: wasActive ? existing.counts : { products: 0, users: 0, ratings: 0 },
        sourceFiles: report.sourceFiles,
        stagingFiles: report.stagingFiles,
        configDigest: report.configDigest,
        pseudonymKeyFingerprint: report.pseudonymKeyFingerprint,
        stagedAt: new Date(report.generatedAt),
        completedAt: wasActive ? existing.completedAt : null,
        activatedAt: wasActive ? existing.activatedAt : null,
        failure: null,
      },
    },
    { upsert: true, runValidators: true },
  );
  let productBatch = [];
  for await (const product of readJsonlRows(productsPath, "staged product")) {
    productBatch.push(product);
    if (productBatch.length < productBatchSize) continue;
    const batch = productBatch;
    await VinylRecord.bulkWrite(batch.map((product) => ({
      updateOne: {
        filter: { datasetKey: AMAZON_DATASET_KEY, externalItemKey: product.externalItemKey },
        update: { $set: product },
        upsert: true,
      },
    })), { ordered: false });
    productBatch = [];
  }
  if (productBatch.length) {
    await VinylRecord.bulkWrite(productBatch.map((product) => ({
      updateOne: {
        filter: { datasetKey: AMAZON_DATASET_KEY, externalItemKey: product.externalItemKey },
        update: { $set: product },
        upsert: true,
      },
    })), { ordered: false });
  }
  let ratingBatch = [];
  for await (const rating of readJsonlRows(ratingsPath, "staged rating")) {
    ratingBatch.push(rating);
    if (ratingBatch.length < ratingBatchSize) continue;
    const batch = ratingBatch;
    await HistoricalAmazonRating.bulkWrite(batch.map((rating) => ({
      updateOne: {
        filter: {
          datasetKey: AMAZON_DATASET_KEY,
          userKey: rating.userKey,
          productPublicId: rating.productPublicId,
        },
        update: { $set: { ...rating, occurredAt: new Date(rating.occurredAt) } },
        upsert: true,
      },
    })), { ordered: false });
    ratingBatch = [];
  }
  if (ratingBatch.length) {
    await HistoricalAmazonRating.bulkWrite(ratingBatch.map((rating) => ({
      updateOne: {
        filter: {
          datasetKey: AMAZON_DATASET_KEY,
          userKey: rating.userKey,
          productPublicId: rating.productPublicId,
        },
        update: { $set: { ...rating, occurredAt: new Date(rating.occurredAt) } },
        upsert: true,
      },
    })), { ordered: false });
  }
  const [storedProducts, storedRatings, storedUsers] = await Promise.all([
    VinylRecord.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.collection.distinct("userKey", { datasetKey: AMAZON_DATASET_KEY }),
  ]);
  if (storedProducts !== productCount || storedRatings !== ratingCount || storedUsers.length !== uniqueUsers.size) {
    throw new Error("Persisted dataset counts do not match the validated staging report.");
  }
  const completed = new Date();
  await DatasetImport.updateOne(
    { datasetKey: AMAZON_DATASET_KEY },
    {
      $set: {
        status: wasActive ? "active" : "completed",
        counts: { products: productCount, users: uniqueUsers.size, ratings: ratingCount },
        completedAt: completed,
      },
    },
  );
  if (activate) {
    await connection.transaction(async (session) => {
      await DatasetImport.updateMany(
        { active: true, datasetKey: { $ne: AMAZON_DATASET_KEY } },
        { $set: { active: false, status: "superseded" } },
        { session },
      );
      const activation = await DatasetImport.updateOne(
        { datasetKey: AMAZON_DATASET_KEY, status: { $in: ["completed", "active"] } },
        { $set: { active: true, status: "active", activatedAt: new Date() } },
        { session },
      );
      if (activation.matchedCount !== 1) throw new Error("Completed dataset import could not be activated.");
    });
  }
  console.log(JSON.stringify({ ...summary, status: activate ? "active" : "completed" }, null, 2));
} catch (error) {
  const current = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().catch(() => null);
  await DatasetImport.updateOne(
    { datasetKey: AMAZON_DATASET_KEY },
    { $set: {
      active: current?.active === true,
      status: current?.active === true ? "active" : "failed",
      failure: String(error?.message || error).slice(0, 500),
    } },
  ).catch(() => {});
  throw error;
} finally {
  await disconnectMongoDB();
}
