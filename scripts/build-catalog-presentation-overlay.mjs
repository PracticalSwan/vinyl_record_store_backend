import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { comparisonKey } from "../src/lib/catalog/normalize.js";

const overlayPath = path.join(process.cwd(), "src", "data", "catalogPresentationOverlay.json");
const existing = JSON.parse(await readFile(overlayPath, "utf8"));
const connection = await connectMongoDB();
const db = connection.db;
const active = await db.collection("datasetImports").findOne({ active: true, status: "active" });
if (!active?.datasetKey) throw new Error("No active dataset is available.");
const products = await db.collection("datasetProducts").find({
  datasetKey: active.datasetKey,
  deletedAt: null,
}).project({ _id: 0 }).toArray();
const ratingRows = await db.collection("historicalAmazonRatings").aggregate([
  { $match: { datasetKey: active.datasetKey } },
  { $group: { _id: "$productPublicId", count: { $sum: 1 } } },
]).toArray();
const ratingCounts = new Map(ratingRows.map(({ _id, count }) => [Number(_id), count]));
const norm = (value) => comparisonKey(String(value || ""));
function groupKey(product) {
  if (product.musicBrainzReleaseId) return `mb:${product.musicBrainzReleaseId}`;
  return [
    "display",
    norm(product.title),
    norm(product.artist),
    product.originalReleaseYear ?? product.year ?? "",
    product.editionReleaseYear ?? "",
    norm(product.label),
    norm(product.format),
  ].join("|");
}

function metadataScore(product) {
  return [product.artist, product.genre, product.originalReleaseYear ?? product.year,
    product.editionReleaseYear, product.label, product.format].filter(Boolean).length;
}

function representativeOrder(left, right) {
  return (ratingCounts.get(right.publicId) || 0) - (ratingCounts.get(left.publicId) || 0)
    || Number(Boolean(right.artwork?.thumbnailUrl)) - Number(Boolean(left.artwork?.thumbnailUrl))
    || metadataScore(right) - metadataScore(left)
    || left.publicId - right.publicId;
}
const groups = new Map();
for (const product of products) {
  const key = groupKey(product);
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(product);
}
const hiddenPublicIds = [];
for (const group of groups.values()) {
  if (group.length < 2) continue;
  const ranked = [...group].sort(representativeOrder);
  hiddenPublicIds.push(...ranked.slice(1).map((product) => product.publicId));
}
hiddenPublicIds.sort((left, right) => left - right);
const output = {
  schemaVersion: 1,
  datasetKey: active.datasetKey,
  policy: existing.policy,
  hiddenPublicIds,
  supplementalArtwork: existing.supplementalArtwork || {},
};
const verify = process.argv.includes("--verify");
if (verify) {
  const same = JSON.stringify(hiddenPublicIds) === JSON.stringify(existing.hiddenPublicIds);
  console.log(JSON.stringify({ products: products.length, hidden: hiddenPublicIds.length, matchesCommitted: same }));
  if (!same) process.exitCode = 1;
} else {
  await writeFile(overlayPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");
  console.log(JSON.stringify({ products: products.length, hidden: hiddenPublicIds.length }));
}
await disconnectMongoDB();
