import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import {
  AMAZON_CURRENT_DATASET_KEY,
  AMAZON_IDENTITY_BASE_DATASET_KEY,
  AMAZON_ROLLBACK_DATASET_KEY,
  assertAmazonIdentityRegistryReproduction,
  assertAmazonReleaseArtifactDigest,
  assertAmazonReleaseArtifactOwnership,
  getAmazonDatasetRelease,
  getCurrentAmazonDatasetRelease,
  isCompatibleAmazonArtworkProgress,
} from "../src/lib/dataset/amazonDatasetReleases.js";
import {
  assertSealedArtworkReproduction,
  hydrateOriginalReleaseYear,
  needsOriginalYearHydration,
  originalReleaseYearFromDate,
  toCommittedArtworkEnrichmentEntry,
} from "../src/lib/dataset/amazonArtworkEnrichment.js";
import { createPublicDataQualitySummary } from "../src/lib/dataset/publicDatasetEvidence.js";

test("Amazon release roles distinguish current, rollback, and identity-base semantics", () => {
  const current = getCurrentAmazonDatasetRelease();
  const rollback = getAmazonDatasetRelease(AMAZON_ROLLBACK_DATASET_KEY);
  const identityBase = getAmazonDatasetRelease(AMAZON_IDENTITY_BASE_DATASET_KEY);
  assert.equal(current.datasetKey, AMAZON_CURRENT_DATASET_KEY);
  assert.equal(current.role, "current");
  assert.equal(current.artworkEnrichmentFilename, "artwork-enrichment-v3.json");
  assert.equal(rollback.role, "rollback");
  assert.equal(rollback.artworkEnrichmentFilename, "artwork-enrichment-v2.json");
  assert.equal(identityBase.role, "identity-base");
  assert.notEqual(current.artworkEnrichmentFilename, rollback.artworkEnrichmentFilename);
});

test("versioned v2 source and config snapshots retain exact v2 ownership", async () => {
  const release = getAmazonDatasetRelease(AMAZON_ROLLBACK_DATASET_KEY);
  const root = path.join(process.cwd(), "data", "amazon-reviews-2023");
  const sourceManifest = JSON.parse(await readFile(path.join(root, release.sourceManifestFilename), "utf8"));
  const transformationConfig = JSON.parse(await readFile(
    path.join(root, release.transformationConfigFilename),
    "utf8",
  ));
  assert.doesNotThrow(() => assertAmazonReleaseArtifactOwnership(release, {
    sourceManifest,
    transformationConfig,
  }));
  assert.equal(sourceManifest.datasetKey, AMAZON_ROLLBACK_DATASET_KEY);
  assert.equal(transformationConfig.datasetKey, AMAZON_ROLLBACK_DATASET_KEY);
  for (const [name, expected] of Object.entries(release.artifactSha256)) {
    const filename = {
      sourceManifest: release.sourceManifestFilename,
      transformationConfig: release.transformationConfigFilename,
      artworkEnrichment: release.artworkEnrichmentFilename,
      localArtworkEvidence: release.localArtworkEvidenceFilename,
    }[name];
    const body = await readFile(path.join(root, filename));
    assert.equal(createHash("sha256").update(body).digest("hex"), expected);
  }
});

test("current v3 artwork enrichment retains its exact sealed artifact bytes", async () => {
  const release = getCurrentAmazonDatasetRelease();
  const body = await readFile(path.join(
    process.cwd(),
    "data",
    "amazon-reviews-2023",
    release.artworkEnrichmentFilename,
  ));
  assert.equal(
    createHash("sha256").update(body).digest("hex"),
    release.artifactSha256.artworkEnrichment,
  );
  assert.doesNotThrow(() => assertAmazonReleaseArtifactDigest(
    release,
    "artworkEnrichment",
    release.artifactSha256.artworkEnrichment,
  ));
  assert.throws(() => assertAmazonReleaseArtifactDigest(
    release,
    "artworkEnrichment",
    "0".repeat(64),
  ), /differs from pinned immutable/);
});

test("mismatched release artifacts and incompatible progress fail closed", () => {
  const current = getCurrentAmazonDatasetRelease();
  assert.throws(() => assertAmazonReleaseArtifactOwnership(current, {
    artworkEnrichment: { datasetKey: AMAZON_ROLLBACK_DATASET_KEY },
  }), /does not belong/);
  assert.throws(() => assertAmazonReleaseArtifactOwnership(current, {
    sourceManifest: {
      datasetKey: AMAZON_CURRENT_DATASET_KEY,
      files: { metadata: { bytes: 10, sha256: "a" }, ratings: { bytes: 20, sha256: "b" } },
    },
    report: {
      datasetKey: AMAZON_CURRENT_DATASET_KEY,
      sourceFiles: { metadata: { bytes: 10, sha256: "different" }, ratings: { bytes: 20, sha256: "b" } },
    },
  }), /differs from the pinned source manifest/);
  assert.equal(isCompatibleAmazonArtworkProgress({
    datasetKey: AMAZON_ROLLBACK_DATASET_KEY,
    policyVersion: "policy-v1",
    inputDigest: "input",
    entries: [],
  }, {
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    policyVersion: "policy-v1",
    inputDigest: "input",
  }), false);
});

test("sealed artwork reproduction binds both operator input and decision digests", () => {
  const report = {
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    inputDigest: "input",
    entriesDigest: "entries",
  };
  assert.doesNotThrow(() => assertSealedArtworkReproduction(report, {
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    inputDigest: "input",
    entriesDigest: "entries",
  }));
  assert.throws(() => assertSealedArtworkReproduction(report, {
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    inputDigest: "changed-input",
    entriesDigest: "entries",
  }), /input provenance differs/);
  assert.throws(() => assertSealedArtworkReproduction(report, {
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    inputDigest: "input",
    entriesDigest: "changed-entries",
  }), /Refusing to rewrite immutable artwork enrichment/);
});

test("sealed identity-registry reproduction refuses missing or changed v1 evidence", () => {
  const registry = {
    schemaVersion: 1,
    derivedFromDatasetKey: AMAZON_IDENTITY_BASE_DATASET_KEY,
    entriesDigest: "digest",
    entries: [{ sourceIdentityKey: "key", publicId: 1 }],
  };
  assert.doesNotThrow(() => assertAmazonIdentityRegistryReproduction(registry, registry));
  assert.throws(() => assertAmazonIdentityRegistryReproduction(null, registry), /missing/);
  assert.throws(() => assertAmazonIdentityRegistryReproduction(
    { ...registry, entriesDigest: "changed" },
    registry,
  ), /Refusing to rewrite/);
});

test("successful original-year hydration is resumable and does not promote edition year", async () => {
  let calls = 0;
  const hydrated = await hydrateOriginalReleaseYear({
    status: "matched",
    musicBrainzReleaseGroupId: "group-id",
    originalReleaseYear: null,
    editionReleaseYear: 2020,
  }, {
    getReleaseGroup: async () => {
      calls += 1;
      return { firstReleaseDate: "1969-03-01" };
    },
  });
  assert.equal(hydrated.originalReleaseYear, 1969);
  assert.equal(hydrated.editionReleaseYear, 2020);
  assert.equal(hydrated.originalYearHydrationStatus, "complete");
  assert.equal(needsOriginalYearHydration(hydrated), false);
  assert.equal(calls, 1);
});

test("missing MusicBrainz first-release-date remains a trustworthy null", async () => {
  const hydrated = await hydrateOriginalReleaseYear({
    status: "matched",
    musicBrainzReleaseGroupId: "group-id",
    originalReleaseYear: null,
    editionReleaseYear: 2020,
  }, { getReleaseGroup: async () => ({ firstReleaseDate: null }) });
  assert.equal(hydrated.originalReleaseYear, null);
  assert.equal(hydrated.originalYearHydrationStatus, "not-available");
  assert.equal(needsOriginalYearHydration(hydrated), false);
});

test("transient original-year failure remains retryable and then succeeds", async () => {
  const decision = {
    status: "matched",
    musicBrainzReleaseGroupId: "group-id",
    originalReleaseYear: null,
    editionReleaseYear: 2020,
  };
  const failed = await hydrateOriginalReleaseYear(decision, {
    getReleaseGroup: async () => { throw new Error("temporary outage"); },
  });
  assert.equal(failed.originalYearHydrationStatus, "retryable-error");
  assert.equal(needsOriginalYearHydration(failed), true);
  const retried = await hydrateOriginalReleaseYear(failed, {
    getReleaseGroup: async () => ({ firstReleaseDate: "1977" }),
  });
  assert.equal(retried.originalReleaseYear, 1977);
  assert.equal(retried.originalYearHydrationStatus, "complete");
  assert.equal(needsOriginalYearHydration(retried), false);
  const committed = toCommittedArtworkEnrichmentEntry(retried);
  assert.equal(Object.hasOwn(committed, "originalYearHydrationStatus"), false);
  assert.equal(Object.hasOwn(committed, "originalYearHydrationError"), false);
});

test("original-year hydration accepts MusicBrainz partial dates and rejects malformed dates", () => {
  assert.equal(originalReleaseYearFromDate("1999"), 1999);
  assert.equal(originalReleaseYearFromDate("1999-02"), 1999);
  assert.equal(originalReleaseYearFromDate("2000-02-29"), 2000);
  assert.equal(originalReleaseYearFromDate("1999-not-a-date"), null);
  assert.equal(originalReleaseYearFromDate("1999-13"), null);
  assert.equal(originalReleaseYearFromDate("1999-02-29"), null);
});

test("public data-quality projection excludes secret-derived and private fields", () => {
  const summary = createPublicDataQualitySummary({
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    staged: { products: 1 },
    filtering: {},
    quality: {},
    artwork: {},
    acceptance: {},
    pseudonymKeyFingerprint: "secret-derived",
    sourceFiles: { metadata: { sha256: "internal" } },
    stagingFiles: { products: { sha256: "internal" } },
  }, { sourceRevision: "revision" });
  assert.equal(Object.hasOwn(summary, "pseudonymKeyFingerprint"), false);
  assert.equal(Object.hasOwn(summary, "sourceFiles"), false);
  assert.equal(Object.hasOwn(summary, "stagingFiles"), false);
  assert.equal(JSON.stringify(summary).includes("secret-derived"), false);
});
