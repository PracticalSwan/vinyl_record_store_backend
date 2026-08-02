import { createHash, createHmac } from "node:crypto";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import readline from "node:readline";
import { createGunzip } from "node:zlib";

export const AMAZON_DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v1";
export const AMAZON_SOURCE = "amazon-reviews-2023";
export const AMAZON_SOURCE_VERSION = "2023-cds-vinyl-5core-v1";
const MAX_JSONL_LINE_BYTES = 2_000_000;

const BROAD_GENRES = [
  ["Jazz", /\bjazz\b/i],
  ["Rock", /\b(rock|metal|punk|alternative)\b/i],
  ["Soul", /\b(soul|r&b|funk|motown)\b/i],
  ["Electronic", /\b(electronic|dance|house|techno|ambient)\b/i],
  ["Classical", /\b(classical|opera|orchestral|chamber)\b/i],
  ["Folk", /\b(folk|country|bluegrass|americana)\b/i],
  ["Hip-Hop", /\b(hip[- ]?hop|rap)\b/i],
  ["Blues", /\bblues\b/i],
  ["Reggae", /\breggae\b/i],
  ["Latin", /\b(latin|salsa|bossa|tango)\b/i],
  ["World", /\b(world|international)\b/i],
  ["Soundtrack", /\b(soundtrack|cast recording)\b/i],
];

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
    .update(`groovehaus-dataset-user:v1:${datasetKey}:${sourceUserId}`)
    .digest("hex");
}

export function pseudonymKeyFingerprint(secret) {
  if (!secret || String(secret).length < 32) return null;
  return createHash("sha256")
    .update(`groovehaus-dataset-key-fingerprint:v1:${secret}`)
    .digest("hex")
    .slice(0, 16);
}

export function stableProductPublicId(parentAsin, occupied = new Set()) {
  const digest = createHash("sha256")
    .update(`${AMAZON_DATASET_KEY}:${parentAsin}`)
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
  const store = clean(metadata?.store);
  if (!store) return null;
  const artist = clean(store.split(/\s+Format\s*:/i)[0]);
  if (!artist || /^(various|amazon|unknown|vinyl)$/i.test(artist)) return null;
  return artist;
}

function deriveGenre(metadata) {
  const categories = Array.isArray(metadata?.categories) ? metadata.categories.map(String) : [];
  for (const [genre, pattern] of BROAD_GENRES) {
    if (categories.some((value) => pattern.test(value))) return genre;
  }
  const ignored = /^(cds?\s*&\s*vinyl|vinyl(?: records?)?|music|genres?)$/i;
  return clean([...categories].reverse().find((value) => !ignored.test(value.trim())), 100);
}

function deriveYear(details = {}) {
  const candidates = [
    details["Original Release Date"],
    details["Release Date"],
  ];
  for (const value of candidates) {
    const matches = String(value || "").match(/\b(19\d{2}|20\d{2})\b/g);
    if (matches?.length) {
      const year = Number(matches[0]);
      if (year >= 1900 && year <= 2100) return year;
    }
  }
  return null;
}

export function normalizeAmazonProduct(metadata, publicId) {
  const parentAsin = clean(metadata?.parent_asin, 20);
  const title = clean(metadata?.title);
  if (!parentAsin || !/^[A-Z0-9]{10}$/.test(parentAsin) || !title) return null;
  const classification = classifyVinylMetadata(metadata);
  if (!classification.accepted) return null;
  const details = metadata?.details && typeof metadata.details === "object" ? metadata.details : {};
  const artist = deriveArtist(metadata);
  const genre = deriveGenre(metadata);
  const sourceReferencePriceAvailable = Number.isFinite(metadata?.price) && metadata.price >= 0;
  const year = deriveYear(details);
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
    slug: `${slugBase || "record"}-${publicId}`,
    title,
    artist,
    genre,
    genres: genre ? [genre] : [],
    year,
    price: null,
    currency: null,
    stock: null,
    condition: null,
    label,
    format,
    pressing: null,
    description: null,
    imageUrl: null,
    artwork: {},
    source: AMAZON_SOURCE,
    datasetKey: AMAZON_DATASET_KEY,
    sourceVersion: AMAZON_SOURCE_VERSION,
    externalItemKey: createHash("sha256")
      .update(`${AMAZON_DATASET_KEY}:${parentAsin}`)
      .digest("hex"),
    fieldOrigins: {
      title: "source",
      artist: artist ? "derived" : "unknown",
      genre: genre ? "derived" : "unknown",
      year: year ? "derived" : "unknown",
      price: "unknown",
      currency: "unknown",
      stock: "unknown",
      condition: "unknown",
      format: "derived",
      label: label ? "source" : "unknown",
      artwork: "unknown",
    },
    qualityFlags: [
      `vinyl-confidence:${classification.confidence}`,
      ...(artist ? ["artist-derived-from-store:medium-confidence"] : []),
      ...(genre ? ["genre-derived-from-categories:medium-confidence"] : []),
      ...(year ? ["year-derived-from-release-details:medium-confidence"] : []),
      "format-normalized-to-broad-vinyl",
      ...(!artist ? ["artist-missing"] : []),
      ...(sourceReferencePriceAvailable
        ? ["source-reference-price-excluded-from-store-price"]
        : ["price-missing"]),
    ],
    provenance: [{
      field: "catalog-record",
      source: AMAZON_SOURCE,
      sourceId: parentAsin,
      retrievedAt: null,
    }],
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
