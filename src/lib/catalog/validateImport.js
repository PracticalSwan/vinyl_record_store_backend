import {
  normalizeCondition,
  normalizeFormat,
  normalizeGenre,
  normalizeStock,
  normalizeUuid,
  normalizeWhitespace,
} from "./normalize.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SOURCE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const COVER_ART_HOSTS = new Set(["coverartarchive.org", "www.coverartarchive.org"]);
const MUSICBRAINZ_HOSTS = new Set(["musicbrainz.org", "www.musicbrainz.org"]);
const MAX_TEXT = {
  title: 200,
  artist: 200,
  label: 200,
  format: 200,
  pressing: 200,
  description: 5_000,
  source: 100,
};

function issue(field, code, message) {
  return { field, code, message };
}

function parseInteger(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : Number.NaN;
}

function parseNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function normalizeHttpsUrl(value, allowedHosts) {
  const input = normalizeWhitespace(value);
  if (!input) return null;
  try {
    const url = new URL(input);
    if (!allowedHosts.has(url.hostname.toLowerCase())) return null;
    url.protocol = "https:";
    url.username = "";
    url.password = "";
    url.hash = "";
    return url.toString();
  } catch {
    return null;
  }
}

function artworkMatchesRelease(urlValue, releaseId, releaseGroupId, { source = false } = {}) {
  if (!urlValue) return false;
  const pathname = new URL(urlValue).pathname.replace(/\/+$/, "");
  const expected = [
    releaseId ? `/release/${releaseId}` : null,
    releaseGroupId ? `/release-group/${releaseGroupId}` : null,
  ].filter(Boolean);
  return expected.some((prefix) => source ? pathname === prefix : pathname.startsWith(`${prefix}/`));
}

export function validateArtwork(value, {
  releaseId = null,
  releaseGroupId = null,
  retrievedAt = new Date(),
} = {}) {
  if (!value) return { value: {}, errors: [] };
  if (typeof value !== "object" || Array.isArray(value)) {
    return { value: {}, errors: [issue("artwork", "INVALID_ARTWORK", "Artwork must be an object.")] };
  }

  const thumbnailUrl = normalizeHttpsUrl(value.thumbnailUrl || value.url, COVER_ART_HOSTS);
  const detailUrl = normalizeHttpsUrl(value.detailUrl || value.url, COVER_ART_HOSTS);
  const sourceUrl = normalizeHttpsUrl(value.sourceUrl, MUSICBRAINZ_HOSTS);
  const errors = [];
  const supplied = [value.thumbnailUrl, value.detailUrl, value.url, value.sourceUrl].some(Boolean);
  if (supplied && (!thumbnailUrl || !detailUrl || !sourceUrl)) {
    errors.push(issue(
      "artwork",
      "UNAPPROVED_ARTWORK_URL",
      "Artwork URLs must use approved Cover Art Archive and MusicBrainz hosts.",
    ));
  }
  if (supplied && value.source !== "cover-art-archive") {
    errors.push(issue(
      "artwork.source",
      "UNAPPROVED_ARTWORK_SOURCE",
      "Artwork source must be cover-art-archive.",
    ));
  }
  if (supplied && !releaseId && !releaseGroupId) {
    errors.push(issue(
      "artwork",
      "UNVERIFIED_ARTWORK_MATCH",
      "Artwork requires a matching MusicBrainz release or release-group ID.",
    ));
  } else if (supplied && thumbnailUrl && detailUrl && sourceUrl && (
    !artworkMatchesRelease(sourceUrl, releaseId, releaseGroupId, { source: true })
    || !artworkMatchesRelease(thumbnailUrl, releaseId, releaseGroupId)
    || !artworkMatchesRelease(detailUrl, releaseId, releaseGroupId)
  )) {
    errors.push(issue(
      "artwork",
      "ARTWORK_RELEASE_MISMATCH",
      "Artwork URLs must identify the imported MusicBrainz release or release group.",
    ));
  }

  return {
    value: supplied && errors.length === 0 ? {
      url: detailUrl,
      thumbnailUrl,
      detailUrl,
      source: "cover-art-archive",
      sourceUrl,
      retrievedAt,
    } : {},
    errors,
  };
}

export function normalizeAndValidateImportRow(input, rowNumber, {
  currentYear = new Date().getUTCFullYear(),
  now = () => new Date(),
} = {}) {
  const errors = [];
  const warnings = [];
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    return {
      rowNumber,
      value: null,
      errors: [issue("row", "INVALID_ROW", "Each import row must be an object.")],
      warnings,
    };
  }

  const publicId = parseInteger(input.publicId ?? input.id);
  const year = parseInteger(input.year);
  const price = parseNumber(input.price);
  const source = normalizeWhitespace(input.source);
  const currency = normalizeWhitespace(input.currency || "USD").toUpperCase();
  const value = {
    publicId,
    title: normalizeWhitespace(input.title),
    artist: normalizeWhitespace(input.artist),
    genre: normalizeGenre(input.genre),
    year,
    price,
    currency,
    stock: normalizeStock(input.stock),
    condition: normalizeCondition(input.condition),
    label: normalizeWhitespace(input.label) || null,
    format: normalizeFormat(input.format),
    pressing: normalizeWhitespace(input.pressing) || null,
    description: normalizeWhitespace(input.description) || null,
    source,
    musicBrainzReleaseId: normalizeUuid(input.musicBrainzReleaseId),
    musicBrainzReleaseGroupId: normalizeUuid(input.musicBrainzReleaseGroupId),
    imageUrl: null,
    // Provenance is server-generated. Import files name their authoritative
    // source but cannot inject arbitrary provenance claims.
    provenance: [],
  };

  for (const field of ["title", "artist", "price", "stock", "condition", "format", "source"]) {
    if (value[field] === null || value[field] === "" || Number.isNaN(value[field])) {
      errors.push(issue(field, "REQUIRED", `${field} is required and must be valid.`));
    }
  }
  if (publicId !== null && (Number.isNaN(publicId) || publicId < 1 || publicId > 1_000_000)) {
    errors.push(issue("publicId", "INVALID_PUBLIC_ID", "publicId must be an integer from 1 through 1000000."));
  }
  if (year !== null && (Number.isNaN(year) || year < 1900 || year > currentYear + 1)) {
    errors.push(issue("year", "INVALID_YEAR", `year must be from 1900 through ${currentYear + 1}.`));
  }
  if (price !== null && !Number.isNaN(price) && (price < 0 || price > 1_000_000)) {
    errors.push(issue("price", "INVALID_PRICE", "price must be from 0 through 1000000."));
  }
  if (currency !== "USD") {
    errors.push(issue("currency", "UNSUPPORTED_CURRENCY", "Only USD is supported."));
  }
  if (!SOURCE_PATTERN.test(source)) {
    errors.push(issue("source", "INVALID_SOURCE", "source must use letters, numbers, dots, underscores, or hyphens."));
  }
  for (const [field, maxLength] of Object.entries(MAX_TEXT)) {
    if (typeof value[field] === "string" && value[field].length > maxLength) {
      errors.push(issue(field, "TOO_LONG", `${field} must be ${maxLength} characters or fewer.`));
    }
  }
  for (const field of ["musicBrainzReleaseId", "musicBrainzReleaseGroupId"]) {
    if (value[field] && !UUID_PATTERN.test(value[field])) {
      errors.push(issue(field, "INVALID_MBID", `${field} must be a MusicBrainz UUID.`));
    }
  }

  if (normalizeWhitespace(input.genre) && !value.genre) {
    errors.push(issue("genre", "UNSUPPORTED_GENRE", "genre must use a supported catalog value."));
  }

  const retrievedAt = now();
  const artwork = validateArtwork(input.artwork || (
    input.artworkThumbnailUrl || input.artworkDetailUrl || input.artworkSourceUrl
      ? {
          thumbnailUrl: input.artworkThumbnailUrl,
          detailUrl: input.artworkDetailUrl,
          sourceUrl: input.artworkSourceUrl,
          source: input.artworkSource || "cover-art-archive",
          retrievedAt: input.artworkRetrievedAt,
        }
      : null
  ), {
    releaseId: value.musicBrainzReleaseId,
    releaseGroupId: value.musicBrainzReleaseGroupId,
    retrievedAt,
  });
  value.artwork = artwork.value;
  errors.push(...artwork.errors);
  if (artwork.value.source) {
    value.provenance.push({
      field: "artwork",
      source: "cover-art-archive",
      sourceId: value.musicBrainzReleaseId || value.musicBrainzReleaseGroupId,
      retrievedAt,
    });
  }

  if (input.stock && !value.stock) warnings.push(issue("stock", "UNKNOWN_STOCK", "Stock value was not recognized."));
  if (input.condition && !value.condition) warnings.push(issue("condition", "UNKNOWN_CONDITION", "Condition was not recognized."));
  if (input.format && !value.format) warnings.push(issue("format", "UNKNOWN_FORMAT", "Format was not recognized."));

  return { rowNumber, value, errors, warnings };
}

export function validateImportRows(rows, options) {
  if (!Array.isArray(rows)) {
    return [{
      rowNumber: 0,
      value: null,
      errors: [issue("input", "INVALID_INPUT", "Import input must contain an array of records.")],
      warnings: [],
    }];
  }
  return rows.map((row, index) => normalizeAndValidateImportRow(row, index + 1, options));
}

export const APPROVED_ARTWORK_HOSTS = Object.freeze({
  coverArt: [...COVER_ART_HOSTS],
  musicBrainz: [...MUSICBRAINZ_HOSTS],
});
