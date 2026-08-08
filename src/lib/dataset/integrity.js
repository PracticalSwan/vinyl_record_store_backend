import { createHash } from "node:crypto";
import { rename, rm, writeFile } from "node:fs/promises";

export const SEALED_DATASET_STATUSES = Object.freeze(["completed", "active", "superseded"]);

export async function writeJsonAtomically(filePath, value, { processId = process.pid } = {}) {
  const temporaryPath = `${filePath}.${processId}.tmp`;
  try {
    await writeFile(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
    await rename(temporaryPath, filePath);
  } finally {
    await rm(temporaryPath, { force: true }).catch(() => {});
  }
}

export function computeRecordDigest(value) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

export function withRecordDigest(value) {
  return { ...value, recordDigest: computeRecordDigest(value) };
}

export function validRecordDigest(record) {
  if (!record || typeof record !== "object") return false;
  const { recordDigest, ...value } = record;
  return /^[0-9a-f]{64}$/.test(String(recordDigest || ""))
    && computeRecordDigest(value) === recordDigest;
}

export function sameDigestSet(actual, expected) {
  const actualSet = new Set(actual);
  const expectedSet = new Set(expected);
  return actualSet.size === expectedSet.size
    && [...actualSet].every((digest) => expectedSet.has(digest));
}

export function isSealedDatasetImport(document) {
  return Boolean(document?.sealedAt) && SEALED_DATASET_STATUSES.includes(document?.status);
}

export function assertDatasetImportOwnership(existing, expected) {
  if (!existing) return;
  if (
    existing.configDigest !== expected.configDigest
    || existing.productCollection !== expected.productCollection
    || existing.sourceVersion !== expected.sourceVersion
  ) {
    throw new Error("This immutable dataset key already belongs to different content or storage.");
  }
}

function sameFileEvidence(actual, expected) {
  return actual?.bytes === expected?.bytes && actual?.sha256 === expected?.sha256;
}

export function assertDatasetImportEvidenceOwnership(existing, expected) {
  if (!existing) return;
  const sameEvidence = [
    [existing.identityRegistryDigest, expected.identityRegistryDigest],
    [existing.artworkEntriesDigest, expected.artworkEntriesDigest],
    [existing.sourceFiles?.metadata, expected.sourceFiles?.metadata],
    [existing.sourceFiles?.ratings, expected.sourceFiles?.ratings],
    [existing.stagingFiles?.products, expected.stagingFiles?.products],
    [existing.stagingFiles?.ratings, expected.stagingFiles?.ratings],
  ].every(([actual, wanted], index) => index < 2 ? actual === wanted : sameFileEvidence(actual, wanted));
  if (!sameEvidence) {
    throw new Error("This immutable dataset key already belongs to different staged evidence.");
  }
}

export function canResumeInactiveImport(document) {
  return Boolean(document)
    && !document.active
    && !document.sealedAt
    && ["importing", "failed"].includes(document.status);
}

export function assertActivatableDatasetImport(document) {
  if (!isSealedDatasetImport(document)) {
    throw new Error("Only a sealed completed dataset import can be activated.");
  }
}

export function assertRollbackTarget(document, { allowLegacyUnsealed = false } = {}) {
  if (
    !document
    || document.active
    || !["completed", "superseded"].includes(document.status)
    || (!allowLegacyUnsealed && !document.sealedAt)
  ) {
    throw new Error("Rollback target is not an inactive completed dataset import.");
  }
}

export function assertFailedImportCleanable(document) {
  if (!document || document.active || document.sealedAt || !["failed", "importing"].includes(document.status)) {
    throw new Error("Only an unsealed inactive failed or interrupted import can be cleaned.");
  }
}
