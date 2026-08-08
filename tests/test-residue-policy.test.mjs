import assert from "node:assert/strict";
import test from "node:test";
import {
  TEST_CLEANUP_PROTECTED_COLLECTIONS,
  TEST_RESIDUE_COLLECTIONS,
  TEST_USER_FILTER,
} from "../src/lib/db/testResiduePolicy.js";

test("test cleanup cannot target catalog or dataset evidence collections", () => {
  const protectedDatasetCollections = [
    "vinylRecords",
    "datasetProducts",
    "datasetImports",
    "historicalAmazonRatings",
  ];
  for (const collection of protectedDatasetCollections) {
    assert.ok(TEST_CLEANUP_PROTECTED_COLLECTIONS.includes(collection));
    assert.equal(TEST_RESIDUE_COLLECTIONS.includes(collection), false);
  }
  assert.equal(new Set(TEST_RESIDUE_COLLECTIONS).size, TEST_RESIDUE_COLLECTIONS.length);
  assert.equal(TEST_USER_FILTER.username.$regex, "^e2e_");
});
