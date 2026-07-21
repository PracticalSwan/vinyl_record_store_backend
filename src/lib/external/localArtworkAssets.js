import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { isCoverArtArchiveHost, isTrustedArtworkRedirectHost } from "./artworkHosts.js";

export const LOCAL_ARTWORK_SCHEMA_VERSION = 1;
export const LOCAL_ARTWORK_MAX_BYTES = 6 * 1024 * 1024;
export const LOCAL_ARTWORK_MAX_PIXELS = 16_000_000;
export const LOCAL_ARTWORK_MAX_REDIRECTS = 5;
export const LOCAL_ARTWORK_TIMEOUT_MS = 30_000;

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf,
]);
const LOCAL_FILENAME_PATTERN = /^([1-9][0-9]*)\.([0-9a-f]{12})\.jpg$/;

export class LocalArtworkAssetError extends Error {
  constructor(message, { code = "LOCAL_ARTWORK_INVALID", cause } = {}) {
    super(message, cause ? { cause } : undefined);
    this.name = "LocalArtworkAssetError";
    this.code = code;
  }
}
function assetError(message, code, cause) {
  return new LocalArtworkAssetError(message, { code, cause });
}

function cleanContentType(value) {
  return String(value || "").split(";")[0].trim().toLowerCase();
}

function canonicalContentLength(value) {
  if (value === null || value === undefined || value === "") return null;
  const normalized = String(value).trim();
  if (!/^[0-9]+$/.test(normalized)) {
    throw assetError("Artwork returned an invalid Content-Length header.", "LOCAL_ARTWORK_LENGTH_INVALID");
  }
  const parsed = Number(normalized);
  if (!Number.isSafeInteger(parsed)) {
    throw assetError("Artwork Content-Length is outside the supported range.", "LOCAL_ARTWORK_LENGTH_INVALID");
  }
  return parsed;
}

function validatedUrl(value, { source = false } = {}) {
  let url;
  try {
    url = new URL(value);
  } catch (error) {
    throw assetError("Artwork URL is malformed.", "LOCAL_ARTWORK_URL_INVALID", error);
  }
  if (url.protocol !== "https:" || url.username || url.password) {
    throw assetError("Artwork URL must be credential-free HTTPS.", "LOCAL_ARTWORK_URL_INVALID");
  }
  const allowed = source
    ? isCoverArtArchiveHost(url.hostname)
    : isTrustedArtworkRedirectHost(url.hostname);
  if (!allowed) {
    throw assetError("Artwork host is not permitted.", "LOCAL_ARTWORK_HOST_NOT_ALLOWED");
  }
  return url;
}

async function readBodyCapped(response, maxBytes) {
  if (response.body && typeof response.body.getReader === "function") {
    const reader = response.body.getReader();
    const chunks = [];
    let total = 0;
    while (true) {
      let part;
      try {
        part = await reader.read();
      } catch (error) {
        throw assetError("Artwork response ended before it could be read.", "LOCAL_ARTWORK_STREAM_FAILED", error);
      }
      if (part.done) break;
      const chunk = Buffer.from(part.value);
      total += chunk.byteLength;
      if (total > maxBytes) {
        try {
          await reader.cancel();
        } catch {
          // The size decision is final; cancel is only resource cleanup.
        }
        throw assetError("Artwork exceeded the local asset size limit.", "LOCAL_ARTWORK_TOO_LARGE");
      }
      chunks.push(chunk);
    }
    return Buffer.concat(chunks, total);
  }

  let body;
  try {
    body = Buffer.from(await response.arrayBuffer());
  } catch (error) {
    throw assetError("Artwork response ended before it could be read.", "LOCAL_ARTWORK_STREAM_FAILED", error);
  }
  if (body.byteLength > maxBytes) {
    throw assetError("Artwork exceeded the local asset size limit.", "LOCAL_ARTWORK_TOO_LARGE");
  }
  return body;
}

export function readJpegDimensions(body) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (bytes.byteLength < 12 || bytes[0] !== 0xff || bytes[1] !== 0xd8) {
    throw assetError("Artwork bytes are not a JPEG image.", "LOCAL_ARTWORK_SIGNATURE_INVALID");
  }
  if (bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
    throw assetError("Artwork JPEG is incomplete.", "LOCAL_ARTWORK_SIGNATURE_INVALID");
  }

  let offset = 2;
  while (offset < bytes.length - 1) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;

    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) {
      throw assetError("Artwork JPEG contains a truncated segment.", "LOCAL_ARTWORK_SIGNATURE_INVALID");
    }

    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) {
      throw assetError("Artwork JPEG contains an invalid segment.", "LOCAL_ARTWORK_SIGNATURE_INVALID");
    }
    if (JPEG_START_OF_FRAME_MARKERS.has(marker)) {
      if (segmentLength < 7) {
        throw assetError("Artwork JPEG dimensions are truncated.", "LOCAL_ARTWORK_DIMENSIONS_INVALID");
      }
      const height = bytes.readUInt16BE(offset + 3);
      const width = bytes.readUInt16BE(offset + 5);
      if (!width || !height || width * height > LOCAL_ARTWORK_MAX_PIXELS) {
        throw assetError("Artwork JPEG dimensions are outside the supported range.", "LOCAL_ARTWORK_DIMENSIONS_INVALID");
      }
      return { width, height };
    }
    offset += segmentLength;
  }

  throw assetError("Artwork JPEG does not contain readable dimensions.", "LOCAL_ARTWORK_DIMENSIONS_INVALID");
}

export function inspectLocalArtworkBytes(body, {
  contentType = "image/jpeg",
  declaredLength = null,
  contentEncoding = null,
  maxBytes = LOCAL_ARTWORK_MAX_BYTES,
} = {}) {
  const bytes = Buffer.isBuffer(body) ? body : Buffer.from(body || []);
  if (!bytes.byteLength) {
    throw assetError("Artwork response was empty.", "LOCAL_ARTWORK_EMPTY");
  }
  if (bytes.byteLength > maxBytes) {
    throw assetError("Artwork exceeded the local asset size limit.", "LOCAL_ARTWORK_TOO_LARGE");
  }
  if (cleanContentType(contentType) !== "image/jpeg") {
    throw assetError("Local artwork must be a JPEG image.", "LOCAL_ARTWORK_TYPE_INVALID");
  }
  const expectedLength = canonicalContentLength(declaredLength);
  if (!contentEncoding && expectedLength !== null && expectedLength !== bytes.byteLength) {
    throw assetError("Artwork byte length did not match Content-Length.", "LOCAL_ARTWORK_LENGTH_MISMATCH");
  }
  const { width, height } = readJpegDimensions(bytes);
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  return {
    contentType: "image/jpeg",
    byteLength: bytes.byteLength,
    width,
    height,
    sha256,
  };
}

export async function downloadLocalArtworkAsset(sourceUrl, {
  fetchImpl = globalThis.fetch,
  maxBytes = LOCAL_ARTWORK_MAX_BYTES,
  maxRedirects = LOCAL_ARTWORK_MAX_REDIRECTS,
  timeoutMs = LOCAL_ARTWORK_TIMEOUT_MS,
  userAgent = process.env.MUSICBRAINZ_USER_AGENT
    || "GroovehausVinyl/0.1 (https://github.com/PracticalSwan/vinyl_record_store_backend)",
  now = () => new Date(),
} = {}) {
  let currentUrl = validatedUrl(sourceUrl, { source: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(new DOMException("Timed out", "TimeoutError")), timeoutMs);
  let redirects = 0;

  try {
    while (true) {
      let response;
      try {
        response = await fetchImpl(currentUrl, {
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "image/jpeg",
            ...(userAgent ? { "User-Agent": userAgent } : {}),
          },
        });
      } catch (error) {
        if (controller.signal.aborted || error?.name === "AbortError" || error?.name === "TimeoutError") {
          throw assetError("Artwork download timed out.", "LOCAL_ARTWORK_TIMEOUT", error);
        }
        throw assetError("Artwork download could not reach the upstream host.", "LOCAL_ARTWORK_UNREACHABLE", error);
      }

      if (REDIRECT_STATUSES.has(response.status)) {
        if (redirects >= maxRedirects) {
          throw assetError("Artwork exceeded the redirect limit.", "LOCAL_ARTWORK_REDIRECT_LIMIT");
        }
        const location = response.headers.get("location");
        if (!location) {
          throw assetError("Artwork redirect did not include a destination.", "LOCAL_ARTWORK_REDIRECT_INVALID");
        }
        currentUrl = validatedUrl(new URL(location, currentUrl).toString());
        redirects += 1;
        continue;
      }

      if (!response.ok) {
        throw assetError(`Artwork upstream returned HTTP ${response.status}.`, "LOCAL_ARTWORK_UPSTREAM_ERROR");
      }

      const contentType = response.headers.get("content-type");
      const declaredLength = response.headers.get("content-length");
      const declaredBytes = canonicalContentLength(declaredLength);
      if (declaredBytes !== null && declaredBytes > maxBytes) {
        throw assetError("Artwork exceeded the local asset size limit.", "LOCAL_ARTWORK_TOO_LARGE");
      }

      const body = await readBodyCapped(response, maxBytes);
      const inspected = inspectLocalArtworkBytes(body, {
        contentType,
        declaredLength,
        contentEncoding: response.headers.get("content-encoding"),
        maxBytes,
      });
      return {
        ...inspected,
        body,
        sourceUrl: validatedUrl(sourceUrl, { source: true }).toString(),
        finalUrl: currentUrl.toString(),
        retrievedAt: now().toISOString(),
        redirects,
      };
    }
  } finally {
    clearTimeout(timeout);
  }
}

export function localArtworkFilename(publicId, sha256) {
  const id = String(publicId);
  if (!/^[1-9][0-9]*$/.test(id) || !/^[0-9a-f]{64}$/.test(String(sha256))) {
    throw assetError("Local artwork filename inputs are invalid.", "LOCAL_ARTWORK_FILENAME_INVALID");
  }
  return `${id}.${sha256.slice(0, 12)}.jpg`;
}

export function sourceArtworkManifestSha256(reviewedEntries) {
  const normalized = [...reviewedEntries]
    .sort((left, right) => left.publicId - right.publicId)
    .map((entry) => ({
      publicId: entry.publicId,
      musicBrainzReleaseId: entry.musicBrainzReleaseId,
      musicBrainzReleaseGroupId: entry.musicBrainzReleaseGroupId,
      thumbnailUrl: entry.artwork.thumbnailUrl,
      sourceUrl: entry.artwork.sourceUrl,
    }));
  return createHash("sha256").update(JSON.stringify(normalized)).digest("hex");
}

export function renderLocalArtworkManifest(entries, {
  sourceReviewedAt,
  sourceManifestSha256,
} = {}) {
  const ordered = [...entries].sort((left, right) => left.publicId - right.publicId);
  return `// Generated by scripts/download-local-artwork.mjs. Do not edit by hand.\n`
    + `export const LOCAL_ARTWORK_SCHEMA_VERSION = ${LOCAL_ARTWORK_SCHEMA_VERSION};\n`
    + `export const LOCAL_ARTWORK_SOURCE_REVIEWED_AT = ${JSON.stringify(sourceReviewedAt)};\n`
    + `export const LOCAL_ARTWORK_SOURCE_MANIFEST_SHA256 = ${JSON.stringify(sourceManifestSha256)};\n\n`
    + `export const localArtworkManifest = Object.freeze(${JSON.stringify(ordered, null, 2)}.map((entry) => Object.freeze(entry)));\n`;
}

function exactStringSet(values, label) {
  const list = [...values].map(String);
  const set = new Set(list);
  if (set.size !== list.length) {
    throw assetError(`${label} contains duplicate public IDs.`, "LOCAL_ARTWORK_COVERAGE_INVALID");
  }
  return set;
}

function assertSameSet(left, right, message) {
  if (left.size !== right.size || [...left].some((value) => !right.has(value))) {
    throw assetError(message, "LOCAL_ARTWORK_COVERAGE_INVALID");
  }
}

export async function verifyLocalArtworkSet({
  catalogIds,
  reviewedEntries,
  localEntries,
  assetDirectory,
  strictOrphans = true,
  readFileImpl = readFile,
  readdirImpl = readdir,
}) {
  const catalogIdSet = exactStringSet(catalogIds, "Catalog");
  const reviewedIdSet = exactStringSet(reviewedEntries.map((entry) => entry.publicId), "Reviewed artwork manifest");
  const localIdSet = exactStringSet(localEntries.map((entry) => entry.publicId), "Local artwork manifest");
  assertSameSet(catalogIdSet, reviewedIdSet, "Catalog and reviewed artwork IDs do not match.");
  assertSameSet(catalogIdSet, localIdSet, "Catalog and local artwork IDs do not match.");

  const reviewedById = new Map(reviewedEntries.map((entry) => [String(entry.publicId), entry]));
  const filenames = new Set();
  let totalBytes = 0;

  for (const entry of localEntries) {
    const id = String(entry.publicId);
    const reviewed = reviewedById.get(id);
    const filenameMatch = LOCAL_FILENAME_PATTERN.exec(entry.filename);
    if (!filenameMatch || filenameMatch[1] !== id || filenameMatch[2] !== entry.sha256.slice(0, 12)) {
      throw assetError(`Local artwork filename is invalid for publicId ${id}.`, "LOCAL_ARTWORK_FILENAME_INVALID");
    }
    if (filenames.has(entry.filename)) {
      throw assetError(`Local artwork filename is duplicated: ${entry.filename}.`, "LOCAL_ARTWORK_FILENAME_INVALID");
    }
    filenames.add(entry.filename);
    if (
      entry.sourceUrl !== reviewed.artwork.thumbnailUrl
      || entry.musicBrainzReleaseId !== reviewed.musicBrainzReleaseId
      || entry.musicBrainzReleaseGroupId !== reviewed.musicBrainzReleaseGroupId
      || entry.sourcePageUrl !== reviewed.artwork.sourceUrl
    ) {
      throw assetError(`Local artwork provenance is stale for publicId ${id}.`, "LOCAL_ARTWORK_PROVENANCE_INVALID");
    }

    const body = await readFileImpl(path.join(assetDirectory, entry.filename));
    const inspected = inspectLocalArtworkBytes(body, { contentType: entry.contentType });
    for (const field of ["contentType", "byteLength", "width", "height", "sha256"]) {
      if (entry[field] !== inspected[field]) {
        throw assetError(`Local artwork ${field} is invalid for publicId ${id}.`, "LOCAL_ARTWORK_FILE_INVALID");
      }
    }
    totalBytes += inspected.byteLength;
  }

  if (strictOrphans) {
    const actualFiles = (await readdirImpl(assetDirectory, { withFileTypes: true }))
      .filter((item) => item.isFile() && item.name.toLowerCase().endsWith(".jpg"))
      .map((item) => item.name);
    const actualSet = new Set(actualFiles);
    if (actualSet.size !== actualFiles.length) {
      throw assetError("Local artwork directory contains duplicate filenames.", "LOCAL_ARTWORK_FILE_INVALID");
    }
    assertSameSet(filenames, actualSet, "Local artwork directory contains missing or orphan JPEG files.");
  }

  return { count: localEntries.length, totalBytes };
}
