import {
  normalizedPressingIdentity,
  normalizedProductIdentity,
} from "./normalize.js";

function addToIndex(index, key, value) {
  if (!key) return;
  const group = index.get(key);
  if (group) group.push(value);
  else index.set(key, [value]);
}

function buildIndex(records) {
  const index = {
    publicId: new Map(),
    releaseId: new Map(),
    identity: new Map(),
    pressing: new Map(),
  };
  for (const record of records) {
    addToIndex(index.publicId, record.publicId ?? record.id, record);
    addToIndex(index.releaseId, record.musicBrainzReleaseId, record);
    addToIndex(index.identity, normalizedProductIdentity(record), record);
    addToIndex(index.pressing, normalizedPressingIdentity(record), record);
  }
  return index;
}

function unique(groups) {
  const records = new Map();
  for (const group of groups) {
    for (const record of group || []) {
      const key = record._id?.toString?.() || `public:${record.publicId ?? record.id}`;
      records.set(key, record);
    }
  }
  return [...records.values()];
}

export function findDuplicateCandidates(record, existingRecords) {
  const index = buildIndex(existingRecords);
  const direct = record.publicId ? index.publicId.get(record.publicId) : [];
  const release = record.musicBrainzReleaseId
    ? index.releaseId.get(record.musicBrainzReleaseId)
    : [];
  const exactPressing = index.pressing.get(normalizedPressingIdentity(record)) || [];
  const sameRelease = index.identity.get(normalizedProductIdentity(record)) || [];
  // A release group legitimately spans multiple pressings, formats, and
  // countries, so it is intentionally NOT a same-product key. A shared group
  // must fall through to sameRelease so a differing pressing forces review.
  const candidates = unique([direct, release, exactPressing]);

  return {
    candidates,
    sameRelease,
    requiresPressingReview: candidates.length === 0 && sameRelease.length > 0,
  };
}

export function findBatchDuplicates(rows) {
  const seenPublicIds = new Map();
  const seenReleaseIds = new Map();
  const seenPressings = new Map();
  const duplicates = [];
  for (const row of rows) {
    const checks = [
      ["publicId", row.value.publicId, seenPublicIds],
      ["musicBrainzReleaseId", row.value.musicBrainzReleaseId, seenReleaseIds],
      ["identity", normalizedPressingIdentity(row.value), seenPressings],
    ];
    for (const [field, key, index] of checks) {
      if (!key) continue;
      if (index.has(key)) {
        duplicates.push({
          rowNumber: row.rowNumber,
          otherRowNumber: index.get(key),
          field,
          code: "DUPLICATE_IMPORT_ROW",
        });
      } else {
        index.set(key, row.rowNumber);
      }
    }
  }
  return duplicates;
}
