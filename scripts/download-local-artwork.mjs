import { randomUUID } from "node:crypto";
import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { artworkManifest, ARTWORK_REVIEWED_AT } from "../src/data/artworkManifest.js";
import { records } from "../src/data/records.js";
import {
  downloadLocalArtworkAsset,
  inspectLocalArtworkBytes,
  localArtworkFilename,
  renderLocalArtworkManifest,
  sourceArtworkManifestSha256,
  verifyLocalArtworkSet,
} from "../src/lib/external/localArtworkAssets.js";

const REPOSITORY_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const ASSET_DIRECTORY = path.join(REPOSITORY_ROOT, "public", "artwork");
const GENERATED_MANIFEST = path.join(REPOSITORY_ROOT, "src", "data", "localArtworkManifest.js");
const CACHE_ROOT = path.join(REPOSITORY_ROOT, ".cache");
const CONCURRENCY = 4;
const CHECK_ONLY = process.argv.includes("--check");
const REFRESH = process.argv.includes("--refresh");
const PRUNE = process.argv.includes("--prune");
const SUPPORTED_FLAGS = new Set(["--check", "--refresh", "--prune"]);

for (const argument of process.argv.slice(2)) {
  if (!SUPPORTED_FLAGS.has(argument)) throw new Error(`Unsupported argument: ${argument}`);
}
if (CHECK_ONLY && (REFRESH || PRUNE)) {
  throw new Error("--check cannot be combined with --refresh or --prune.");
}

async function exists(target) {
  try {
    await access(target);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function loadPublishedManifest() {
  if (!(await exists(GENERATED_MANIFEST))) return [];
  const moduleUrl = `${pathToFileURL(GENERATED_MANIFEST).href}?t=${Date.now()}`;
  const loaded = await import(moduleUrl);
  return Array.isArray(loaded.localArtworkManifest) ? loaded.localArtworkManifest : [];
}

function existingEntryMatches(entry, reviewed, inspected) {
  return entry
    && entry.publicId === reviewed.publicId
    && entry.sourceUrl === reviewed.artwork.thumbnailUrl
    && entry.sourcePageUrl === reviewed.artwork.sourceUrl
    && entry.musicBrainzReleaseId === reviewed.musicBrainzReleaseId
    && entry.musicBrainzReleaseGroupId === reviewed.musicBrainzReleaseGroupId
    && entry.filename === localArtworkFilename(reviewed.publicId, inspected.sha256)
    && entry.contentType === inspected.contentType
    && entry.byteLength === inspected.byteLength
    && entry.width === inspected.width
    && entry.height === inspected.height
    && entry.sha256 === inspected.sha256;
}

async function reusableEntry(entry, reviewed) {
  if (!entry || REFRESH) return null;
  try {
    const body = await readFile(path.join(ASSET_DIRECTORY, entry.filename));
    const inspected = inspectLocalArtworkBytes(body, { contentType: entry.contentType });
    return existingEntryMatches(entry, reviewed, inspected) ? entry : null;
  } catch {
    return null;
  }
}

async function runWorkers(items, worker, limit = CONCURRENCY) {
  const output = new Array(items.length);
  let cursor = 0;
  let failure = null;

  async function run() {
    while (!failure) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      try {
        output[index] = await worker(items[index], index);
      } catch (error) {
        failure = error;
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => run()));
  if (failure) throw failure;
  return output;
}

async function publishTextFile(destination, content) {
  const current = await readFile(destination, "utf8").catch((error) => {
    if (error?.code === "ENOENT") return null;
    throw error;
  });
  if (current === content) return false;

  await mkdir(path.dirname(destination), { recursive: true });
  const temporary = `${destination}.${randomUUID()}.tmp`;
  const backup = `${destination}.${randomUUID()}.bak`;
  await writeFile(temporary, content, "utf8");

  if (current === null) {
    await rename(temporary, destination);
    return true;
  }

  await rename(destination, backup);
  try {
    await rename(temporary, destination);
    await rm(backup, { force: true });
    return true;
  } catch (error) {
    await rename(backup, destination).catch(() => {});
    await rm(temporary, { force: true }).catch(() => {});
    throw error;
  }
}

async function publishStagedFile(stagedPath, filename) {
  const destination = path.join(ASSET_DIRECTORY, filename);
  try {
    await rename(stagedPath, destination);
  } catch (error) {
    if (!await exists(destination)) throw error;
    const [stagedBody, publishedBody] = await Promise.all([readFile(stagedPath), readFile(destination)]);
    const staged = inspectLocalArtworkBytes(stagedBody);
    const published = inspectLocalArtworkBytes(publishedBody);
    if (staged.sha256 !== published.sha256) {
      throw new Error(`Refusing to overwrite a conflicting content-addressed asset: ${filename}`);
    }
    await rm(stagedPath, { force: true });
  }
}

async function pruneOrphans(expectedFilenames) {
  const { readdir } = await import("node:fs/promises");
  const entries = await readdir(ASSET_DIRECTORY, { withFileTypes: true });
  let removed = 0;
  for (const entry of entries) {
    if (!entry.isFile() || !/^[1-9][0-9]*\.[0-9a-f]{12}\.jpg$/.test(entry.name)) continue;
    if (expectedFilenames.has(entry.name)) continue;
    await rm(path.join(ASSET_DIRECTORY, entry.name), { force: true });
    removed += 1;
  }
  return removed;
}

async function checkPublishedAssets() {
  const localEntries = await loadPublishedManifest();
  if (!localEntries.length) throw new Error("The generated local artwork manifest is missing or empty.");
  const result = await verifyLocalArtworkSet({
    catalogIds: records.map((record) => record.id),
    reviewedEntries: artworkManifest,
    localEntries,
    assetDirectory: ASSET_DIRECTORY,
    strictOrphans: true,
  });
  console.log(`Verified ${result.count} local artwork files (${result.totalBytes} bytes).`);
  return result;
}

async function main() {
  if (CHECK_ONLY) {
    await checkPublishedAssets();
    return;
  }

  const orderedReviewed = [...artworkManifest].sort((left, right) => left.publicId - right.publicId);
  const existingEntries = await loadPublishedManifest();
  const existingById = new Map(existingEntries.map((entry) => [entry.publicId, entry]));
  const sourceManifestSha256 = sourceArtworkManifestSha256(orderedReviewed);

  await mkdir(CACHE_ROOT, { recursive: true });
  const stagingDirectory = await mkdtemp(path.join(CACHE_ROOT, "artwork-download-"));
  let reused = 0;
  let downloaded = 0;

  try {
    const localEntries = await runWorkers(orderedReviewed, async (reviewed, index) => {
      const existing = await reusableEntry(existingById.get(reviewed.publicId), reviewed);
      if (existing) {
        reused += 1;
        return existing;
      }

      const asset = await downloadLocalArtworkAsset(reviewed.artwork.thumbnailUrl);
      const filename = localArtworkFilename(reviewed.publicId, asset.sha256);
      await writeFile(path.join(stagingDirectory, filename), asset.body);
      downloaded += 1;
      if ((index + 1) % 10 === 0 || index === orderedReviewed.length - 1) {
        console.log(`Prepared ${index + 1}/${orderedReviewed.length} reviewed artwork entries.`);
      }
      return {
        publicId: reviewed.publicId,
        filename,
        sourceUrl: reviewed.artwork.thumbnailUrl,
        finalUrl: asset.finalUrl,
        sourcePageUrl: reviewed.artwork.sourceUrl,
        musicBrainzReleaseId: reviewed.musicBrainzReleaseId,
        musicBrainzReleaseGroupId: reviewed.musicBrainzReleaseGroupId,
        contentType: asset.contentType,
        byteLength: asset.byteLength,
        width: asset.width,
        height: asset.height,
        sha256: asset.sha256,
        retrievedAt: asset.retrievedAt,
      };
    });

    await mkdir(ASSET_DIRECTORY, { recursive: true });
    for (const entry of localEntries) {
      const stagedPath = path.join(stagingDirectory, entry.filename);
      if (await exists(stagedPath)) await publishStagedFile(stagedPath, entry.filename);
    }

    await verifyLocalArtworkSet({
      catalogIds: records.map((record) => record.id),
      reviewedEntries: orderedReviewed,
      localEntries,
      assetDirectory: ASSET_DIRECTORY,
      strictOrphans: false,
    });

    const manifestText = renderLocalArtworkManifest(localEntries, {
      sourceReviewedAt: ARTWORK_REVIEWED_AT,
      sourceManifestSha256,
    });
    const manifestChanged = await publishTextFile(GENERATED_MANIFEST, manifestText);
    const removed = PRUNE
      ? await pruneOrphans(new Set(localEntries.map((entry) => entry.filename)))
      : 0;
    const verified = await verifyLocalArtworkSet({
      catalogIds: records.map((record) => record.id),
      reviewedEntries: orderedReviewed,
      localEntries,
      assetDirectory: ASSET_DIRECTORY,
      strictOrphans: PRUNE || existingEntries.length === 0,
    });

    console.log(JSON.stringify({
      status: "ok",
      count: verified.count,
      totalBytes: verified.totalBytes,
      reused,
      downloaded,
      manifestChanged,
      pruned: removed,
      sourceManifestSha256,
    }, null, 2));
  } finally {
    const resolved = path.resolve(stagingDirectory);
    if (!resolved.startsWith(`${path.resolve(CACHE_ROOT)}${path.sep}`)) {
      throw new Error("Refusing to remove an artwork staging path outside the cache root.");
    }
    await rm(resolved, { recursive: true, force: true });
  }
}

await main();
