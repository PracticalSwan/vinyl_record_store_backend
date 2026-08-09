export const TEST_RESIDUE_COLLECTIONS = Object.freeze([
  "interactions",
  "recommendationLogs",
  "carts",
  "wishlists",
  "ratings",
  "guestMerges",
  "feedback",
]);

export const TEST_CLEANUP_PROTECTED_COLLECTIONS = Object.freeze([
  "vinylRecords",
  "datasetProducts",
  "datasetImports",
  "historicalAmazonRatings",
  "counters",
  "orders",
  "auditLogs",
]);

export const TEST_USER_FILTER = Object.freeze({
  username: Object.freeze({ $regex: "^e2e_", $options: "" }),
});
