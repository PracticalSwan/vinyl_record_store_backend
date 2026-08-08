import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import {
  AMAZON_DATASET_KEY,
  AMAZON_PREVIOUS_DATASET_KEY,
  AMAZON_PRODUCT_COLLECTION,
  AMAZON_SOURCE,
  AMAZON_SOURCE_VERSION,
  canonicalSourceIdentityKey,
  readJsonlRows,
  verifySourceFile,
} from "../src/lib/dataset/amazonReviews2023.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { DatasetProduct } from "../src/models/DatasetProduct.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";
import { User } from "../src/models/User.js";
import { VinylRecord } from "../src/models/VinylRecord.js";
import { sameDigestSet as sameDigestCollection, validRecordDigest } from "../src/lib/dataset/integrity.js";

const SHOWCASE_PUBLIC_IDS = ["demo-jazz", "demo-rock", "demo-soul"];
const LEGACY_PRODUCT_COUNT = 116;
const datasetKey = process.argv.find((value) => value.startsWith("--dataset-key="))
  ?.slice("--dataset-key=".length) || AMAZON_DATASET_KEY;
const expectActive = process.argv.find((value) => value.startsWith("--expect-active="))
  ?.slice("--expect-active=".length) || datasetKey;
const dataRoot = path.join(process.cwd(), "data", "amazon-reviews-2023");
const stagingRoot = path.join(dataRoot, "staging", datasetKey);

function sameSet(actual, expected) {
  return actual.length === expected.size && actual.every((value) => expected.has(value));
}

function requireCheck(condition, message) {
  if (!condition) throw new Error(message);
}

function sameFileEvidence(actual, expected) {
  return actual?.bytes === expected?.bytes && actual?.sha256 === expected?.sha256;
}

const report = JSON.parse(await readFile(path.join(stagingRoot, "report.json"), "utf8"));
const sourceManifest = JSON.parse(await readFile(path.join(dataRoot, "source-manifest.json"), "utf8"));
requireCheck(report.datasetKey === datasetKey, "The staging report belongs to a different dataset key.");
await Promise.all([
  verifySourceFile(path.join(dataRoot, sourceManifest.files.metadata.relativePath), report.sourceFiles.metadata),
  verifySourceFile(path.join(dataRoot, sourceManifest.files.ratings.relativePath), report.sourceFiles.ratings),
  verifySourceFile(path.join(stagingRoot, "products.jsonl"), report.stagingFiles.products),
  verifySourceFile(path.join(stagingRoot, "ratings.jsonl"), report.stagingFiles.ratings),
]);

let identityRegistry = null;
let artworkEnrichment = null;
let localArtworkManifest = [];
if (datasetKey === AMAZON_DATASET_KEY) {
  identityRegistry = JSON.parse(await readFile(path.join(dataRoot, "product-identity-registry.json"), "utf8"));
  artworkEnrichment = JSON.parse(await readFile(path.join(dataRoot, "artwork-enrichment-v2.json"), "utf8"));
  const localModulePath = path.join(process.cwd(), "src", "data", "datasetLocalArtworkManifest.js");
  const localModule = await import(`${pathToFileURL(localModulePath).href}?v=${Date.now()}`);
  localArtworkManifest = localModule.datasetLocalArtworkManifest;
  const canonicalConfig = JSON.parse(await readFile(path.join(dataRoot, "transformation-config.json"), "utf8"));
  const configDigest = createHash("sha256").update(JSON.stringify({
    config: canonicalConfig,
    identityRegistryDigest: identityRegistry.entriesDigest,
    artworkEntriesDigest: artworkEnrichment.entriesDigest,
  })).digest("hex");
  requireCheck(configDigest === report.configDigest, "The v2 transformation configuration digest is stale.");
  requireCheck(
    identityRegistry.entriesDigest === createHash("sha256").update(JSON.stringify(identityRegistry.entries)).digest("hex"),
    "The identity registry digest is invalid.",
  );
  requireCheck(
    artworkEnrichment.entriesDigest === createHash("sha256").update(JSON.stringify(artworkEnrichment.entries)).digest("hex"),
    "The artwork enrichment digest is invalid.",
  );
  requireCheck(
    identityRegistry.entries.every((entry) => (
      /^[0-9a-f]{64}$/.test(entry.sourceIdentityKey)
      && Number.isInteger(entry.publicId)
      && Object.keys(entry).length === 2
    )),
    "The identity registry contains source text or an invalid mapping.",
  );
  requireCheck(
    artworkEnrichment.entries.every((entry) => !Object.hasOwn(entry, "input") && !Object.hasOwn(entry, "artist")),
    "The committed artwork manifest contains operator-only source match text.",
  );
  requireCheck(artworkEnrichment.counts.accepted > 0 && artworkEnrichment.counts.error === 0, "Artwork enrichment did not finish cleanly with accepted coverage.");
}

const expectedProducts = new Map();
const productDigests = new Set();
const productExternalKeys = new Set();
const productSlugs = new Set();
for await (const product of readJsonlRows(path.join(stagingRoot, "products.jsonl"), "staged product")) {
  requireCheck(product.datasetKey === datasetKey, "A staged product has incorrect version ownership.");
  requireCheck(!expectedProducts.has(product.publicId), "A staged product public ID is duplicated.");
  requireCheck(!productSlugs.has(product.slug), "A staged product slug is duplicated.");
  requireCheck(!productExternalKeys.has(product.externalItemKey), "A staged product external key is duplicated.");
  requireCheck(Array.isArray(product.qualityFlags) && product.fieldOrigins && typeof product.fieldOrigins === "object", "A staged product lacks provenance structures.");
  if (datasetKey === AMAZON_DATASET_KEY) {
    requireCheck(validRecordDigest(product), "A staged product record digest is invalid.");
    requireCheck(/^[0-9a-f]{64}$/.test(product.externalItemKey), "A v2 product external identity is not opaque.");
    requireCheck(product.price === null && product.currency === null && product.stock === null && product.condition === null, "A research product contains invented commerce data.");
    productDigests.add(product.recordDigest);
  }
  expectedProducts.set(product.publicId, product);
  productExternalKeys.add(product.externalItemKey);
  productSlugs.add(product.slug);
}

if (identityRegistry) {
  const registryByKey = new Map(identityRegistry.entries.map((entry) => [entry.sourceIdentityKey, entry.publicId]));
  requireCheck(registryByKey.size === identityRegistry.entryCount, "The identity registry contains duplicate identities.");
  for (const product of expectedProducts.values()) {
    const sourceId = product.provenance?.find((entry) => entry.field === "catalog-record")?.sourceId;
    requireCheck(registryByKey.get(canonicalSourceIdentityKey(sourceId)) === product.publicId, "A staged public ID differs from the stable identity registry.");
  }
}

const ratingDigests = new Set();
const ratingPairs = new Set();
const historicalUsers = new Set();
const splitCounts = { train: 0, validation: 0, test: 0 };
const chronology = new Map();
let ratingCount = 0;
for await (const rating of readJsonlRows(path.join(stagingRoot, "ratings.jsonl"), "staged rating")) {
  requireCheck(rating.datasetKey === datasetKey, "A staged rating has incorrect version ownership.");
  requireCheck(expectedProducts.has(rating.productPublicId), "A staged rating is orphaned.");
  requireCheck(expectedProducts.get(rating.productPublicId).externalItemKey === rating.externalItemKey, "A staged rating external item mapping is inconsistent.");
  requireCheck(["train", "validation", "test"].includes(rating.split), "A staged rating split is invalid.");
  const pair = `${rating.userKey}:${rating.productPublicId}`;
  requireCheck(!ratingPairs.has(pair), "A staged user-product pair is duplicated across splits.");
  ratingPairs.add(pair);
  historicalUsers.add(rating.userKey);
  splitCounts[rating.split] += 1;
  ratingCount += 1;
  if (datasetKey === AMAZON_DATASET_KEY) {
    requireCheck(validRecordDigest(rating), "A staged rating record digest is invalid.");
    ratingDigests.add(rating.recordDigest);
  }
  const occurred = Date.parse(rating.occurredAt);
  const subject = chronology.get(rating.userKey) || {
    trainMax: -Infinity,
    validationMin: Infinity,
    validationMax: -Infinity,
    testMin: Infinity,
  };
  if (rating.split === "train") subject.trainMax = Math.max(subject.trainMax, occurred);
  if (rating.split === "validation") {
    subject.validationMin = Math.min(subject.validationMin, occurred);
    subject.validationMax = Math.max(subject.validationMax, occurred);
  }
  if (rating.split === "test") subject.testMin = Math.min(subject.testMin, occurred);
  chronology.set(rating.userKey, subject);
}
for (const subject of chronology.values()) {
  requireCheck(subject.trainMax <= subject.validationMin, "A validation row precedes a training row for one subject.");
  requireCheck(Math.max(subject.trainMax, subject.validationMax) <= subject.testMin, "A test row precedes a training or validation row for one subject.");
}
requireCheck(expectedProducts.size === report.staged.products, "Staged product count differs from the report.");
requireCheck(ratingCount === report.staged.ratings, "Staged rating count differs from the report.");
requireCheck(historicalUsers.size === report.staged.users, "Staged subject count differs from the report.");
requireCheck(JSON.stringify(splitCounts) === JSON.stringify(report.staged.splits), "Staged split counts differ from the report.");

if (artworkEnrichment) {
  const acceptedIds = new Set(artworkEnrichment.entries.filter((entry) => entry.status === "accepted").map((entry) => entry.publicId));
  const localIds = new Set(localArtworkManifest.map((entry) => entry.publicId));
  requireCheck(artworkEnrichment.entries.length === expectedProducts.size, "Artwork decisions do not cover every v2 product.");
  requireCheck(sameSet([...localIds], acceptedIds), "Local fallback artwork does not exactly cover accepted matches.");
}

try {
  await connectMongoDB();
  const importDocument = await DatasetImport.findOne({ datasetKey }).lean().exec();
  const activeImports = await DatasetImport.find({ active: true }).lean().exec();
  const targetModel = importDocument?.productCollection === AMAZON_PRODUCT_COLLECTION
    ? DatasetProduct
    : VinylRecord;
  const targetFilter = { datasetKey };
  const [
    storedProductCount,
    storedRatingCount,
    storedUsers,
    storedSplitCounts,
    storedProductDigests,
    storedRatingDigests,
    legacyProductCount,
    v1ProductCount,
    users,
    historicalIndexes,
    prohibitedHistoricalRows,
    storedProductMappings,
    storedRatingMappings,
    duplicateHistoricalPairs,
    previousV1Mappings,
  ] = await Promise.all([
    targetModel.countDocuments(targetFilter).exec(),
    HistoricalAmazonRating.countDocuments(targetFilter).exec(),
    HistoricalAmazonRating.collection.distinct("userKey", targetFilter),
    HistoricalAmazonRating.aggregate([
      { $match: targetFilter },
      { $group: { _id: "$split", count: { $sum: 1 } } },
    ]).exec(),
    datasetKey === AMAZON_DATASET_KEY ? DatasetProduct.distinct("recordDigest", targetFilter).exec() : Promise.resolve([]),
    datasetKey === AMAZON_DATASET_KEY ? HistoricalAmazonRating.distinct("recordDigest", targetFilter).exec() : Promise.resolve([]),
    VinylRecord.countDocuments({ source: "demo-seed", datasetKey: null }).exec(),
    VinylRecord.countDocuments({ datasetKey: AMAZON_PREVIOUS_DATASET_KEY }).exec(),
    User.find({}, { _id: 0, publicId: 1, role: 1, active: 1 }).sort({ publicId: 1 }).lean().exec(),
    HistoricalAmazonRating.collection.indexes(),
    HistoricalAmazonRating.collection.countDocuments({
      datasetKey,
      $or: [
        { reviewerID: { $exists: true } },
        { reviewer_id: { $exists: true } },
        { user_id: { $exists: true } },
        { reviewText: { $exists: true } },
        { text: { $exists: true } },
      ],
    }),
    targetModel.find(targetFilter, { _id: 0, publicId: 1, externalItemKey: 1 }).lean().exec(),
    HistoricalAmazonRating.find(targetFilter, { _id: 0, productPublicId: 1, externalItemKey: 1 }).lean().exec(),
    HistoricalAmazonRating.aggregate([
      { $match: targetFilter },
      { $group: { _id: { userKey: "$userKey", productPublicId: "$productPublicId" }, count: { $sum: 1 } } },
      { $match: { count: { $gt: 1 } } },
      { $count: "duplicates" },
    ]).exec(),
    VinylRecord.find(
      { datasetKey: AMAZON_PREVIOUS_DATASET_KEY },
      { _id: 0, publicId: 1, provenance: 1 },
    ).lean().exec(),
  ]);
  const splitMap = new Map(storedSplitCounts.map((entry) => [entry._id, entry.count]));
  const actualSplits = Object.fromEntries(["train", "validation", "test"].map((split) => [split, splitMap.get(split) || 0]));
  const storedExternalByProduct = new Map(storedProductMappings.map((product) => [product.publicId, product.externalItemKey]));
  const orphanOrMismatchedRatings = storedRatingMappings.filter((rating) => (
    !storedExternalByProduct.has(rating.productPublicId)
    || storedExternalByProduct.get(rating.productPublicId) !== rating.externalItemKey
  )).length;
  const previousV1IdentityMap = new Map(previousV1Mappings.map((product) => {
    const sourceId = product.provenance?.find((entry) => entry.field === "catalog-record")?.sourceId;
    return [canonicalSourceIdentityKey(sourceId), product.publicId];
  }));
  const stableIdsPreservedFromV1 = datasetKey !== AMAZON_DATASET_KEY || (
    previousV1IdentityMap.size === identityRegistry.entryCount
    && identityRegistry.entries.every((entry) => (
      previousV1IdentityMap.get(entry.sourceIdentityKey) === entry.publicId
    ))
  );
  const checks = {
    targetImportExists: Boolean(importDocument),
    targetImportComplete: Boolean(importDocument?.sealedAt) && ["completed", "active", "superseded"].includes(importDocument?.status),
    exactlyOneExpectedActiveImport: activeImports.length === 1 && activeImports[0].datasetKey === expectActive && activeImports[0].status === "active",
    importConfigMatches: importDocument?.configDigest === report.configDigest,
    importOwnershipMatches: datasetKey !== AMAZON_DATASET_KEY || (
      importDocument?.source === AMAZON_SOURCE
      && importDocument?.sourceVersion === AMAZON_SOURCE_VERSION
      && importDocument?.productCollection === AMAZON_PRODUCT_COLLECTION
      && importDocument?.identityRegistryDigest === report.identityRegistry.entriesDigest
      && importDocument?.artworkEntriesDigest === report.artwork.entriesDigest
      && importDocument?.pseudonymKeyFingerprint === report.pseudonymKeyFingerprint
      && sameFileEvidence(importDocument?.sourceFiles?.metadata, report.sourceFiles.metadata)
      && sameFileEvidence(importDocument?.sourceFiles?.ratings, report.sourceFiles.ratings)
      && sameFileEvidence(importDocument?.stagingFiles?.products, report.stagingFiles.products)
      && sameFileEvidence(importDocument?.stagingFiles?.ratings, report.stagingFiles.ratings)
    ),
    importCountsMatch: importDocument?.counts?.products === report.staged.products
      && importDocument?.counts?.users === report.staged.users
      && importDocument?.counts?.ratings === report.staged.ratings,
    productsMatch: storedProductCount === report.staged.products,
    ratingsMatch: storedRatingCount === report.staged.ratings,
    subjectsMatch: storedUsers.length === report.staged.users,
    splitsMatch: JSON.stringify(actualSplits) === JSON.stringify(report.staged.splits),
    immutableDigestsMatch: datasetKey !== AMAZON_DATASET_KEY
      || (sameDigestCollection(storedProductDigests, productDigests) && sameDigestCollection(storedRatingDigests, ratingDigests)),
    legacyCatalogPreserved: legacyProductCount === LEGACY_PRODUCT_COUNT,
    previousV1Preserved: v1ProductCount === report.staged.products,
    stableIdsPreservedFromV1,
    showcaseUsersPreserved: JSON.stringify(users.map((user) => user.publicId)) === JSON.stringify(SHOWCASE_PUBLIC_IDS),
    showcaseUsersUnchanged: users.every((user) => user.role === "customer" && user.active === true),
    noHistoricalPrivateFields: prohibitedHistoricalRows === 0,
    noOrphanOrMismatchedRatings: orphanOrMismatchedRatings === 0,
    noDuplicateHistoricalPairs: (duplicateHistoricalPairs[0]?.duplicates || 0) === 0,
    historicalRatingsHaveNoTtl: historicalIndexes.every((index) => index.expireAfterSeconds === undefined),
  };
  if (datasetKey === AMAZON_PREVIOUS_DATASET_KEY) {
    // V1 predates the sealed-import field. It remains a valid rollback target
    // and is never rewritten by the v2 lifecycle.
    checks.targetImportComplete = ["completed", "active", "superseded"].includes(importDocument?.status);
  }
  const result = {
    status: Object.values(checks).every(Boolean) ? "ok" : "failed",
    datasetKey,
    expectedActiveDatasetKey: expectActive,
    activeDatasetKey: activeImports[0]?.datasetKey || null,
    counts: {
      products: storedProductCount,
      historicalRatings: storedRatingCount,
      historicalUsers: storedUsers.length,
      splits: actualSplits,
      legacyProducts: legacyProductCount,
      previousV1Products: v1ProductCount,
      showcaseUsers: users.length,
      acceptedArtwork: artworkEnrichment?.counts?.accepted ?? null,
      localArtwork: localArtworkManifest.length,
    },
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  requireCheck(result.status === "ok", "Dataset verification failed.");
} finally {
  await disconnectMongoDB();
}
