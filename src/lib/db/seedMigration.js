import { records } from "../../data/records.js";
import { toPersistenceProduct } from "../../repositories/catalogMapping.js";

// Catalog content managed by the seed. The `deletedAt` tombstone is intentionally
// excluded: an operator's soft-delete is an editorial decision the seed must not
// reconcile away, so tombstone state never drives an update or gets rewritten.
const managedFields = [
  "publicId",
  "slug",
  "title",
  "artist",
  "genre",
  "year",
  "price",
  "currency",
  "stock",
  "condition",
  "label",
  "format",
  "pressing",
  "description",
  "imageUrl",
  "source",
];

const sameValue = (left, right) => JSON.stringify(left) === JSON.stringify(right);

// Strip the tombstone from update payloads so a re-run can never resurrect a
// soft-deleted record by writing `deletedAt: null` back over a tombstone date.
const withoutTombstone = ({ deletedAt: _omit, ...fields }) => fields;

function groupBy(records, selector) {
  const groups = new Map();
  for (const record of records) {
    const key = selector(record);
    const group = groups.get(key);
    if (group) group.push(record);
    else groups.set(key, [record]);
  }
  return groups;
}

export function planSeedMigration(existingRecords, seedRecords = records) {
  const actions = [];
  const publicIdGroups = groupBy(existingRecords, (record) => record.publicId);
  const slugGroups = groupBy(existingRecords, (record) => record.slug);
  const duplicatePublicIds = new Set(
    [...publicIdGroups].filter(([, group]) => group.length > 1).map(([publicId]) => publicId),
  );
  const duplicateSlugs = new Set(
    [...slugGroups].filter(([, group]) => group.length > 1).map(([slug]) => slug),
  );

  for (const publicId of duplicatePublicIds) {
    actions.push({ type: "conflict", publicId, reason: "duplicate-public-id" });
  }
  for (const slug of duplicateSlugs) {
    actions.push({ type: "conflict", publicId: null, slug, reason: "duplicate-slug" });
  }

  for (const seedRecord of seedRecords) {
    const desired = toPersistenceProduct(seedRecord);
    if (duplicatePublicIds.has(desired.publicId) || duplicateSlugs.has(desired.slug)) continue;
    const existing = publicIdGroups.get(desired.publicId)?.[0];
    const slugOwner = slugGroups.get(desired.slug)?.[0];

    if (!existing) {
      if (slugOwner && slugOwner.publicId !== desired.publicId) {
        actions.push({ type: "conflict", publicId: desired.publicId, reason: "slug-in-use" });
      } else {
        actions.push({ type: "create", publicId: desired.publicId, desired });
      }
      continue;
    }

    if (existing.slug !== desired.slug) {
      actions.push({ type: "conflict", publicId: desired.publicId, reason: "slug-mismatch" });
      continue;
    }
    if (existing.source !== "demo-seed") {
      actions.push({ type: "conflict", publicId: desired.publicId, reason: "source-owned" });
      continue;
    }

    const changed = managedFields.some((field) => !sameValue(existing[field] ?? null, desired[field] ?? null));
    actions.push({
      type: changed ? "update" : "unchanged",
      publicId: desired.publicId,
      ...(changed ? { desired: withoutTombstone(desired) } : {}),
    });
  }

  return actions;
}

export function summarizeMigration(actions) {
  const summary = { creates: 0, updates: 0, unchanged: 0, conflicts: 0 };
  for (const action of actions) {
    if (action.type === "create") summary.creates += 1;
    if (action.type === "update") summary.updates += 1;
    if (action.type === "unchanged") summary.unchanged += 1;
    if (action.type === "conflict") summary.conflicts += 1;
  }
  return summary;
}
