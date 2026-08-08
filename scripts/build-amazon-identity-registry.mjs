import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  AMAZON_IDENTITY_NAMESPACE,
  AMAZON_PREVIOUS_DATASET_KEY,
  canonicalSourceIdentityKey,
  readJsonlRows,
} from "../src/lib/dataset/amazonReviews2023.js";

const apply = process.argv.includes("--apply");
const dataRoot = path.join(process.cwd(), "data", "amazon-reviews-2023");
const previousProducts = path.join(
  dataRoot,
  "staging",
  AMAZON_PREVIOUS_DATASET_KEY,
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
  derivedFromDatasetKey: AMAZON_PREVIOUS_DATASET_KEY,
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

await writeFile(destination, `${JSON.stringify(registry, null, 2)}\n`, "utf8");
const verified = JSON.parse(await readFile(destination, "utf8"));
if (verified.entryCount !== entries.length || verified.entriesDigest !== entriesDigest) {
  throw new Error("The published identity registry did not verify after writing.");
}
console.log(JSON.stringify({
  mode: "apply",
  destination,
  entryCount: entries.length,
  entriesDigest,
}, null, 2));
