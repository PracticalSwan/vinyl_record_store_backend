import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AMAZON_DATASET_KEY,
  createDatasetUserKey,
  normalizeAmazonProduct,
  pseudonymKeyFingerprint,
  readMetadataRows,
  readRatingRows,
  splitUserRatings,
  stableProductPublicId,
  trainCore,
  verifySourceFile,
  sha256File,
} from "../src/lib/dataset/amazonReviews2023.js";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "data", "amazon-reviews-2023");
const MANIFEST_PATH = path.join(DATA_ROOT, "source-manifest.json");
const CONFIG_PATH = path.join(DATA_ROOT, "transformation-config.json");
const STAGING_ROOT = path.join(DATA_ROOT, "staging", AMAZON_DATASET_KEY);

function option(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

const transformationConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
if (transformationConfig.datasetKey !== AMAZON_DATASET_KEY) {
  throw new Error("Transformation config datasetKey is unsupported.");
}
const targetProducts = option("products", transformationConfig.targetProducts);
const maximumUsers = option("users", transformationConfig.maximumUsers);
const minimumCore = option("core", transformationConfig.trainCoreMinimum);
const profileOnly = process.argv.includes("--profile-only");
const secret = process.env.DATASET_PSEUDONYM_KEY || process.env.AUTH_SECRET;
if (!profileOnly && (!secret || secret.length < 32)) {
  throw new Error("Staging requires DATASET_PSEUDONYM_KEY or AUTH_SECRET with at least 32 characters.");
}

const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
if (manifest.datasetKey !== AMAZON_DATASET_KEY) throw new Error("Source manifest datasetKey is unsupported.");
const metadataPath = path.join(DATA_ROOT, manifest.files.metadata.relativePath);
const ratingsPath = path.join(DATA_ROOT, manifest.files.ratings.relativePath);
const verified = {
  metadata: await verifySourceFile(metadataPath, manifest.files.metadata),
  ratings: await verifySourceFile(ratingsPath, manifest.files.ratings),
};

async function writeJsonl(filePath, rows) {
  const output = createWriteStream(filePath, { encoding: "utf8" });
  for (const row of rows) {
    if (!output.write(`${JSON.stringify(row)}\n`)) await once(output, "drain");
  }
  output.end();
  await once(output, "finish");
}

const ratedItems = new Set();
const sourceUsers = new Set();
const userActivity = new Map();
const itemActivity = new Map();
const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
let sourceRatingCount = 0;
let minimumTimestamp = Number.POSITIVE_INFINITY;
let maximumTimestamp = Number.NEGATIVE_INFINITY;
for await (const row of readRatingRows(ratingsPath)) {
  ratedItems.add(row.parentAsin);
  sourceUsers.add(row.userId);
  userActivity.set(row.userId, (userActivity.get(row.userId) || 0) + 1);
  itemActivity.set(row.parentAsin, (itemActivity.get(row.parentAsin) || 0) + 1);
  ratingDistribution[row.rating] += 1;
  minimumTimestamp = Math.min(minimumTimestamp, row.timestamp);
  maximumTimestamp = Math.max(maximumTimestamp, row.timestamp);
  sourceRatingCount += 1;
}

let metadataCount = 0;
let ratedMetadataCount = 0;
let vinylCandidateCount = 0;
const metadataCoverage = {
  title: 0,
  store: 0,
  price: 0,
  images: 0,
  categories: 0,
  details: 0,
};
const candidateByExternalItemKey = new Map();
let duplicateVinylMetadataRows = 0;
for await (const metadata of readMetadataRows(metadataPath)) {
  metadataCount += 1;
  if (!ratedItems.has(metadata.parent_asin)) continue;
  ratedMetadataCount += 1;
  if (typeof metadata.title === "string" && metadata.title.trim()) metadataCoverage.title += 1;
  if (typeof metadata.store === "string" && metadata.store.trim()) metadataCoverage.store += 1;
  if (Number.isFinite(metadata.price)) metadataCoverage.price += 1;
  if (Array.isArray(metadata.images) && metadata.images.length) metadataCoverage.images += 1;
  if (Array.isArray(metadata.categories) && metadata.categories.length) metadataCoverage.categories += 1;
  if (metadata.details && typeof metadata.details === "object") metadataCoverage.details += 1;
  const normalized = normalizeAmazonProduct(metadata, 100_000);
  if (!normalized) continue;
  vinylCandidateCount += 1;
  if (candidateByExternalItemKey.has(normalized.externalItemKey)) {
    duplicateVinylMetadataRows += 1;
    continue;
  }
  // The pinned source is expected to contain one metadata row per parent
  // product. If it does not, keep the first valid row in source order so the
  // decision is deterministic and visible in the aggregate report.
  candidateByExternalItemKey.set(normalized.externalItemKey, normalized);
}

const candidates = [...candidateByExternalItemKey.values()];
candidates.sort((a, b) => a.externalItemKey.localeCompare(b.externalItemKey));
const products = candidates.slice(0, targetProducts);
const occupiedIds = new Set(Array.from({ length: 245 }, (_, index) => index));
const productByAsin = new Map();
for (const product of products) {
  const parentAsin = product.provenance[0].sourceId;
  product.publicId = stableProductPublicId(parentAsin, occupiedIds);
  product.slug = `${product.slug.replace(/-\d+$/, "")}-${product.publicId}`;
  productByAsin.set(parentAsin, product);
}

const rawUsers = new Map();
let selectedRatingRows = 0;
let duplicateSelectedUserItems = 0;
let sourceRow = 1;
for await (const row of readRatingRows(ratingsPath)) {
  sourceRow += 1;
  const product = productByAsin.get(row.parentAsin);
  if (!product) continue;
  selectedRatingRows += 1;
  let user = rawUsers.get(row.userId);
  if (!user) {
    user = new Map();
    rawUsers.set(row.userId, user);
  }
  const previous = user.get(product.publicId);
  if (previous) duplicateSelectedUserItems += 1;
  if (!previous || row.timestamp > previous.timestamp || (row.timestamp === previous.timestamp && sourceRow > previous.sourceRow)) {
    user.set(product.publicId, {
      productPublicId: product.publicId,
      externalItemKey: product.externalItemKey,
      rating: row.rating,
      timestamp: row.timestamp,
      sourceRow,
    });
  }
}

const userCandidates = [];
for (const [sourceUserId, items] of rawUsers) {
  if (items.size < minimumCore + 2) continue;
  const userKey = profileOnly
    ? createHash("sha256").update(`${AMAZON_DATASET_KEY}:${sourceUserId}`).digest("hex")
    : createDatasetUserKey(sourceUserId, secret);
  userCandidates.push({ userKey, items: [...items.values()] });
}
userCandidates.sort((a, b) => a.userKey.localeCompare(b.userKey));

let stagedRatings = [];
for (const user of userCandidates.slice(0, maximumUsers)) {
  stagedRatings.push(...splitUserRatings(user.items).map((row) => ({
    datasetKey: AMAZON_DATASET_KEY,
    userKey: user.userKey,
      productPublicId: row.productPublicId,
      externalItemKey: row.externalItemKey,
      rating: row.rating,
      occurredAt: new Date(row.timestamp).toISOString(),
      split: row.split,
      verifiedPurchase: null,
      sourceRow: row.sourceRow,
      schemaVersion: 1,
      qualityFlags: ["verified-purchase-unavailable-in-rating-only-source"],
  })));
}
stagedRatings = trainCore(stagedRatings, minimumCore);
const activeUserKeys = new Set(stagedRatings.map((row) => row.userKey));
const activeProductIds = new Set(stagedRatings.map((row) => row.productPublicId));
const stagedProducts = products.filter((product) => activeProductIds.has(product.publicId));
stagedRatings.sort((a, b) => (
  a.userKey.localeCompare(b.userKey)
  || a.occurredAt.localeCompare(b.occurredAt)
  || a.productPublicId - b.productPublicId
));

const splitCounts = stagedRatings.reduce((result, row) => {
  result[row.split] += 1;
  return result;
}, { train: 0, validation: 0, test: 0 });
const config = {
  ...transformationConfig,
  targetProducts,
  maximumUsers,
  trainCoreMinimum: minimumCore,
};
const report = {
  schemaVersion: 1,
  datasetKey: AMAZON_DATASET_KEY,
  generatedAt: new Date().toISOString(),
  profileOnly,
  source: {
    metadataRows: metadataCount,
    ratingRows: sourceRatingCount,
    users: sourceUsers.size,
    products: ratedItems.size,
    ratingDistribution,
    timestampRange: {
      minimum: new Date(minimumTimestamp).toISOString(),
      maximum: new Date(maximumTimestamp).toISOString(),
    },
    maximumRatingsPerUser: [...userActivity.values()].reduce((maximum, value) => Math.max(maximum, value), 0),
    maximumRatingsPerProduct: [...itemActivity.values()].reduce((maximum, value) => Math.max(maximum, value), 0),
    verifiedPurchase: "unavailable-in-rating-only-source",
    metadataCoverage,
  },
  filtering: {
    ratedProductsWithMetadata: ratedMetadataCount,
    vinylCandidates: vinylCandidateCount,
    duplicateVinylMetadataRows,
    ratingRowsForSelectedProducts: selectedRatingRows,
    duplicateSelectedUserItems,
  },
  staged: {
    products: stagedProducts.length,
    users: activeUserKeys.size,
    ratings: stagedRatings.length,
    splits: splitCounts,
  },
  config,
  configDigest: createHash("sha256").update(JSON.stringify(config)).digest("hex"),
  pseudonymKeyFingerprint: profileOnly ? null : pseudonymKeyFingerprint(secret),
  sourceFiles: {
    metadata: { bytes: verified.metadata.bytes, sha256: verified.metadata.sha256 },
    ratings: { bytes: verified.ratings.bytes, sha256: verified.ratings.sha256 },
  },
  acceptance: {
    sourceHashesValid: true,
    trainOnlyCoreMinimum: minimumCore,
    noReviewText: true,
    noSourceReviewerIdsInStaging: true,
    productImagesExcluded: true,
    sourceRowsValid: true,
    stagedRowsUseOneDatasetVersion: true,
  },
};

if (!profileOnly) {
  await mkdir(STAGING_ROOT, { recursive: true });
  const productsPath = path.join(STAGING_ROOT, "products.jsonl");
  const ratingsOutputPath = path.join(STAGING_ROOT, "ratings.jsonl");
  await writeJsonl(productsPath, stagedProducts);
  await writeJsonl(ratingsOutputPath, stagedRatings);
  const [productsDetails, ratingsDetails] = await Promise.all([
    stat(productsPath),
    stat(ratingsOutputPath),
  ]);
  report.stagingFiles = {
    products: { bytes: productsDetails.size, sha256: await sha256File(productsPath) },
    ratings: { bytes: ratingsDetails.size, sha256: await sha256File(ratingsOutputPath) },
  };
  await writeFile(path.join(STAGING_ROOT, "report.json"), `${JSON.stringify(report, null, 2)}\n`);
}
console.log(JSON.stringify(report, null, 2));
