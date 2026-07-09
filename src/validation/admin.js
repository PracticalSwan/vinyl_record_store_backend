import { invalid } from "../lib/errors.js";
import { assertOnlyKeys } from "../lib/request.js";
import {
  normalizeCondition,
  normalizeFormat,
  normalizeGenre,
  normalizeStock,
  normalizeUuid,
  normalizeWhitespace,
} from "../lib/catalog/normalize.js";
import { boundedLiteral } from "./catalog.js";

const SOURCE_PATTERN = /^[a-z0-9][a-z0-9._-]*$/i;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DEFAULT_ADMIN_SOURCE = "admin-manual";
const MAX_IMPORT_BYTES = 2_000_000;

const MUTABLE_FIELDS = [
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
  "source",
];

const CREATE_KEYS = [...MUTABLE_FIELDS];
const UPDATE_KEYS = [...MUTABLE_FIELDS, "updatedAt"];

function currentYear() {
  return new Date().getUTCFullYear();
}

function parseYear(value) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isInteger(parsed)) throw invalid("year must be a whole number.");
  if (parsed < 1900 || parsed > currentYear() + 1) {
    throw invalid(`year must be from 1900 through ${currentYear() + 1}.`);
  }
  return parsed;
}

function parsePrice(value) {
  if (value === null || value === undefined || value === "") {
    throw invalid("price is required.");
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 1_000_000) {
    throw invalid("price must be a number from 0 through 1000000.");
  }
  return parsed;
}

function parseCurrency(value) {
  const normalized = normalizeWhitespace(value || "USD").toUpperCase();
  if (normalized !== "USD") throw invalid("Only USD is supported.");
  return "USD";
}

function parseSource(value) {
  const normalized = normalizeWhitespace(value) || DEFAULT_ADMIN_SOURCE;
  if (!SOURCE_PATTERN.test(normalized)) {
    throw invalid("source must use letters, numbers, dots, underscores, or hyphens.");
  }
  return normalized;
}

function parseMusicBrainzId(value, field) {
  const normalized = normalizeUuid(value);
  if (value !== null && value !== undefined && value !== "" && !normalized) {
    throw invalid(`${field} must be a MusicBrainz UUID.`);
  }
  if (normalized && !UUID_PATTERN.test(normalized)) {
    throw invalid(`${field} must be a MusicBrainz UUID.`);
  }
  return normalized || null;
}

function parseImageUrl(value) {
  if (value === null || value === undefined || value === "") return null;
  return boundedLiteral(value, { name: "imageUrl", maxLength: 2_000 });
}

// Validate the shared mutable fields and return a patch object containing only
// the fields that should be written. `required` controls whether create-only
// required fields (title, artist, price, stock, condition, format) must be set.
function buildFieldPatch(body, { required }) {
  const patch = {};

  const title = boundedLiteral(body.title, { name: "title", maxLength: 200 });
  if (required && !title) throw invalid("title is required.");
  if (title) patch.title = title;

  const artist = boundedLiteral(body.artist, { name: "artist", maxLength: 200 });
  if (required && !artist) throw invalid("artist is required.");
  if (artist) patch.artist = artist;

  if (body.genre !== undefined) {
    const genre = normalizeGenre(body.genre);
    if (body.genre && !genre) throw invalid("genre must use a supported catalog value.");
    patch.genre = genre;
  }

  if (body.year !== undefined) patch.year = parseYear(body.year);
  if (body.price !== undefined) patch.price = parsePrice(body.price);
  if (body.currency !== undefined) patch.currency = parseCurrency(body.currency);

  if (body.stock !== undefined) {
    const stock = normalizeStock(body.stock);
    if (!stock) throw invalid("stock must be one of: in, low, out.");
    patch.stock = stock;
  }
  if (required && !patch.stock) throw invalid("stock is required.");

  if (body.condition !== undefined) {
    const condition = normalizeCondition(body.condition);
    if (!condition) throw invalid("condition must use a supported catalog value.");
    patch.condition = condition;
  }
  if (required && !patch.condition) throw invalid("condition is required.");

  if (body.label !== undefined) {
    const label = boundedLiteral(body.label, { name: "label", maxLength: 200 });
    patch.label = label || null;
  }

  if (body.format !== undefined) {
    const format = normalizeFormat(body.format);
    if (!format) throw invalid("format must use a supported catalog format value.");
    patch.format = format;
  }
  if (required && !patch.format) throw invalid("format is required.");

  if (body.pressing !== undefined) {
    const pressing = boundedLiteral(body.pressing, { name: "pressing", maxLength: 200 });
    patch.pressing = pressing || null;
  }
  if (body.description !== undefined) {
    const description = boundedLiteral(body.description, { name: "description", maxLength: 5_000 });
    patch.description = description || null;
  }
  if (body.imageUrl !== undefined) patch.imageUrl = parseImageUrl(body.imageUrl);
  if (body.musicBrainzReleaseId !== undefined) {
    patch.musicBrainzReleaseId = parseMusicBrainzId(body.musicBrainzReleaseId, "musicBrainzReleaseId");
  }
  if (body.musicBrainzReleaseGroupId !== undefined) {
    patch.musicBrainzReleaseGroupId = parseMusicBrainzId(body.musicBrainzReleaseGroupId, "musicBrainzReleaseGroupId");
  }
  if (body.source !== undefined) patch.source = parseSource(body.source);

  return patch;
}

export function parseAdminProductCreate(body) {
  assertOnlyKeys(body, CREATE_KEYS, "Create product request");
  const patch = buildFieldPatch(body, { required: true });
  // source and currency defaults are applied if the admin omitted them.
  if (patch.source === undefined) patch.source = DEFAULT_ADMIN_SOURCE;
  if (patch.currency === undefined) patch.currency = "USD";
  return patch;
}

export function parseAdminProductUpdate(body) {
  assertOnlyKeys(body, UPDATE_KEYS, "Update product request");
  const updatedAt = normalizeWhitespace(body.updatedAt);
  if (!updatedAt) {
    throw invalid("updatedAt is required for optimistic concurrency control.");
  }
  const patch = buildFieldPatch(body, { required: false });
  if (Object.keys(patch).length === 0) {
    throw invalid("At least one product field must be provided.");
  }
  return { updatedAt, patch };
}

export function parseImportPreviewInput(body) {
  assertOnlyKeys(body, ["content", "fileName", "enrich", "allowPartial"], "Import preview request");
  if (typeof body.content !== "string" || body.content.length === 0) {
    throw invalid("content must be a non-empty string of CSV or JSON.");
  }
  if (Buffer.byteLength(body.content, "utf8") > MAX_IMPORT_BYTES) {
    throw invalid(`Import content must be ${MAX_IMPORT_BYTES} bytes or fewer.`);
  }
  const fileName = boundedLiteral(body.fileName, { name: "fileName", maxLength: 300 });
  if (!fileName) throw invalid("fileName is required.");
  const lower = fileName.toLowerCase();
  if (!lower.endsWith(".csv") && !lower.endsWith(".json")) {
    throw invalid("Import input must be a .csv or .json file.");
  }
  const enrich = body.enrich === true;
  const allowPartial = body.allowPartial === true;
  return { content: body.content, fileName, enrich, allowPartial };
}

export function parseImportApplyInput(body) {
  assertOnlyKeys(body, ["token", "allowPartial"], "Import apply request");
  const token = normalizeWhitespace(body.token);
  if (!token) throw invalid("token is required.");
  return { token, allowPartial: body.allowPartial === true };
}

export function parseArtworkApplyInput(body) {
  assertOnlyKeys(body, ["releaseId", "updatedAt"], "Artwork apply request");
  const releaseId = normalizeUuid(body.releaseId);
  if (!releaseId || !UUID_PATTERN.test(releaseId)) {
    throw invalid("releaseId must be a MusicBrainz UUID.");
  }
  const updatedAt = normalizeWhitespace(body.updatedAt);
  if (!updatedAt) {
    throw invalid("updatedAt is required for optimistic concurrency control.");
  }
  return { releaseId, updatedAt };
}
