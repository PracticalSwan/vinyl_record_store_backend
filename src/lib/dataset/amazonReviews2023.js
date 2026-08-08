import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import readline from "node:readline";
import { createGunzip } from "node:zlib";
import {
  AMAZON_CURRENT_DATASET_KEY,
  getCurrentAmazonDatasetRelease,
} from "./amazonDatasetReleases.js";

export const AMAZON_DATASET_KEY = AMAZON_CURRENT_DATASET_KEY;
export const AMAZON_SOURCE = "amazon-reviews-2023";
export const AMAZON_SOURCE_VERSION = getCurrentAmazonDatasetRelease().sourceVersion;
export const AMAZON_PRODUCT_COLLECTION = "datasetProducts";
export const AMAZON_IDENTITY_NAMESPACE = "amazon-reviews-2023:CDs_and_Vinyl:vinyl";
const MAX_JSONL_LINE_BYTES = 2_000_000;

export const AMAZON_CANONICAL_GENRES = Object.freeze([
  "Blues",
  "Classical",
  "Electronic",
  "Folk",
  "Hip-Hop",
  "Holiday",
  "Jazz",
  "Latin",
  "Pop",
  "Reggae",
  "Rock",
  "Soul",
  "Soundtrack",
  "Spoken Word",
  "World",
]);

const GENRE_RULES = [
  ["Jazz", /\b(jazz|bebop|swing|big band|cool jazz|fusion)\b/i],
  ["Rock", /\b(rock|metal|punk|grunge|alternative|indie|emo|hardcore|psychedelic|new wave)\b/i],
  ["Soul", /\b(soul|r&b|rhythm and blues|funk|motown|neo-soul|gospel)\b/i],
  ["Electronic", /\b(electronic|dance|house|techno|ambient|trance|electronica|drum and bass|dubstep)\b/i],
  ["Classical", /\b(classical|opera|orchestral|chamber|symphon|concerto|baroque|romantic period)\b/i],
  ["Folk", /\b(folk|country|bluegrass|americana|singer-songwriter|traditional country)\b/i],
  ["Hip-Hop", /\b(hip[- ]?hop|rap)\b/i],
  ["Blues", /\bblues\b/i],
  ["Reggae", /\b(reggae|ska|dancehall)\b/i],
  ["Latin", /\b(latin|salsa|bossa|tango|mariachi|latin jazz)\b/i],
  ["World", /\b(world music|african music|celtic|flamenco|indian classical)\b/i],
  ["Soundtrack", /\b(soundtracks?|movie scores?|film scores?|cast recordings?|musicals?|broadway|television music)\b/i],
  ["Holiday", /\b(christmas|holiday|hanukkah|wedding music)\b/i],
  ["Spoken Word", /\b(spoken word|comedy|poetry|audiobook)\b/i],
  ["Pop", /\b(pop|adult contemporary|easy listening|oldies|vocal)\b/i],
];

const GENERIC_CATEGORIES = /^(?:cds?\s*&\s*vinyl|vinyl(?: records?)?|music|genres?|digital music|autorip|vinyl store|today'?s deals(?: deprecated)?)$/i;

const clean = (value, max = 200) => {
  const result = typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
  return result ? result.slice(0, max) : null;
};

export async function sha256File(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

export async function verifySourceFile(path, expected) {
  const details = await stat(path);
  if (details.size !== expected.bytes) {
    throw new Error(`${path} has ${details.size} bytes; expected ${expected.bytes}.`);
  }
  const digest = await sha256File(path);
  if (digest !== expected.sha256) {
    throw new Error(`${path} failed SHA-256 validation.`);
  }
  return { path, bytes: details.size, sha256: digest };
}

export function createDatasetUserKey(sourceUserId, secret, datasetKey = AMAZON_DATASET_KEY) {
  if (!secret || String(secret).length < 32) {
    throw new Error("DATASET_PSEUDONYM_KEY or AUTH_SECRET must contain at least 32 characters.");
  }
  return createHmac("sha256", secret)
    .update(`groovehaus-dataset-user:v2:${AMAZON_IDENTITY_NAMESPACE}:${datasetKey}:${sourceUserId}`)
    .digest("hex");
}

export function pseudonymKeyFingerprint(secret) {
  if (!secret || String(secret).length < 32) return null;
  return createHash("sha256")
    .update(`groovehaus-dataset-key-fingerprint:v1:${secret}`)
    .digest("hex")
    .slice(0, 16);
}

export function canonicalSourceIdentityKey(parentAsin) {
  const value = clean(parentAsin, 20);
  if (!value || !/^[A-Z0-9]{10}$/.test(value)) return null;
  return createHash("sha256")
    .update(`${AMAZON_IDENTITY_NAMESPACE}:${value}`)
    .digest("hex");
}

export function stableProductPublicId(sourceIdentity, occupied = new Set()) {
  const digest = createHash("sha256")
    .update(`groovehaus-public-product:v2:${AMAZON_IDENTITY_NAMESPACE}:${sourceIdentity}`)
    .digest();
  let candidate = 100_000 + (digest.readUInt32BE(0) % 800_000);
  while (occupied.has(candidate)) {
    candidate += 1;
    if (candidate > 899_999) candidate = 100_000;
  }
  occupied.add(candidate);
  return candidate;
}

export function parseRatingCsvLine(line) {
  const [userId, parentAsin, ratingText, timestampText, extra] = line.split(",");
  if (extra !== undefined || !userId || !/^[A-Z0-9]{10}$/.test(parentAsin || "")) {
    throw new Error("Invalid rating-only CSV row.");
  }
  const rating = Number(ratingText);
  const timestamp = Number(timestampText);
  if (
    !Number.isFinite(rating)
    || rating < 1
    || rating > 5
    || !Number.isInteger(timestamp)
    || timestamp < 0
    || timestamp > Date.now() + 86_400_000
  ) {
    throw new Error("Invalid rating or timestamp in rating-only CSV row.");
  }
  return { userId, parentAsin, rating, timestamp };
}

export async function* readRatingRows(path) {
  const input = createReadStream(path).pipe(createGunzip());
  const lines = readline.createInterface({ input, crlfDelay: Infinity });
  let header = true;
  for await (const line of lines) {
    if (header) {
      header = false;
      if (line !== "user_id,parent_asin,rating,timestamp") {
        throw new Error("Unexpected rating-only CSV header.");
      }
      continue;
    }
    if (line) yield parseRatingCsvLine(line);
  }
}

export async function* readMetadataRows(path) {
  const lines = readline.createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line) continue;
    if (Buffer.byteLength(line, "utf8") > MAX_JSONL_LINE_BYTES) {
      throw new Error(`Metadata JSON at line ${lineNumber} exceeds the line-size limit.`);
    }
    try {
      yield JSON.parse(line);
    } catch {
      throw new Error(`Invalid metadata JSON at line ${lineNumber}.`);
    }
  }
}

export async function* readJsonlRows(path, label = "JSONL") {
  const lines = readline.createInterface({
    input: createReadStream(path),
    crlfDelay: Infinity,
  });
  let lineNumber = 0;
  for await (const line of lines) {
    lineNumber += 1;
    if (!line) continue;
    if (Buffer.byteLength(line, "utf8") > MAX_JSONL_LINE_BYTES) {
      throw new Error(`${label} JSON at line ${lineNumber} exceeds the line-size limit.`);
    }
    try {
      yield JSON.parse(line);
    } catch {
      throw new Error(`Invalid ${label} JSON at line ${lineNumber}.`);
    }
  }
}

function metadataFormatText(metadata) {
  const details = metadata?.details && typeof metadata.details === "object"
    ? Object.entries(metadata.details).map(([key, value]) => `${key}: ${value}`).join(" ")
    : "";
  return `${metadata?.store || ""} ${details}`;
}

export function classifyVinylMetadata(metadata) {
  const categories = Array.isArray(metadata?.categories) ? metadata.categories : [];
  const formatText = metadataFormatText(metadata);
  const exactCategory = categories.some((value) => /^vinyl(?: records?)?$/i.test(String(value).trim()));
  const explicitFormat = /\bformat\s*:\s*(?:audio\s+)?vinyl\b/i.test(formatText)
    || /\bvinyl record\b/i.test(formatText);
  const excluded = /\bformat\s*:\s*(?:audio\s+)?(?:cd|cassette|mp3|blu[- ]?ray|dvd)\b/i.test(formatText)
    && !explicitFormat;
  return {
    accepted: (exactCategory || explicitFormat) && !excluded,
    confidence: explicitFormat ? "high" : exactCategory ? "medium" : "none",
    signals: [
      ...(exactCategory ? ["vinyl-category"] : []),
      ...(explicitFormat ? ["explicit-vinyl-format"] : []),
      ...(excluded ? ["conflicting-non-vinyl-format"] : []),
    ],
  };
}

function deriveArtist(metadata) {
  const raw = clean(metadata?.store);
  if (!raw) return { value: null, confidence: "none", flags: ["artist-missing"], raw: null };
  if (/\bvarious(?:\s+artists?)?\b/i.test(raw)) {
    return {
      value: "Various Artists",
      confidence: "high",
      flags: ["artist-normalized-various-artists"],
      raw,
    };
  }
  const roleMarkers = raw.match(/\((?:artist|composer|performer|conductor|orchestra|ensemble)\)/gi) || [];
  const moreMarker = /(?:&|and)\s*\d+\s+more\b/i.test(raw);
  let artist = raw
    .split(/\s+Format\s*:/i)[0]
    .replace(/\((?:artist|composer|performer|conductor|orchestra|ensemble)\)/gi, "")
    .replace(/(?:&|and)\s*\d+\s+more\b/gi, "")
    .replace(/\s*,\s*/g, ", ")
    .replace(/\s+/g, " ")
    .replace(/[\s,;:&-]+$/g, "")
    .trim();
  if (
    !artist
    || /^(?:format|amazon|unknown|vinyl|music|record(?:s| store)?|audio)$/i.test(artist)
    || /^format\s*:/i.test(artist)
  ) {
    return { value: null, confidence: "none", flags: ["artist-rejected-generic-store-value"], raw };
  }
  if (roleMarkers.length >= 3 || moreMarker || artist.length > 120) {
    return {
      value: null,
      confidence: "low",
      flags: ["artist-rejected-ambiguous-multi-credit"],
      raw,
    };
  }
  artist = clean(artist);
  return {
    value: artist,
    confidence: roleMarkers.length ? "medium" : "high",
    flags: [roleMarkers.length ? "artist-role-markers-removed" : "artist-store-value-cleaned"],
    raw,
  };
}

function deriveGenre(metadata) {
  const categories = Array.isArray(metadata?.categories)
    ? metadata.categories.map((value) => clean(String(value), 100)).filter(Boolean)
    : [];
  const matched = [];
  for (const category of categories) {
    if (GENERIC_CATEGORIES.test(category)) continue;
    for (const [genre, pattern] of GENRE_RULES) {
      if (pattern.test(category) && !matched.includes(genre)) matched.push(genre);
    }
  }
  const unmatched = categories.filter((category) => (
    !GENERIC_CATEGORIES.test(category)
    && !GENRE_RULES.some(([, pattern]) => pattern.test(category))
  ));
  return {
    value: matched[0] || null,
    genres: matched,
    confidence: matched.length ? "high" : "none",
    categories,
    unmatched,
  };
}

function parseYear(value) {
    const matches = String(value || "").match(/\b(19\d{2}|20\d{2})\b/g);
    if (matches?.length) {
      const year = Number(matches[0]);
      if (year >= 1900 && year <= 2100) return year;
    }
  return null;
}

function deriveYears(details = {}) {
  const releaseDate = clean(details["Release Date"], 100);
  const amazonOriginalReleaseDate = clean(details["Original Release Date"], 100);
  const editionReleaseYear = parseYear(releaseDate) ?? parseYear(amazonOriginalReleaseDate);
  return {
    originalReleaseYear: null,
    editionReleaseYear,
    sourceField: releaseDate ? "Release Date" : amazonOriginalReleaseDate ? "Original Release Date" : null,
    raw: {
      releaseDate,
      originalReleaseDate: amazonOriginalReleaseDate,
      dateFirstAvailable: clean(details["Date First Available"], 100),
    },
  };
}

export function normalizeAmazonProduct(metadata, publicId, {
  stableSlug = null,
  artworkMatch = null,
} = {}) {
  const parentAsin = clean(metadata?.parent_asin, 20);
  const title = clean(metadata?.title);
  if (!parentAsin || !/^[A-Z0-9]{10}$/.test(parentAsin) || !title) return null;
  const classification = classifyVinylMetadata(metadata);
  if (!classification.accepted) return null;
  const details = metadata?.details && typeof metadata.details === "object" ? metadata.details : {};
  const artistResult = deriveArtist(metadata);
  const genreResult = deriveGenre(metadata);
  const artist = artworkMatch?.artist || artistResult.value;
  const genre = genreResult.value;
  const sourceReferencePriceAvailable = Number.isFinite(metadata?.price) && metadata.price >= 0;
  const years = deriveYears(details);
  const originalReleaseYear = artworkMatch?.originalReleaseYear ?? years.originalReleaseYear;
  const editionReleaseYear = artworkMatch?.editionReleaseYear ?? years.editionReleaseYear;
  // The generic year field is intentionally original-release-only because it
  // powers decade filtering and the existing content-based era feature.
  // Amazon edition/reissue evidence remains separately displayable.
  const year = originalReleaseYear ?? null;
  // Eligibility proves only the broad carrier. It does not prove LP, EP,
  // single, diameter, or box-set semantics, and Amazon price is not a current
  // Groovehaus selling price.
  const format = "Vinyl";
  const label = clean(details.Label || details.Manufacturer);
  const slugBase = `${artist || "unknown-artist"}-${title}`
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 260)
    .replace(/-+$/g, "");
  return {
    publicId,
    slug: stableSlug || `${slugBase || "record"}-${publicId}`,
    title,
    artist,
    genre,
    genres: genreResult.genres,
    year,
    originalReleaseYear,
    editionReleaseYear,
    yearDisplayType: originalReleaseYear ? "original" : editionReleaseYear ? "edition" : "unknown",
    price: null,
    currency: null,
    stock: null,
    condition: null,
    label,
    format,
    pressing: null,
    description: null,
    imageUrl: null,
    musicBrainzReleaseId: artworkMatch?.musicBrainzReleaseId || null,
    musicBrainzReleaseGroupId: artworkMatch?.musicBrainzReleaseGroupId || null,
    artwork: artworkMatch?.artwork ? { ...artworkMatch.artwork } : {},
    source: AMAZON_SOURCE,
    datasetKey: AMAZON_DATASET_KEY,
    sourceVersion: AMAZON_SOURCE_VERSION,
    externalItemKey: canonicalSourceIdentityKey(parentAsin),
    fieldOrigins: {
      title: "source",
      artist: artworkMatch?.artist ? "enriched" : artist ? "derived" : "unknown",
      genre: genre ? "derived" : "unknown",
      year: originalReleaseYear ? "enriched" : "unknown",
      originalReleaseYear: artworkMatch?.originalReleaseYear ? "enriched" : "unknown",
      editionReleaseYear: editionReleaseYear ? (artworkMatch?.editionReleaseYear ? "enriched" : "derived") : "unknown",
      price: "unknown",
      currency: "unknown",
      stock: "unknown",
      condition: "unknown",
      format: "derived",
      label: label ? "source" : "unknown",
      artwork: artworkMatch?.artwork ? "enriched" : "unknown",
    },
    qualityFlags: [
      `vinyl-confidence:${classification.confidence}`,
      ...artistResult.flags,
      `artist-confidence:${artworkMatch?.artist ? "high" : artistResult.confidence}`,
      ...(genre ? [`genre-canonical-taxonomy:${genreResult.confidence}-confidence`] : ["genre-unresolved"]),
      ...(genreResult.unmatched.length ? ["source-categories-partially-unmapped"] : []),
      ...(editionReleaseYear ? [`edition-year-derived-from-amazon-${years.sourceField === "Release Date" ? "release-date" : "original-release-date"}`] : ["release-year-unresolved"]),
      ...(originalReleaseYear ? ["original-year-enriched-from-musicbrainz"] : []),
      ...(artworkMatch?.artwork ? ["artwork-high-confidence-musicbrainz-match"] : ["artwork-unresolved-or-ambiguous"]),
      "format-normalized-to-broad-vinyl",
      ...(!artist ? ["artist-unresolved"] : []),
      ...(sourceReferencePriceAvailable
        ? ["source-reference-price-excluded-from-store-price"]
        : ["price-missing"]),
    ],
    provenance: [{
      field: "catalog-record",
      source: AMAZON_SOURCE,
      sourceId: parentAsin,
      retrievedAt: null,
    }, ...(artworkMatch?.provenance || [])],
    sourceMetadata: {
      artistRaw: artistResult.raw,
      categoriesRaw: genreResult.categories,
      unmatchedCategories: genreResult.unmatched,
      releaseDatesRaw: years.raw,
      artistConfidence: artworkMatch?.artist ? "high" : artistResult.confidence,
      genreConfidence: genreResult.confidence,
      artworkMatchStatus: artworkMatch?.status || "unresolved",
    },
    deletedAt: null,
  };
}

export function splitUserRatings(rows) {
  const ordered = [...rows].sort((a, b) => a.timestamp - b.timestamp || a.productPublicId - b.productPublicId);
  return ordered.map((row, index) => ({
    ...row,
    split: index === ordered.length - 1 ? "test" : index === ordered.length - 2 ? "validation" : "train",
  }));
}

export function trainCore(rows, minimum = 5) {
  let current = rows;
  for (;;) {
    const users = new Map();
    const products = new Map();
    for (const row of current) {
      if (row.split !== "train") continue;
      users.set(row.userKey, (users.get(row.userKey) || 0) + 1);
      products.set(row.productPublicId, (products.get(row.productPublicId) || 0) + 1);
    }
    const next = current.filter((row) => (
      (users.get(row.userKey) || 0) >= minimum
      && (products.get(row.productPublicId) || 0) >= minimum
    ));
    if (next.length === current.length) return next;
    current = next;
  }
}
