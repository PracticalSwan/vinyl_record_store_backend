import { hasLocalArtwork } from "../services/localArtwork.js";
import { cleanPresentationArtist, cleanPresentationTitle, supplementalArtworkForProduct } from "../lib/catalog/presentationOverlay.js";

const valueOf = (record) => (
  typeof record?.toObject === "function" ? record.toObject() : record
);

const toIso = (value) => (value instanceof Date ? value.toISOString() : (value ? new Date(value).toISOString() : null));

const toProvenance = (value) => {
  if (!Array.isArray(value)) return [];
  return value.map((entry) => ({
    field: entry.field ?? null,
    source: entry.source ?? null,
    sourceId: entry.sourceId ?? null,
    retrievedAt: toIso(entry.retrievedAt),
  }));
};

const approvedUrl = (value, hosts) => {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && hosts.includes(url.hostname.toLowerCase())
      ? url.toString()
      : null;
  } catch {
    return null;
  }
};

export function toPublicProduct(record) {
  const value = valueOf(record);
  if (!value) return null;
  const legacy = !value.datasetKey && (!value.source || value.source === "demo-seed");
  const legacyOrigins = legacy ? {
    title: "legacy",
    artist: "legacy",
    genre: "legacy",
    year: "legacy",
    price: "legacy",
    currency: "legacy",
    stock: "legacy",
    condition: "legacy",
    format: "legacy",
    label: "legacy",
    artwork: "legacy",
  } : {};

  const legacyUrl = value.imageUrl ?? value.artwork?.url ?? null;
  const supplementalArtwork = supplementalArtworkForProduct(
    value.publicId ?? value.id,
    value.datasetKey,
  );
  const presentationArtwork = value.artwork?.thumbnailUrl ? value.artwork : supplementalArtwork;
  const thumbnailUrl = approvedUrl(
    presentationArtwork?.thumbnailUrl,
    ["coverartarchive.org", "www.coverartarchive.org"],
  );
  const detailUrl = approvedUrl(
    presentationArtwork?.detailUrl,
    ["coverartarchive.org", "www.coverartarchive.org"],
  );
  const sourceUrl = approvedUrl(
    presentationArtwork?.sourceUrl,
    ["musicbrainz.org", "www.musicbrainz.org"],
  );
  const hasStructuredImage = Boolean(
    thumbnailUrl
    && detailUrl
    && presentationArtwork?.source === "cover-art-archive"
    && sourceUrl,
  );

  return {
    id: value.publicId ?? value.id,
    title: cleanPresentationTitle(value.title),
    artist: cleanPresentationArtist(value.artist),
    genre: value.genre,
    year: value.year,
    originalReleaseYear: value.originalReleaseYear ?? null,
    editionReleaseYear: value.editionReleaseYear ?? null,
    yearDisplayType: value.yearDisplayType || (value.year ? "original" : "unknown"),
    price: value.price,
    stock: value.stock,
    condition: value.condition,
    label: value.label,
    format: value.format,
    pressing: value.pressing,
    description: value.description,
    currency: value.currency ?? (Number.isFinite(value.price) ? "USD" : null),
    imageUrl: legacyUrl,
    image: hasStructuredImage ? {
      thumbnailUrl,
      detailUrl,
      source: presentationArtwork.source,
      sourceUrl,
    } : null,
    localArtworkAvailable: hasLocalArtwork(value.publicId ?? value.id),
    source: value.source ?? (legacy ? "demo-seed" : null),
    datasetKey: value.datasetKey ?? null,
    sourceVersion: value.sourceVersion ?? null,
    catalogMode: value.datasetKey ? "research-only" : "commerce-preview",
    fieldOrigins: value.fieldOrigins && typeof value.fieldOrigins === "object"
      ? { ...value.fieldOrigins }
      : legacyOrigins,
    qualityFlags: Array.isArray(value.qualityFlags) ? [...value.qualityFlags] : [],
  };
}

// Admin-facing product view. Extends the public product with the fields an
// administrator needs for maintenance (optimistic-concurrency token, soft-delete
// state, source ownership, provenance, and raw MusicBrainz/artwork state).
// It does NOT surface the seed-only recommendation `reason`.
export function toAdminProduct(record) {
  const value = valueOf(record);
  if (!value) return null;
  const base = toPublicProduct(value);
  const artwork = value.artwork && typeof value.artwork === "object" ? value.artwork : {};
  const provenance = toProvenance(value.provenance).map((entry) => (
    value.datasetKey && entry.source === "amazon-reviews-2023"
      ? { ...entry, sourceId: null }
      : entry
  ));
  return {
    ...base,
    musicBrainzReleaseId: value.musicBrainzReleaseId ?? null,
    musicBrainzReleaseGroupId: value.musicBrainzReleaseGroupId ?? null,
    artwork: {
      thumbnailUrl: artwork.thumbnailUrl ?? null,
      detailUrl: artwork.detailUrl ?? null,
      source: artwork.source ?? null,
      sourceUrl: artwork.sourceUrl ?? null,
      retrievedAt: toIso(artwork.retrievedAt),
    },
    provenance,
    updatedAt: toIso(value.updatedAt),
    deletedAt: toIso(value.deletedAt),
  };
}

export function slugifyProduct(record) {
  if (record.slug) return record.slug;
  const base = `${record.artist}-${record.title}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 280)
    .replace(/-+$/g, "");
  return `${base || "record"}-${record.id}`;
}

export function toPersistenceProduct(record) {
  const product = toPublicProduct(record);
  return {
    publicId: product.id,
    slug: slugifyProduct(record),
    title: product.title,
    artist: product.artist,
    genre: product.genre,
    year: product.year,
    originalReleaseYear: product.originalReleaseYear,
    editionReleaseYear: product.editionReleaseYear,
    yearDisplayType: product.yearDisplayType,
    price: product.price,
    currency: product.currency,
    stock: product.stock,
    condition: product.condition,
    label: product.label,
    format: product.format,
    pressing: product.pressing,
    description: product.description,
    imageUrl: product.imageUrl,
    musicBrainzReleaseId: record.musicBrainzReleaseId ?? null,
    musicBrainzReleaseGroupId: record.musicBrainzReleaseGroupId ?? null,
    artwork: record.artwork ? { ...record.artwork } : {},
    source: "demo-seed",
    datasetKey: null,
    sourceVersion: null,
    externalItemKey: null,
    fieldOrigins: {
      title: "legacy",
      artist: "legacy",
      genre: "legacy",
      year: "legacy",
      price: "legacy",
      currency: "legacy",
      stock: "legacy",
      condition: "legacy",
      format: "legacy",
      label: "legacy",
      artwork: "legacy",
    },
    qualityFlags: [],
    provenance: Array.isArray(record.provenance) ? record.provenance : [],
    deletedAt: null,
  };
}
