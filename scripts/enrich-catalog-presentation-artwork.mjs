import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { comparisonKey } from "../src/lib/catalog/normalize.js";
import { presentationArtworkQuery, selectPresentationReleaseGroup } from "../src/lib/catalog/presentationEnrichment.js";
import { createMusicBrainzClient } from "../src/lib/external/musicBrainzClient.js";

const root = process.cwd();
const overlayPath = path.join(root, "src", "data", "catalogPresentationOverlay.json");
const progressPath = path.join(root, ".cache", "catalog-presentation-artwork-progress.json");
const proxyBase = String(process.env.PRESENTATION_ARTWORK_PROXY_BASE_URL || "https://groovehaus-api.netlify.app").replace(/\/$/, "");
const overlay = JSON.parse(await readFile(overlayPath, "utf8"));
const hidden = new Set(overlay.hiddenPublicIds.map(Number));
const connection = await connectMongoDB();
let active;
let products;
try {
  const db = connection.db;
  active = await db.collection("datasetImports").findOne({ active: true, status: "active" });
  if (active?.datasetKey !== overlay.datasetKey) throw new Error("Presentation overlay does not match the active dataset.");
  products = await db.collection("datasetProducts").find({ datasetKey: active.datasetKey, deletedAt: null })
    .project({ _id: 0, publicId: 1, title: 1, artist: 1, artwork: 1 }).sort({ publicId: 1 }).toArray();
} finally {
  await disconnectMongoDB();
}
const queryGroups = new Map();
for (const product of products) {
  if (hidden.has(product.publicId) || product.artwork?.thumbnailUrl) continue;
  const query = presentationArtworkQuery(product);
  if (!query) continue;
  const key = `${query.title}|${comparisonKey(query.artist)}`;
  if (!queryGroups.has(key)) queryGroups.set(key, { key, query, product, publicIds: [] });
  queryGroups.get(key).publicIds.push(product.publicId);
}

async function writeProgress(progress) {
  await mkdir(path.dirname(progressPath), { recursive: true });
  const temporary = `${progressPath}.tmp`;
  await writeFile(temporary, `${JSON.stringify(progress, null, 2)}\n`, "utf8");
  await rename(temporary, progressPath);
}

let progress = { schemaVersion: 1, datasetKey: active.datasetKey, matches: {} };
try {
  const saved = JSON.parse(await readFile(progressPath, "utf8"));
  if (saved.schemaVersion === 1 && saved.datasetKey === active.datasetKey) progress = saved;
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
const musicBrainz = createMusicBrainzClient();
console.error(`[presentation-artwork] ${queryGroups.size} unique unresolved album queries`);
let cursor = 0;
for (const group of queryGroups.values()) {
  cursor += 1;
  const previous = progress.matches[group.key];
  if (previous && previous.status !== "error") continue;
  try {
    const candidates = await musicBrainz.findReleaseGroupCandidates({
      ...group.query,
      primaryType: "album",
      limit: 5,
    });
    const selected = selectPresentationReleaseGroup(group.product, candidates);
    progress.matches[group.key] = selected ? {
      status: "matched",
      releaseGroupId: selected.id,
      matchScore: selected.score,
      publicIds: group.publicIds,
    } : { status: "unresolved", publicIds: group.publicIds };
  } catch (error) {
    progress.matches[group.key] = {
      status: "error",
      error: String(error?.message || error).slice(0, 200),
      publicIds: group.publicIds,
    };
  }
  if (cursor % 10 === 0 || cursor === queryGroups.size) {
    await writeProgress(progress);
    console.error(`[presentation-artwork] MusicBrainz ${cursor}/${queryGroups.size}`);
  }
}
await writeProgress(progress);
const matched = Object.values(progress.matches).filter((entry) => entry.status === "matched");
console.error(`[presentation-artwork] ${matched.length} unique album matches require artwork validation`);
async function validateArtwork(entry) {
  const target = `https://coverartarchive.org/release-group/${entry.releaseGroupId}/front-500`;
  const url = `${proxyBase}/api/artwork?u=${encodeURIComponent(target)}`;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(20_000) });
    const contentType = response.headers.get("content-type") || "";
    if (!response.ok || !contentType.startsWith("image/")) return false;
    await response.arrayBuffer();
    return true;
  } catch {
    return false;
  }
}

let validationCursor = 0;
const validationConcurrency = 4;
let nextValidation = 0;
await Promise.all(Array.from({ length: Math.min(validationConcurrency, matched.length) }, async () => {
  while (nextValidation < matched.length) {
    const index = nextValidation;
    nextValidation += 1;
    const entry = matched[index];
    entry.artworkValidated = await validateArtwork(entry);
    validationCursor += 1;
    if (validationCursor % 25 === 0 || validationCursor === matched.length) {
      console.error(`[presentation-artwork] artwork ${validationCursor}/${matched.length}`);
    }
  }
}));
await writeProgress(progress);
const supplementalArtwork = {};
for (const entry of matched) {
  if (!entry.artworkValidated) continue;
  for (const publicId of entry.publicIds) {
    supplementalArtwork[String(publicId)] = {
      releaseGroupId: entry.releaseGroupId,
      matchScore: entry.matchScore,
    };
  }
}
const orderedArtwork = Object.fromEntries(Object.entries(supplementalArtwork)
  .sort(([left], [right]) => Number(left) - Number(right)));
const output = { ...overlay, supplementalArtwork: orderedArtwork };
await writeFile(overlayPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
const unresolved = Object.values(progress.matches).filter((entry) => entry.status === "unresolved").length;
const errors = Object.values(progress.matches).filter((entry) => entry.status === "error").length;
const validGroups = matched.filter((entry) => entry.artworkValidated).length;
console.log(JSON.stringify({
  visibleProducts: products.length - hidden.size,
  uniqueQueries: queryGroups.size,
  matchedGroups: matched.length,
  validatedGroups: validGroups,
  supplementalProducts: Object.keys(orderedArtwork).length,
  unresolvedGroups: unresolved,
  errorGroups: errors,
}, null, 2));
await disconnectMongoDB();
