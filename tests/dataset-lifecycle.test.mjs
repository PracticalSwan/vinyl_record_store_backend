import assert from "node:assert/strict";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  assertActivatableDatasetImport,
  assertDatasetImportEvidenceOwnership,
  assertDatasetImportOwnership,
  assertFailedImportCleanable,
  assertRollbackTarget,
  canResumeInactiveImport,
  isSealedDatasetImport,
  sameDigestSet,
  validRecordDigest,
  withRecordDigest,
  writeJsonAtomically,
} from "../src/lib/dataset/integrity.js";
import { readRatingRows, verifySourceFile } from "../src/lib/dataset/amazonReviews2023.js";

test("record digests reject changed immutable content and exact sets reject stale rows", () => {
  const first = withRecordDigest({ datasetKey: "v2", publicId: 100001, title: "Fixture" });
  const second = withRecordDigest({ datasetKey: "v2", publicId: 100002, title: "Second" });
  assert.equal(validRecordDigest(first), true);
  assert.equal(validRecordDigest({ ...first, title: "Changed" }), false);
  assert.equal(sameDigestSet([first.recordDigest, second.recordDigest], new Set([second.recordDigest, first.recordDigest])), true);
  assert.equal(sameDigestSet([first.recordDigest], new Set([first.recordDigest, second.recordDigest])), false);
});

test("immutable import ownership refuses changed content under the same key", () => {
  const existing = {
    configDigest: "a".repeat(64),
    productCollection: "datasetProducts",
    sourceVersion: "v2",
  };
  assert.doesNotThrow(() => assertDatasetImportOwnership(existing, existing));
  assert.throws(
    () => assertDatasetImportOwnership(existing, { ...existing, configDigest: "b".repeat(64) }),
    /different content or storage/,
  );
});

test("immutable import evidence rejects changed identity, artwork, source, or staging inputs", () => {
  const evidence = {
    identityRegistryDigest: "a".repeat(64),
    artworkEntriesDigest: "b".repeat(64),
    sourceFiles: {
      metadata: { bytes: 10, sha256: "c".repeat(64) },
      ratings: { bytes: 20, sha256: "d".repeat(64) },
    },
    stagingFiles: {
      products: { bytes: 30, sha256: "e".repeat(64) },
      ratings: { bytes: 40, sha256: "f".repeat(64) },
    },
  };
  assert.doesNotThrow(() => assertDatasetImportEvidenceOwnership(evidence, evidence));
  for (const [path, value] of [
    ["identityRegistryDigest", "0".repeat(64)],
    ["artworkEntriesDigest", "0".repeat(64)],
  ]) {
    assert.throws(
      () => assertDatasetImportEvidenceOwnership(evidence, { ...evidence, [path]: value }),
      /different staged evidence/,
    );
  }
  for (const group of ["sourceFiles", "stagingFiles"]) {
    for (const field of ["metadata", "ratings", "products"]) {
      if (!evidence[group][field]) continue;
      assert.throws(
        () => assertDatasetImportEvidenceOwnership(evidence, {
          ...evidence,
          [group]: {
            ...evidence[group],
            [field]: { ...evidence[group][field], bytes: evidence[group][field].bytes + 1 },
          },
        }),
        /different staged evidence/,
      );
    }
  }
});

test("the lifecycle resumes only failed inactive work and activates only sealed versions", () => {
  const interrupted = { status: "failed", active: false, sealedAt: null };
  const completed = { status: "completed", active: false, sealedAt: new Date() };
  assert.equal(canResumeInactiveImport(interrupted), true);
  assert.equal(canResumeInactiveImport({ status: "importing", active: false, sealedAt: null }), true);
  assert.equal(canResumeInactiveImport({ ...interrupted, active: true }), false);
  assert.equal(canResumeInactiveImport({ status: "completed", active: false, sealedAt: null }), false);
  assert.equal(isSealedDatasetImport(completed), true);
  assert.doesNotThrow(() => assertActivatableDatasetImport(completed));
  assert.throws(() => assertActivatableDatasetImport(interrupted), /sealed completed/);
  assert.doesNotThrow(() => assertRollbackTarget({ status: "superseded", active: false, sealedAt: new Date() }));
  assert.doesNotThrow(() => assertRollbackTarget(
    { status: "superseded", active: false, sealedAt: null },
    { allowLegacyUnsealed: true },
  ));
  assert.throws(() => assertRollbackTarget({ status: "superseded", active: false, sealedAt: null }), /Rollback target/);
  assert.throws(() => assertRollbackTarget({ status: "failed", active: false }), /Rollback target/);
  assert.throws(() => assertRollbackTarget({ status: "completed", active: true }), /Rollback target/);
  assert.doesNotThrow(() => assertFailedImportCleanable(interrupted));
  assert.throws(() => assertFailedImportCleanable(completed), /unsealed inactive/);
  assert.throws(() => assertFailedImportCleanable({ ...interrupted, active: true }), /unsealed inactive/);
});

test("source verification fails closed for a wrong hash and truncated gzip", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dataset-lifecycle-"));
  try {
    const source = path.join(directory, "source.bin");
    await writeFile(source, "bounded fixture", "utf8");
    await assert.rejects(
      () => verifySourceFile(source, { bytes: 15, sha256: "0".repeat(64) }),
      /failed SHA-256 validation/,
    );

    const truncatedGzip = path.join(directory, "ratings.csv.gz");
    await writeFile(truncatedGzip, Buffer.from([0x1f, 0x8b, 0x08, 0x00, 0x00]));
    await assert.rejects(async () => {
      for await (const _row of readRatingRows(truncatedGzip)) {
        // The iterator must surface the decompressor error before yielding.
      }
    });
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("checkpoint publication replaces complete JSON without leaving a temporary file", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "dataset-checkpoint-"));
  try {
    const destination = path.join(directory, "progress.json");
    await writeFile(destination, "{\"old\":true}\n", "utf8");
    await writeJsonAtomically(destination, { entries: [{ publicId: 100_001 }] }, { processId: "test" });
    assert.deepEqual(JSON.parse(await readFile(destination, "utf8")), {
      entries: [{ publicId: 100_001 }],
    });
    assert.deepEqual(await readdir(directory), ["progress.json"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

test("exact re-import with identical evidence does not throw on ownership check", () => {
  const base = {
    configDigest: "a".repeat(64),
    productCollection: "datasetProducts",
    sourceVersion: "v3",
    identityRegistryDigest: "b".repeat(64),
    artworkEntriesDigest: "c".repeat(64),
    sourceFiles: {
      metadata: { bytes: 10, sha256: "d".repeat(64) },
      ratings: { bytes: 20, sha256: "e".repeat(64) },
    },
    stagingFiles: {
      products: { bytes: 30, sha256: "f".repeat(64) },
      ratings: { bytes: 40, sha256: "g".repeat(64) },
    },
  };
  // Exact re-import: same config, same evidence, same collection.
  assert.doesNotThrow(() => assertDatasetImportOwnership(base, base));
  assert.doesNotThrow(() => assertDatasetImportEvidenceOwnership(base, base));
});

test("activation of an unsealed completed import is rejected", () => {
  const unsealed = { status: "completed", active: false, sealedAt: null };
  assert.equal(isSealedDatasetImport(unsealed), false);
  assert.throws(() => assertActivatableDatasetImport(unsealed), /sealed completed/);
});

test("activation of a sealed completed import succeeds", () => {
  const sealed = { status: "completed", active: false, sealedAt: new Date() };
  assert.equal(isSealedDatasetImport(sealed), true);
  assert.doesNotThrow(() => assertActivatableDatasetImport(sealed));
});

test("rollback target must be inactive, completed or superseded, and sealed", () => {
  const validTarget = { status: "superseded", active: false, sealedAt: new Date() };
  assert.doesNotThrow(() => assertRollbackTarget(validTarget));
  // Active target rejected.
  assert.throws(() => assertRollbackTarget({ ...validTarget, active: true }), /Rollback target/);
  // Unsealed rejected unless legacy.
  assert.throws(
    () => assertRollbackTarget({ status: "superseded", active: false, sealedAt: null }),
    /Rollback target/,
  );
  // Failed status rejected.
  assert.throws(() => assertRollbackTarget({ status: "failed", active: false, sealedAt: new Date() }), /Rollback target/);
  // Legacy unsealed allowed with flag.
  assert.doesNotThrow(() => assertRollbackTarget(
    { status: "superseded", active: false, sealedAt: null },
    { allowLegacyUnsealed: true },
  ));
});

test("failed-import cleanup rejects active, sealed, and non-failed documents", () => {
  const failed = { status: "failed", active: false, sealedAt: null };
  assert.doesNotThrow(() => assertFailedImportCleanable(failed));
  // Active failed rejected.
  assert.throws(() => assertFailedImportCleanable({ ...failed, active: true }), /unsealed inactive/);
  // Sealed completed rejected.
  assert.throws(() => assertFailedImportCleanable(
    { status: "completed", active: false, sealedAt: new Date() },
  ), /unsealed inactive/);
  // Importing but sealed rejected.
  assert.throws(() => assertFailedImportCleanable(
    { status: "importing", active: false, sealedAt: new Date() },
  ), /unsealed inactive/);
});

test("resume accepts only importing or failed inactive unsealed states", () => {
  assert.equal(canResumeInactiveImport({ status: "importing", active: false, sealedAt: null }), true);
  assert.equal(canResumeInactiveImport({ status: "failed", active: false, sealedAt: null }), true);
  assert.equal(canResumeInactiveImport({ status: "completed", active: false, sealedAt: null }), false);
  assert.equal(canResumeInactiveImport({ status: "active", active: false, sealedAt: null }), false);
  assert.equal(canResumeInactiveImport({ status: "failed", active: true, sealedAt: null }), false);
  assert.equal(canResumeInactiveImport({ status: "failed", active: false, sealedAt: new Date() }), false);
  assert.equal(canResumeInactiveImport(null), false);
});
