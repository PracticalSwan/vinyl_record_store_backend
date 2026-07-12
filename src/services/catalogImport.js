import { comparisonKey, normalizeGenre } from "../lib/catalog/normalize.js";
import { findBatchDuplicates, findDuplicateCandidates } from "../lib/catalog/deduplicate.js";
import { validateImportRows } from "../lib/catalog/validateImport.js";
import { createCoverArtArchiveClient } from "../lib/external/coverArtArchiveClient.js";
import { createMusicBrainzClient } from "../lib/external/musicBrainzClient.js";
import { Counter } from "../models/Counter.js";
import { VinylRecord } from "../models/VinylRecord.js";
import { slugifyProduct } from "../repositories/catalogMapping.js";

const defaultMusicBrainzClient = createMusicBrainzClient();
const defaultCoverArtArchiveClient = createCoverArtArchiveClient();

const MANAGED_FIELDS = [
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
  "musicBrainzReleaseId",
  "musicBrainzReleaseGroupId",
  "artwork",
  "provenance",
  "source",
];

const sameValue = (left, right) => JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
const reportIssue = (code, message, details = {}) => ({ code, message, ...details });

function artistMatches(candidate, artist) {
  const expected = comparisonKey(artist);
  return comparisonKey(candidate.artistCreditPhrase) === expected
    || candidate.artistCredit.some((credit) => comparisonKey(credit) === expected);
}

function candidateMatches(candidate, record) {
  const candidateYear = candidate.date ? Number.parseInt(candidate.date.slice(0, 4), 10) : null;
  return candidate.score >= 95
    && comparisonKey(candidate.title) === comparisonKey(record.title)
    && artistMatches(candidate, record.artist)
    && (!record.year || candidateYear === record.year)
    && (!record.musicBrainzReleaseGroupId
      || candidate.releaseGroupId === record.musicBrainzReleaseGroupId);
}

function provenance(field, source, sourceId, retrievedAt) {
  return { field, source, sourceId, retrievedAt };
}

export async function enrichCatalogRows(validatedRows, {
  enabled = false,
  musicBrainz = defaultMusicBrainzClient,
  coverArt = defaultCoverArtArchiveClient,
  now = () => new Date(),
} = {}) {
  if (!enabled) return validatedRows;
  const results = [];
  for (const row of validatedRows) {
    if (!row.value || row.errors.length > 0) {
      results.push(row);
      continue;
    }
    const next = {
      ...row,
      value: { ...row.value, provenance: [...row.value.provenance] },
      errors: [...row.errors],
      warnings: [...row.warnings],
    };
    try {
      let release;
      if (next.value.musicBrainzReleaseId) {
        release = await musicBrainz.getRelease(next.value.musicBrainzReleaseId);
        if (!release) {
          next.errors.push(reportIssue(
            "MUSICBRAINZ_NOT_FOUND",
            "The supplied MusicBrainz release was not found.",
            { field: "musicBrainzReleaseId" },
          ));
        } else if (!candidateMatches({ ...release, score: 100 }, next.value)) {
          next.errors.push(reportIssue(
            "MUSICBRAINZ_MISMATCH",
            "The supplied MusicBrainz release does not match the imported artist, title, and year.",
            { field: "musicBrainzReleaseId" },
          ));
        }
      } else {
        const candidates = await musicBrainz.findReleaseCandidates(next.value);
        const exact = candidates.filter((candidate) => candidateMatches(candidate, next.value));
        if (exact.length === 1) {
          release = await musicBrainz.getRelease(exact[0].id);
          if (release && candidateMatches({ ...release, score: 100 }, next.value)) {
            next.value.musicBrainzReleaseId = release.id;
          } else {
            release = null;
            next.warnings.push(reportIssue(
              "MUSICBRAINZ_DETAIL_MISMATCH",
              "The exact search result could not be verified against its release detail.",
              { field: "musicBrainzReleaseId" },
            ));
          }
        } else {
          next.warnings.push(reportIssue(
            exact.length > 1 ? "AMBIGUOUS_MUSICBRAINZ_MATCH" : "NO_MUSICBRAINZ_MATCH",
            exact.length > 1
              ? "Multiple exact MusicBrainz releases require administrator review."
              : "No exact MusicBrainz release was accepted; the placeholder remains active.",
            {
              field: "musicBrainzReleaseId",
              candidateIds: exact.map((candidate) => candidate.id),
            },
          ));
        }
      }

      if (release && next.errors.length === 0) {
        const retrievedAt = now();
        next.value.musicBrainzReleaseGroupId = next.value.musicBrainzReleaseGroupId
          || release.releaseGroupId
          || null;
        next.value.provenance.push(provenance(
          "musicBrainzReleaseId",
          "musicbrainz",
          release.id,
          retrievedAt,
        ));
        if (release.releaseGroupId) {
          next.value.provenance.push(provenance(
            "musicBrainzReleaseGroupId",
            "musicbrainz",
            release.releaseGroupId,
            retrievedAt,
          ));
        }
        const releaseYear = release.date ? Number.parseInt(release.date.slice(0, 4), 10) : null;
        if (!next.value.year && Number.isInteger(releaseYear)) {
          next.value.year = releaseYear;
          next.value.provenance.push(provenance("year", "musicbrainz", release.id, retrievedAt));
        }
        if (!next.value.label && release.label) {
          next.value.label = release.label;
          next.value.provenance.push(provenance("label", "musicbrainz", release.id, retrievedAt));
        }
        if (!next.value.genre) {
          const genre = (release.genres || []).map(normalizeGenre).find(Boolean);
          if (genre) {
            next.value.genre = genre;
            next.value.provenance.push(provenance("genre", "musicbrainz", release.id, retrievedAt));
          }
        }
        let artwork = await coverArt.getReleaseArtwork(release.id);
        if (!artwork && release.releaseGroupId && typeof coverArt.getReleaseGroupArtwork === "function") {
          artwork = await coverArt.getReleaseGroupArtwork(release.releaseGroupId);
          if (artwork) {
            next.warnings.push(reportIssue(
              "ARTWORK_RELEASE_GROUP_FALLBACK",
              "The exact release had no approved front artwork; approved artwork from the same release group was used.",
              { field: "artwork" },
            ));
          }
        }
        if (artwork) {
          next.value.artwork = artwork;
          next.value.provenance = next.value.provenance.filter((item) => item.field !== "artwork");
          const artworkSourceId = artwork.sourceUrl?.includes("/release-group/")
            ? release.releaseGroupId
            : release.id;
          next.value.provenance.push(provenance(
            "artwork",
            "cover-art-archive",
            artworkSourceId,
            artwork.retrievedAt,
          ));
        } else {
          next.warnings.push(reportIssue(
            "ARTWORK_NOT_FOUND",
            "No approved front artwork was found; the placeholder remains active.",
            { field: "artwork" },
          ));
        }
      }
    } catch (error) {
      next.warnings.push(reportIssue(
        "EXTERNAL_SERVICE_UNAVAILABLE",
        `${error.service || "External metadata service"} was unavailable; store data remains usable.`,
        { field: "enrichment" },
      ));
    }
    results.push(next);
  }
  return results;
}

function desiredProduct(value, publicId, slug) {
  return {
    publicId,
    slug,
    title: value.title,
    artist: value.artist,
    genre: value.genre,
    year: value.year,
    price: value.price,
    currency: value.currency,
    stock: value.stock,
    condition: value.condition,
    label: value.label,
    format: value.format,
    pressing: value.pressing,
    description: value.description,
    imageUrl: value.imageUrl,
    musicBrainzReleaseId: value.musicBrainzReleaseId,
    musicBrainzReleaseGroupId: value.musicBrainzReleaseGroupId,
    artwork: value.artwork,
    source: value.source,
    provenance: value.provenance,
  };
}

function preserveStableProvenance(value, existing) {
  if (!existing) return value;
  const next = { ...value };
  if (
    sameValue(existing.artwork?.thumbnailUrl, value.artwork?.thumbnailUrl)
    && sameValue(existing.artwork?.detailUrl, value.artwork?.detailUrl)
    && existing.artwork?.retrievedAt
    && value.artwork
  ) {
    next.artwork = { ...value.artwork, retrievedAt: existing.artwork.retrievedAt };
  }
  const unchangedFields = new Set();
  if (existing.musicBrainzReleaseId === value.musicBrainzReleaseId) unchangedFields.add("musicBrainzReleaseId");
  if (existing.musicBrainzReleaseGroupId === value.musicBrainzReleaseGroupId) unchangedFields.add("musicBrainzReleaseGroupId");
  if (
    sameValue(existing.artwork?.thumbnailUrl, value.artwork?.thumbnailUrl)
    && sameValue(existing.artwork?.detailUrl, value.artwork?.detailUrl)
  ) unchangedFields.add("artwork");
  const imported = value.provenance.filter((item) => !unchangedFields.has(item.field));
  const preserved = (existing.provenance || []).filter((item) => unchangedFields.has(item.field));
  next.provenance = [...preserved, ...imported];
  return next;
}

export function planCatalogImport(validatedRows, existingRecords) {
  const rows = validatedRows.map((row) => ({
    ...row,
    errors: [...row.errors],
    warnings: [...row.warnings],
  }));
  const validForBatchCheck = rows.filter((row) => row.value && row.errors.length === 0);
  for (const duplicate of findBatchDuplicates(validForBatchCheck)) {
    const row = rows.find((item) => item.rowNumber === duplicate.rowNumber);
    row.errors.push(reportIssue(
      duplicate.code,
      `This row duplicates row ${duplicate.otherRowNumber} by ${duplicate.field}.`,
      { field: duplicate.field, otherRowNumber: duplicate.otherRowNumber },
    ));
  }

  const actions = [];
  for (const row of rows) {
    if (!row.value || row.errors.length > 0) {
      actions.push({ type: "error", rowNumber: row.rowNumber, errors: row.errors, warnings: row.warnings });
      continue;
    }
    const duplicate = findDuplicateCandidates(row.value, existingRecords);
    if (duplicate.candidates.length > 1) {
      actions.push({
        type: "conflict",
        rowNumber: row.rowNumber,
        reason: "multiple-existing-matches",
        publicIds: duplicate.candidates.map((record) => record.publicId),
        warnings: row.warnings,
      });
      continue;
    }
    if (duplicate.requiresPressingReview) {
      actions.push({
        type: "conflict",
        rowNumber: row.rowNumber,
        reason: "pressing-review-required",
        publicIds: duplicate.sameRelease.map((record) => record.publicId),
        warnings: row.warnings,
      });
      continue;
    }

    const existing = duplicate.candidates[0] || null;
    if (existing && row.value.publicId && existing.publicId !== row.value.publicId) {
      actions.push({
        type: "conflict",
        rowNumber: row.rowNumber,
        reason: "public-id-mismatch",
        publicId: existing.publicId,
        suppliedPublicId: row.value.publicId,
        warnings: row.warnings,
      });
      continue;
    }
    if (existing?.deletedAt) {
      actions.push({ type: "conflict", rowNumber: row.rowNumber, reason: "soft-deleted", publicId: existing.publicId, warnings: row.warnings });
      continue;
    }
    if (existing && existing.source !== row.value.source) {
      actions.push({ type: "conflict", rowNumber: row.rowNumber, reason: "source-owned", publicId: existing.publicId, warnings: row.warnings });
      continue;
    }

    const publicId = existing?.publicId ?? row.value.publicId;
    const stableValue = preserveStableProvenance(row.value, existing);
    const slug = existing?.slug || (publicId ? slugifyProduct({ ...stableValue, id: publicId }) : null);
    const desired = desiredProduct(stableValue, publicId, slug);
    if (!existing) {
      actions.push({ type: "create", rowNumber: row.rowNumber, publicId, desired, warnings: row.warnings });
      continue;
    }
    const changed = MANAGED_FIELDS.some((field) => !sameValue(existing[field], desired[field]));
    actions.push({
      type: changed ? "update" : "skip",
      rowNumber: row.rowNumber,
      publicId,
      ...(changed ? { desired } : {}),
      warnings: row.warnings,
    });
  }
  return actions;
}

export function summarizeCatalogImport(actions) {
  const summary = { creates: 0, updates: 0, skips: 0, warnings: 0, errors: 0, conflicts: 0 };
  for (const action of actions) {
    if (action.type === "create") summary.creates += 1;
    if (action.type === "update") summary.updates += 1;
    if (action.type === "skip") summary.skips += 1;
    if (action.type === "error") summary.errors += 1;
    if (action.type === "conflict") summary.conflicts += 1;
    summary.warnings += action.warnings?.length || 0;
  }
  return summary;
}

export async function prepareCatalogImport(rows, options = {}) {
  const validated = validateImportRows(rows, options);
  return enrichCatalogRows(validated, options);
}

async function reservePublicIds(count, maximumImportedId, counterModel, session) {
  if (count === 0) return [];
  const counter = await counterModel.findOneAndUpdate(
    { _id: "vinylRecords" },
    [{
      $set: {
        value: { $add: [{ $max: [{ $ifNull: ["$value", 0] }, maximumImportedId] }, count] },
        updatedAt: "$$NOW",
        createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
      },
    }],
    { upsert: true, returnDocument: "after", session },
  ).lean().exec();
  const first = counter.value - count + 1;
  return Array.from({ length: count }, (_unused, index) => first + index);
}

export async function applyCatalogImport(preparedRows, {
  connection,
  model = VinylRecord,
  counterModel = Counter,
  allowPartial = false,
} = {}) {
  if (!connection) throw new Error("A MongoDB connection is required to apply a catalog import.");
  const session = await connection.startSession();
  try {
    let result;
    await session.withTransaction(async () => {
      const existing = await model.find({}).session(session).lean().exec();
      const actions = planCatalogImport(preparedRows, existing);
      const summary = summarizeCatalogImport(actions);
      if (!allowPartial && (summary.errors > 0 || summary.conflicts > 0)) {
        throw new Error("Catalog import contains errors or conflicts; no writes were applied.");
      }
      const writable = actions.filter((action) => ["create", "update"].includes(action.type));
      const needsId = writable.filter((action) => action.type === "create" && !action.publicId);
      const maximumImportedId = [...existing, ...writable].reduce(
        (value, record) => Math.max(value, record.publicId || 0),
        0,
      );
      const allocated = await reservePublicIds(
        needsId.length,
        maximumImportedId,
        counterModel,
        session,
      );
      let allocationIndex = 0;
      const operations = writable.map((action) => {
        if (action.type === "update") {
          const { publicId: _id, slug: _slug, ...fields } = action.desired;
          return {
            updateOne: {
              filter: { publicId: action.publicId, source: action.desired.source, deletedAt: null },
              update: { $set: fields },
            },
          };
        }
        const publicId = action.publicId || allocated[allocationIndex++];
        return {
          insertOne: {
            document: {
              ...action.desired,
              publicId,
              slug: slugifyProduct({ ...action.desired, id: publicId }),
              deletedAt: null,
            },
          },
        };
      });
      const writeResult = operations.length
        ? await model.bulkWrite(operations, { ordered: true, session })
        : null;
      const expectedUpdates = writable.filter((action) => action.type === "update").length;
      if ((writeResult?.matchedCount || 0) !== expectedUpdates) {
        throw new Error("Catalog changed after preview; the import was rolled back.");
      }
      result = {
        actions,
        summary,
        writes: operations.length,
        inserted: writeResult?.insertedCount || 0,
        modified: writeResult?.modifiedCount || 0,
        allocatedPublicIds: allocated,
      };
    });
    return result;
  } finally {
    await session.endSession();
  }
}
