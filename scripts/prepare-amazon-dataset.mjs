import { createHash } from "node:crypto";
import { createWriteStream } from "node:fs";
import { once } from "node:events";
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";
import {
  AMAZON_DATASET_KEY,
  AMAZON_IDENTITY_NAMESPACE,
  canonicalSourceIdentityKey,
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
import {
  AMAZON_IDENTITY_BASE_DATASET_KEY,
  assertAmazonReleaseArtifactDigest,
  assertAmazonReleaseArtifactOwnership,
  assertAmazonSealedStagingReproduction,
  getCurrentAmazonDatasetRelease,
} from "../src/lib/dataset/amazonDatasetReleases.js";
import { withRecordDigest } from "../src/lib/dataset/integrity.js";
import { createPublicDataQualitySummary } from "../src/lib/dataset/publicDatasetEvidence.js";

const ROOT = process.cwd();
const DATA_ROOT = path.join(ROOT, "data", "amazon-reviews-2023");
const MANIFEST_PATH = path.join(DATA_ROOT, "source-manifest.json");
const CONFIG_PATH = path.join(DATA_ROOT, "transformation-config.json");
const IDENTITY_REGISTRY_PATH = path.join(DATA_ROOT, "product-identity-registry.json");
const currentRelease = getCurrentAmazonDatasetRelease();
const ARTWORK_ENRICHMENT_PATH = path.join(DATA_ROOT, currentRelease.artworkEnrichmentFilename);
const STAGING_ROOT = path.join(DATA_ROOT, "staging", AMAZON_DATASET_KEY);
const STAGING_REPORT_PATH = path.join(STAGING_ROOT, "report.json");
const DATA_QUALITY_SUMMARY_PATH = path.join(DATA_ROOT, "data-quality-summary.json");

function option(name, fallback) {
  const prefix = `--${name}=`;
  const raw = process.argv.find((value) => value.startsWith(prefix))?.slice(prefix.length);
  if (raw === undefined) return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 1) throw new Error(`--${name} must be a positive integer.`);
  return parsed;
}

assertAmazonReleaseArtifactDigest(
  currentRelease,
  "transformationConfig",
  await sha256File(CONFIG_PATH),
);
const transformationConfig = JSON.parse(await readFile(CONFIG_PATH, "utf8"));
if (transformationConfig.datasetKey !== AMAZON_DATASET_KEY) {
  throw new Error("Transformation config datasetKey is unsupported.");
}
const targetProducts = option("products", transformationConfig.targetProducts);
const maximumUsers = option("users", transformationConfig.maximumUsers);
const minimumCore = option("core", transformationConfig.trainCoreMinimum);
const profileOnly = process.argv.includes("--profile-only");
const baseOnly = process.argv.includes("--base-only") || profileOnly;
const sealedOptionOverrides = ["products", "users", "core"].filter((name) => (
  process.argv.some((value) => value.startsWith(`--${name}=`))
));
if (currentRelease.sealedEvidenceRequired && !profileOnly && baseOnly) {
  throw new Error("Base-only staging is not allowed for a sealed current release; use dataset:profile for read-only profiling.");
}
if (currentRelease.sealedEvidenceRequired && !profileOnly && sealedOptionOverrides.length) {
  throw new Error(`Sealed current-release reproduction does not accept staging overrides: ${sealedOptionOverrides.join(", ")}.`);
}
const secret = process.env.DATASET_PSEUDONYM_KEY || process.env.AUTH_SECRET;
if (!profileOnly && (!secret || secret.length < 32)) {
  throw new Error("Staging requires DATASET_PSEUDONYM_KEY or AUTH_SECRET with at least 32 characters.");
}

assertAmazonReleaseArtifactDigest(currentRelease, "sourceManifest", await sha256File(MANIFEST_PATH));
const manifest = JSON.parse(await readFile(MANIFEST_PATH, "utf8"));
if (manifest.datasetKey !== AMAZON_DATASET_KEY) throw new Error("Source manifest datasetKey is unsupported.");
assertAmazonReleaseArtifactOwnership(currentRelease, {
  sourceManifest: manifest,
  transformationConfig,
});
const metadataPath = path.join(DATA_ROOT, manifest.files.metadata.relativePath);
const ratingsPath = path.join(DATA_ROOT, manifest.files.ratings.relativePath);
const verified = {
  metadata: await verifySourceFile(metadataPath, manifest.files.metadata),
  ratings: await verifySourceFile(ratingsPath, manifest.files.ratings),
};

const identityRegistry = JSON.parse(await readFile(IDENTITY_REGISTRY_PATH, "utf8"));
const identityEntriesDigest = createHash("sha256")
  .update(JSON.stringify(identityRegistry.entries || []))
  .digest("hex");
if (
  identityRegistry.identityNamespace !== AMAZON_IDENTITY_NAMESPACE
  || identityRegistry.derivedFromDatasetKey !== AMAZON_IDENTITY_BASE_DATASET_KEY
  || identityRegistry.entryCount !== identityRegistry.entries?.length
  || identityRegistry.entriesDigest !== identityEntriesDigest
) {
  throw new Error("The product identity registry is invalid or belongs to another source boundary.");
}
const identityBySourceKey = new Map(identityRegistry.entries.map((entry) => [entry.sourceIdentityKey, entry]));
if (identityBySourceKey.size !== identityRegistry.entries.length) {
  throw new Error("The product identity registry contains duplicate source identities.");
}

let artworkEnrichment = {
  schemaVersion: 1,
  datasetKey: AMAZON_DATASET_KEY,
  entries: [],
  counts: { accepted: 0, ambiguous: 0, unresolved: 0, error: 0 },
};
if (!baseOnly) {
  assertAmazonReleaseArtifactDigest(
    currentRelease,
    "artworkEnrichment",
    await sha256File(ARTWORK_ENRICHMENT_PATH),
  );
  artworkEnrichment = JSON.parse(await readFile(ARTWORK_ENRICHMENT_PATH, "utf8"));
  if (artworkEnrichment.datasetKey !== AMAZON_DATASET_KEY || !Array.isArray(artworkEnrichment.entries)) {
    throw new Error("The artwork enrichment manifest is invalid or belongs to another dataset version.");
  }
  assertAmazonReleaseArtifactOwnership(currentRelease, { artworkEnrichment });
}
const artworkEntriesDigest = createHash("sha256")
  .update(JSON.stringify(artworkEnrichment.entries))
  .digest("hex");
if (!baseOnly && artworkEnrichment.entriesDigest !== artworkEntriesDigest) {
  throw new Error("The artwork enrichment manifest digest is invalid.");
}
const artworkByPublicId = new Map(artworkEnrichment.entries.map((entry) => [entry.publicId, entry]));
if (artworkByPublicId.size !== artworkEnrichment.entries.length) {
  throw new Error("The artwork enrichment manifest contains duplicate public IDs.");
}

function jsonlEvidence(rows) {
  const hash = createHash("sha256");
  let bytes = 0;
  for (const row of rows) {
    const line = `${JSON.stringify(row)}\n`;
    hash.update(line);
    bytes += Buffer.byteLength(line, "utf8");
  }
  return { bytes, sha256: hash.digest("hex") };
}

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
const occupiedIds = new Set([
  ...Array.from({ length: 245 }, (_, index) => index),
  ...identityRegistry.entries.map((entry) => entry.publicId),
]);
const unregisteredCandidateKeys = new Set();
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
  const sourceIdentityKey = canonicalSourceIdentityKey(metadata.parent_asin);
  if (!sourceIdentityKey) continue;
  const registered = identityBySourceKey.get(sourceIdentityKey) || null;
  const publicId = registered?.publicId || stableProductPublicId(sourceIdentityKey, occupiedIds);
  const artworkEntry = artworkByPublicId.get(publicId);
  const artworkMatch = artworkEntry?.status === "accepted" ? artworkEntry : null;
  const normalized = normalizeAmazonProduct(metadata, publicId, {
    stableSlug: registered ? `record-${publicId}` : null,
    artworkMatch,
  });
  if (!normalized) continue;
  if (!registered) unregisteredCandidateKeys.add(sourceIdentityKey);
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
const productByAsin = new Map();
for (const product of products) {
  const parentAsin = product.provenance[0].sourceId;
  productByAsin.set(parentAsin, product);
}

const rawUsers = new Map();
let selectedRatingRows = 0;
let duplicateSelectedUserItems = 0;
let sourceRow = 0;
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
      schemaVersion: 2,
      qualityFlags: ["verified-purchase-unavailable-in-rating-only-source"],
  })));
}
stagedRatings = trainCore(stagedRatings, minimumCore);
const activeUserKeys = new Set(stagedRatings.map((row) => row.userKey));
const activeProductIds = new Set(stagedRatings.map((row) => row.productPublicId));
const stagedProducts = products.filter((product) => activeProductIds.has(product.publicId));
const missingRegistryProducts = stagedProducts.filter((product) => !identityBySourceKey.has(product.externalItemKey));
if (missingRegistryProducts.length) {
  throw new Error(
    `${missingRegistryProducts.length} staged product(s) are missing stable identity-registry entries. `
    + "Review and extend the registry before creating a new immutable dataset version.",
  );
}
if (!baseOnly) {
  const stagedIdSet = new Set(stagedProducts.map((product) => product.publicId));
  if (
    artworkEnrichment.entries.length !== stagedProducts.length
    || artworkEnrichment.entries.some((entry) => !stagedIdSet.has(entry.publicId))
  ) {
    throw new Error("Artwork enrichment coverage does not exactly match the staged product set.");
  }
}

const digestedProducts = stagedProducts.map(withRecordDigest);
stagedRatings = stagedRatings.map(withRecordDigest);
stagedRatings.sort((a, b) => (
  a.userKey.localeCompare(b.userKey)
  || a.occurredAt.localeCompare(b.occurredAt)
  || a.productPublicId - b.productPublicId
));

const splitCounts = stagedRatings.reduce((result, row) => {
  result[row.split] += 1;
  return result;
}, { train: 0, validation: 0, test: 0 });
function countValues(values) {
  return Object.fromEntries([...values.reduce((counts, value) => {
    const key = value === null || value === undefined || value === "" ? "Unresolved" : String(value);
    counts.set(key, (counts.get(key) || 0) + 1);
    return counts;
  }, new Map())].sort(([left], [right]) => left.localeCompare(right)));
}

const stagedRatingDistribution = Object.fromEntries([1, 2, 3, 4, 5].map((value) => [
  value,
  stagedRatings.filter((row) => row.rating === value).length,
]));
const artistQuality = stagedProducts.reduce((counts, product) => {
  if (product.artist) {
    const cleaned = product.qualityFlags.includes("artist-role-markers-removed")
      || product.qualityFlags.includes("artist-normalized-various-artists");
    counts[cleaned ? "cleaned" : "accepted"] += 1;
  } else if (product.qualityFlags.includes("artist-rejected-ambiguous-multi-credit")) {
    counts.ambiguous += 1;
  } else {
    counts.rejectedOrMissing += 1;
  }
  return counts;
}, { accepted: 0, cleaned: 0, ambiguous: 0, rejectedOrMissing: 0 });
const yearCoverage = stagedProducts.reduce((counts, product) => {
  if (product.originalReleaseYear && product.editionReleaseYear) counts.originalAndEdition += 1;
  else if (product.originalReleaseYear) counts.originalOnly += 1;
  else if (product.editionReleaseYear) counts.editionOnly += 1;
  else counts.unresolved += 1;
  return counts;
}, { originalAndEdition: 0, originalOnly: 0, editionOnly: 0, unresolved: 0 });
const qualityFlagDistribution = countValues(stagedProducts.flatMap((product) => product.qualityFlags));
const stagedPositiveRatings = stagedRatings.filter((row) => row.rating >= 4).length;
const quality = {
  canonicalGenreDistribution: countValues(stagedProducts.map((product) => product.genre)),
  canonicalGenreCount: new Set(stagedProducts.map((product) => product.genre).filter(Boolean)).size,
  artistQuality,
  yearCoverage,
  originalReleaseYearByDecade: countValues(stagedProducts.map((product) => (
    product.year ? `${Math.floor(product.year / 10) * 10}s` : null
  ))),
  formatDistribution: countValues(stagedProducts.map((product) => product.format)),
  fieldCoverage: {
    artist: stagedProducts.filter((product) => product.artist).length,
    canonicalGenre: stagedProducts.filter((product) => product.genre).length,
    originalReleaseYear: stagedProducts.filter((product) => product.originalReleaseYear).length,
    editionReleaseYear: stagedProducts.filter((product) => product.editionReleaseYear).length,
    label: stagedProducts.filter((product) => product.label).length,
    description: stagedProducts.filter((product) => product.description).length,
    commercialFields: stagedProducts.filter((product) => (
      product.price !== null || product.currency !== null || product.stock !== null || product.condition !== null
    )).length,
  },
  qualityFlagDistribution,
  ratings: {
    distribution: stagedRatingDistribution,
    positiveThreshold: 4,
    positiveCount: stagedPositiveRatings,
    positiveRate: Number((stagedPositiveRatings / stagedRatings.length).toFixed(6)),
    rebalanced: false,
    fabricatedNegatives: false,
  },
};
const config = {
  ...transformationConfig,
  targetProducts,
  maximumUsers,
  trainCoreMinimum: minimumCore,
};
const report = {
  schemaVersion: 2,
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
  quality,
  config,
  configDigest: createHash("sha256").update(JSON.stringify({
    config,
    identityRegistryDigest: identityRegistry.entriesDigest,
    artworkEntriesDigest,
  })).digest("hex"),
  identityRegistry: {
    entryCount: identityRegistry.entryCount,
    entriesDigest: identityRegistry.entriesDigest,
    unregisteredCandidateCount: unregisteredCandidateKeys.size,
    missingStagedEntries: missingRegistryProducts.length,
  },
  artwork: {
    baseOnly,
    entriesDigest: artworkEntriesDigest,
    counts: artworkEnrichment.counts,
  },
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
    amazonProductImagesExcluded: true,
    artworkEnrichmentCoverageComplete: baseOnly ? null : artworkEnrichment.entries.length === stagedProducts.length,
    stablePublicIdsRegistered: missingRegistryProducts.length === 0,
    sourceRowsValid: true,
    stagedRowsUseOneDatasetVersion: true,
  },
};

if (!profileOnly) {
  report.stagingFiles = {
    products: jsonlEvidence(digestedProducts),
    ratings: jsonlEvidence(stagedRatings),
  };
  const dataQualitySummary = createPublicDataQualitySummary(report, {
    sourceRevision: manifest.sourceRevision,
  });

  if (currentRelease.sealedEvidenceRequired) {
    const canonicalReport = JSON.parse(await readFile(STAGING_REPORT_PATH, "utf8"));
    assertAmazonReleaseArtifactOwnership(currentRelease, {
      sourceManifest: manifest,
      transformationConfig,
      artworkEnrichment,
      report: canonicalReport,
    });
    await Promise.all([
      verifySourceFile(path.join(STAGING_ROOT, "products.jsonl"), canonicalReport.stagingFiles?.products),
      verifySourceFile(path.join(STAGING_ROOT, "ratings.jsonl"), canonicalReport.stagingFiles?.ratings),
    ]);
    assertAmazonSealedStagingReproduction(canonicalReport, report);
    const publishedSummary = JSON.parse(await readFile(DATA_QUALITY_SUMMARY_PATH, "utf8"));
    if (!isDeepStrictEqual(publishedSummary, dataQualitySummary)) {
      throw new Error("Refusing to rewrite the sealed public data-quality summary because reproduced aggregate evidence differs.");
    }
  } else {
    await mkdir(STAGING_ROOT, { recursive: true });
    const productsPath = path.join(STAGING_ROOT, "products.jsonl");
    const ratingsOutputPath = path.join(STAGING_ROOT, "ratings.jsonl");
    await writeJsonl(productsPath, digestedProducts);
    await writeJsonl(ratingsOutputPath, stagedRatings);
    const [productsDetails, ratingsDetails] = await Promise.all([
      stat(productsPath),
      stat(ratingsOutputPath),
    ]);
    report.stagingFiles = {
      products: { bytes: productsDetails.size, sha256: await sha256File(productsPath) },
      ratings: { bytes: ratingsDetails.size, sha256: await sha256File(ratingsOutputPath) },
    };
    await writeFile(STAGING_REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`);
    if (!baseOnly) {
      await writeFile(
        DATA_QUALITY_SUMMARY_PATH,
        `${JSON.stringify(dataQualitySummary, null, 2)}\n`,
        "utf8",
      );
    }
  }
}
console.log(JSON.stringify(report, null, 2));
