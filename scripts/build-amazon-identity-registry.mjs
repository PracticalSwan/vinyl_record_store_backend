import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AMAZON_IDENTITY_NAMESPACE,
  canonicalSourceIdentityKey,
  readJsonlRows,
} from "../src/lib/dataset/amazonReviews2023.js";
import {
  AMAZON_IDENTITY_BASE_DATASET_KEY,
  assertAmazonIdentityRegistryReproduction,
} from "../src/lib/dataset/amazonDatasetReleases.js";

const apply = process.argv.includes("--apply");
const dataRoot = path.join(process.cwd(), "data", "amazon-reviews-2023");
const previousProducts = path.join(
  dataRoot,
  "staging",
  AMAZON_IDENTITY_BASE_DATASET_KEY,
  "products.jsonl",
);
const destination = path.join(dataRoot, "product-identity-registry.json");
const entries = [];
const publicIds = new Set();
const sourceIdentityKeys = new Set();

for await (const product of readJsonlRows(previousProducts, "previous staged product")) {
  const sourceId = product.provenance?.find((entry) => entry.field === "catalog-record")?.sourceId;
  const sourceIdentityKey = canonicalSourceIdentityKey(sourceId);
  if (!sourceIdentityKey) throw new Error("A previous staged product is missing its valid source identity.");
  if (sourceIdentityKeys.has(sourceIdentityKey) || publicIds.has(product.publicId)) {
    throw new Error("The previous staging contains a duplicate source identity or public ID.");
  }
  sourceIdentityKeys.add(sourceIdentityKey);
  publicIds.add(product.publicId);
  entries.push({
    sourceIdentityKey,
    publicId: product.publicId,
  });
}

entries.sort((left, right) => left.sourceIdentityKey.localeCompare(right.sourceIdentityKey));
const entriesDigest = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const registry = {
  schemaVersion: 1,
  identityNamespace: AMAZON_IDENTITY_NAMESPACE,
  derivedFromDatasetKey: AMAZON_IDENTITY_BASE_DATASET_KEY,
  entryCount: entries.length,
  entriesDigest,
  entries,
};

if (!apply) {
  console.log(JSON.stringify({
    mode: "dry-run",
    destination,
    entryCount: entries.length,
    entriesDigest,
  }, null, 2));
  process.exit(0);
}

let existing;
try {
  existing = JSON.parse(await readFile(destination, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
assertAmazonIdentityRegistryReproduction(existing, registry);
console.log(JSON.stringify({
  mode: "apply",
  destination,
  entryCount: entries.length,
  entriesDigest,
  publication: "unchanged",
}, null, 2));
