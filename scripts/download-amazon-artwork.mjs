import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { AMAZON_DATASET_KEY, sha256File } from "../src/lib/dataset/amazonReviews2023.js";
import {
  assertAmazonReleaseArtifactDigest,
  getCurrentAmazonDatasetRelease,
} from "../src/lib/dataset/amazonDatasetReleases.js";
import {
  assertDatasetArtworkDirectory,
  publishContentAddressedDatasetArtwork,
  publishDatasetArtworkManifest,
  verifyDatasetArtworkPublication,
} from "../src/lib/dataset/datasetArtworkPublication.js";
import {
  downloadLocalArtworkAsset,
  inspectLocalArtworkBytes,
  localArtworkFilename,
} from "../src/lib/external/localArtworkAssets.js";

const checkOnly = process.argv.includes("--check");
const repositoryRoot = process.cwd();
const dataRoot = path.join(repositoryRoot, "data", "amazon-reviews-2023");
const currentRelease = getCurrentAmazonDatasetRelease();
const enrichmentPath = path.join(dataRoot, currentRelease.artworkEnrichmentFilename);
const artworkRoot = path.join(repositoryRoot, "public", "artwork");
const assetDirectory = path.join(artworkRoot, "dataset");
const generatedManifest = path.join(repositoryRoot, "src", "data", "datasetLocalArtworkManifest.js");
const cacheRoot = path.join(repositoryRoot, ".cache");
const configuredConcurrency = Number.parseInt(process.env.DATASET_ARTWORK_CONCURRENCY || "2", 10);
const downloadConcurrency = Number.isInteger(configuredConcurrency)
  ? Math.min(6, Math.max(1, configuredConcurrency))
  : 2;
const DOWNLOAD_RETRIES = 2;

assertAmazonReleaseArtifactDigest(
  currentRelease,
  "artworkEnrichment",
  await sha256File(enrichmentPath),
);

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function loadPublishedManifest() {
  try {
    const loadedModule = await import(`${pathToFileURL(generatedManifest).href}?v=${Date.now()}`);
    return Array.isArray(loadedModule.datasetLocalArtworkManifest)
      ? loadedModule.datasetLocalArtworkManifest
      : [];
  } catch {
    return [];
  }
}

async function runWorkers(items, worker, concurrency = 6) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

function isTransientDownloadError(error) {
  return [
    "LOCAL_ARTWORK_UPSTREAM_ERROR",
    "LOCAL_ARTWORK_UNREACHABLE",
    "LOCAL_ARTWORK_TIMEOUT",
  ].includes(error?.code);
}

async function downloadWithRetry(sourceUrl) {
  for (let attempt = 0; ; attempt += 1) {
    try {
      return await downloadLocalArtworkAsset(sourceUrl);
    } catch (error) {
      if (!isTransientDownloadError(error) || attempt >= DOWNLOAD_RETRIES) throw error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
    }
  }
}

const enrichment = JSON.parse(await readFile(enrichmentPath, "utf8"));
if (enrichment.datasetKey !== AMAZON_DATASET_KEY || enrichment.entriesDigest !== createHash("sha256").update(JSON.stringify(enrichment.entries)).digest("hex")) {
  throw new Error("The dataset artwork enrichment manifest is invalid.");
}
const accepted = enrichment.entries
  .filter((entry) => entry.status === "accepted")
  .sort((left, right) => left.publicId - right.publicId);
const sourceManifestSha256 = enrichment.entriesDigest;
const published = await loadPublishedManifest();

if (checkOnly) {
  const result = await verifyDatasetArtworkPublication({
    entries: published,
    accepted,
    sourceManifestSha256,
    assetDirectory,
    boundaryRoot: repositoryRoot,
  });
  console.log(JSON.stringify({ status: "ok", ...result, sourceManifestSha256 }, null, 2));
  process.exit(0);
}

await mkdir(cacheRoot, { recursive: true });
await assertDatasetArtworkDirectory(artworkRoot, { boundaryRoot: repositoryRoot });
await mkdir(assetDirectory, { recursive: true });
await assertDatasetArtworkDirectory(assetDirectory, { boundaryRoot: repositoryRoot });
const stagingDirectory = await mkdtemp(path.join(cacheRoot, "dataset-artwork-download-"));
const publishedById = new Map(published.map((entry) => [entry.publicId, entry]));
let reused = 0;
let downloaded = 0;
try {
  const entries = await runWorkers(accepted, async (source, index) => {
    const previous = publishedById.get(source.publicId);
    if (previous && await fileExists(path.join(assetDirectory, previous.filename))) {
      try {
        await verifyDatasetArtworkPublication({
          entries: [previous],
          accepted: [source],
          sourceManifestSha256,
          assetDirectory,
          boundaryRoot: repositoryRoot,
          exactDirectory: false,
          requireSourceManifestDigest: false,
        });
        reused += 1;
        return { ...previous, sourceManifestSha256 };
      } catch {
        // Invalid or stale published entries are reacquired below and still
        // pass the same content-addressed publication checks as new entries.
      }
    }
    const asset = await downloadWithRetry(source.artwork.thumbnailUrl);
    const filename = localArtworkFilename(source.publicId, asset.sha256);
    await writeFile(path.join(stagingDirectory, filename), asset.body);
    downloaded += 1;
    if ((index + 1) % 25 === 0 || index === accepted.length - 1) {
      process.stderr.write(`[Dataset artwork ${index + 1}/${accepted.length}] ${source.publicId}\n`);
    }
    return {
      publicId: source.publicId,
      filename,
      assetPath: `/artwork/dataset/${filename}`,
      sourceUrl: source.artwork.thumbnailUrl,
      finalUrl: asset.finalUrl,
      sourcePageUrl: source.artwork.sourceUrl,
      musicBrainzReleaseId: source.musicBrainzReleaseId,
      musicBrainzReleaseGroupId: source.musicBrainzReleaseGroupId,
      contentType: asset.contentType,
      byteLength: asset.byteLength,
      width: asset.width,
      height: asset.height,
      sha256: asset.sha256,
      retrievedAt: asset.retrievedAt,
      sourceManifestSha256,
    };
  }, downloadConcurrency);

  for (const entry of entries) {
    const staged = path.join(stagingDirectory, entry.filename);
    if (await fileExists(staged)) {
      const destinationPath = path.join(assetDirectory, entry.filename);
      await publishContentAddressedDatasetArtwork(staged, destinationPath, {
        expectedSha256: entry.sha256,
        contentType: entry.contentType,
      });
    }
  }
  const result = await publishDatasetArtworkManifest({
    entries,
    accepted,
    sourceManifestSha256,
    assetDirectory,
    boundaryRoot: repositoryRoot,
    manifestPath: generatedManifest,
  });
  console.log(JSON.stringify({
    status: "ok",
    ...result,
    reused,
    downloaded,
    sourceManifestSha256,
  }, null, 2));
} finally {
  const resolved = path.resolve(stagingDirectory);
  if (!resolved.startsWith(`${path.resolve(cacheRoot)}${path.sep}`)) {
    throw new Error("Refusing to remove an artwork staging path outside the cache root.");
  }
  await rm(resolved, { recursive: true, force: true });
}
