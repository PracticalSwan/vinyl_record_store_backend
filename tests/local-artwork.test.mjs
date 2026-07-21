import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artworkManifest, ARTWORK_REVIEWED_AT } from "../src/data/artworkManifest.js";
import {
  LOCAL_ARTWORK_SCHEMA_VERSION,
  LOCAL_ARTWORK_SOURCE_MANIFEST_SHA256,
  LOCAL_ARTWORK_SOURCE_REVIEWED_AT,
  localArtworkManifest,
} from "../src/data/localArtworkManifest.js";
import { records } from "../src/data/records.js";
import {
  LocalArtworkAssetError,
  downloadLocalArtworkAsset,
  inspectLocalArtworkBytes,
  localArtworkFilename,
  sourceArtworkManifestSha256,
  verifyLocalArtworkSet,
} from "../src/lib/external/localArtworkAssets.js";
import { createLocalArtworkRedirect } from "../src/services/localArtwork.js";

const TEST_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIRECTORY = path.join(TEST_ROOT, "public", "artwork");
const SOURCE_URL = "https://coverartarchive.org/release/example/cover-500.jpg";
const VALID_JPEG = Buffer.from([
  0xff, 0xd8,
  0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x01, 0x00, 0x01, 0x01, 0x01, 0x11, 0x00,
  0xff, 0xd9,
]);

function response({ status = 200, location, contentType = "image/jpeg", body = VALID_JPEG } = {}) {
  const headers = new Map([
    ["content-type", contentType],
    ["content-length", String(body.byteLength)],
  ]);
  if (location) headers.set("location", location);
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    body: null,
    arrayBuffer: async () => body,
  };
}

test("the committed local artwork set exactly covers and validates all 116 records", async () => {
  assert.equal(LOCAL_ARTWORK_SCHEMA_VERSION, 1);
  assert.equal(LOCAL_ARTWORK_SOURCE_REVIEWED_AT, ARTWORK_REVIEWED_AT);
  assert.equal(LOCAL_ARTWORK_SOURCE_MANIFEST_SHA256, sourceArtworkManifestSha256(artworkManifest));

  const result = await verifyLocalArtworkSet({
    catalogIds: records.map((record) => record.id),
    reviewedEntries: artworkManifest,
    localEntries: localArtworkManifest,
    assetDirectory: ASSET_DIRECTORY,
    strictOrphans: true,
  });
  assert.equal(result.count, 116);
  assert.ok(result.totalBytes > 0);
  assert.ok(result.totalBytes < 15 * 1024 * 1024);
  assert.equal(new Set(localArtworkManifest.map((entry) => entry.filename)).size, 116);
  assert.ok(localArtworkManifest.every((entry) => entry.width > 0 && entry.height > 0));
  assert.ok(localArtworkManifest.every((entry) => entry.width <= 500 && entry.height <= 500));
});
test("local artwork redirects accept only canonical IDs and never expose paths", () => {
  for (const entry of localArtworkManifest) {
    const result = createLocalArtworkRedirect(String(entry.publicId));
    assert.equal(result.ok, true);
    assert.equal(result.status, 307);
    assert.equal(result.location, `/artwork/${entry.filename}`);
    assert.match(result.headers["Cache-Control"], /must-revalidate/);
  }

  for (const invalid of [undefined, null, "", "0", "-1", "+1", "1.0", "1e2", " 1", "1 ", "1/../2", "1%2f2", "99999999999"]) {
    const result = createLocalArtworkRedirect(invalid);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.code, "ARTWORK_ID_INVALID");
    assert.doesNotMatch(result.message, /(?:public|src|\\|\/artwork\/)/i);
  }

  const missing = createLocalArtworkRedirect("9999999999");
  assert.equal(missing.ok, false);
  assert.equal(missing.status, 404);
  assert.equal(missing.code, "ARTWORK_NOT_FOUND");
});

test("local asset verification rejects missing, corrupt, and orphaned files without touching production assets", async () => {
  const reviewed = [artworkManifest[0]];
  const inspected = inspectLocalArtworkBytes(VALID_JPEG);
  const entry = {
    publicId: reviewed[0].publicId,
    filename: localArtworkFilename(reviewed[0].publicId, inspected.sha256),
    sourceUrl: reviewed[0].artwork.thumbnailUrl,
    finalUrl: "https://archive.org/download/example/cover.jpg",
    sourcePageUrl: reviewed[0].artwork.sourceUrl,
    musicBrainzReleaseId: reviewed[0].musicBrainzReleaseId,
    musicBrainzReleaseGroupId: reviewed[0].musicBrainzReleaseGroupId,
    ...inspected,
    retrievedAt: "2026-07-21T00:00:00.000Z",
  };
  const base = {
    catalogIds: [entry.publicId],
    reviewedEntries: reviewed,
    localEntries: [entry],
    assetDirectory: "C:\\fixture-artwork",
  };

  await assert.rejects(
    () => verifyLocalArtworkSet({
      ...base,
      readFileImpl: async () => { throw Object.assign(new Error("missing"), { code: "ENOENT" }); },
      readdirImpl: async () => [],
    }),
    /missing/,
  );
  await assert.rejects(
    () => verifyLocalArtworkSet({
      ...base,
      readFileImpl: async () => Buffer.from("not an image"),
      readdirImpl: async () => [],
    }),
    (error) => error instanceof LocalArtworkAssetError && error.code === "LOCAL_ARTWORK_SIGNATURE_INVALID",
  );
  await assert.rejects(
    () => verifyLocalArtworkSet({
      ...base,
      readFileImpl: async () => VALID_JPEG,
      readdirImpl: async () => [
        { isFile: () => true, name: entry.filename },
        { isFile: () => true, name: "2.aaaaaaaaaaaa.jpg" },
      ],
    }),
    (error) => error instanceof LocalArtworkAssetError && error.code === "LOCAL_ARTWORK_COVERAGE_INVALID",
  );
});

test("downloader follows only the reviewed Cover Art Archive and trusted Archive hosts", async () => {
  const calls = [];
  const result = await downloadLocalArtworkAsset(SOURCE_URL, {
    fetchImpl: async (url) => {
      calls.push(String(url));
      if (calls.length === 1) return response({ status: 307, location: "https://archive.org/download/example/cover.jpg" });
      if (calls.length === 2) return response({ status: 302, location: "https://dn123.ca.archive.org/0/items/example/cover.jpg" });
      return response();
    },
    now: () => new Date("2026-07-21T00:00:00.000Z"),
  });
  assert.equal(calls.length, 3);
  assert.equal(result.finalUrl, "https://dn123.ca.archive.org/0/items/example/cover.jpg");
  assert.equal(result.redirects, 2);
  assert.equal(result.width, 1);
  assert.equal(result.height, 1);
  assert.equal(result.retrievedAt, "2026-07-21T00:00:00.000Z");

  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      fetchImpl: async () => response({ status: 307, location: "https://archive.org.evil.example/cover.jpg" }),
    }),
    (error) => error instanceof LocalArtworkAssetError && error.code === "LOCAL_ARTWORK_HOST_NOT_ALLOWED",
  );
});

test("downloader rejects redirect loops, spoofed types, invalid JPEG bytes, and misleading lengths", async () => {
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      maxRedirects: 1,
      fetchImpl: async () => response({ status: 307, location: SOURCE_URL }),
    }),
    (error) => error.code === "LOCAL_ARTWORK_REDIRECT_LIMIT",
  );
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      fetchImpl: async () => response({ contentType: "text/html" }),
    }),
    (error) => error.code === "LOCAL_ARTWORK_TYPE_INVALID",
  );
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      fetchImpl: async () => response({ body: Buffer.from("not a jpeg") }),
    }),
    (error) => error.code === "LOCAL_ARTWORK_SIGNATURE_INVALID",
  );
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      fetchImpl: async () => {
        const result = response();
        result.headers.set("content-length", "999");
        return result;
      },
    }),
    (error) => error.code === "LOCAL_ARTWORK_LENGTH_MISMATCH",
  );
});

test("downloader rejects empty, oversized, and timed-out responses", async () => {
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      fetchImpl: async () => response({ body: Buffer.alloc(0) }),
    }),
    (error) => error.code === "LOCAL_ARTWORK_EMPTY",
  );
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      maxBytes: 4,
      fetchImpl: async () => response(),
    }),
    (error) => error.code === "LOCAL_ARTWORK_TOO_LARGE",
  );
  await assert.rejects(
    () => downloadLocalArtworkAsset(SOURCE_URL, {
      timeoutMs: 5,
      fetchImpl: async (_url, { signal }) => new Promise((_resolve, reject) => {
        signal.addEventListener("abort", () => reject(signal.reason), { once: true });
      }),
    }),
    (error) => error.code === "LOCAL_ARTWORK_TIMEOUT",
  );
});
