import { readFile } from "node:fs/promises";
import path from "node:path";
import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { AMAZON_DATASET_KEY } from "../src/lib/dataset/amazonReviews2023.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";
import { User } from "../src/models/User.js";
import { VinylRecord } from "../src/models/VinylRecord.js";

const SHOWCASE_PUBLIC_IDS = ["demo-jazz", "demo-rock", "demo-soul"];
const expected = JSON.parse(await readFile(
  path.join(process.cwd(), "data", "amazon-reviews-2023", "data-quality-summary.json"),
  "utf8",
)).staged;

try {
  await connectMongoDB();
  const [
    active,
    datasetProducts,
    historicalRatings,
    historicalUsers,
    legacyProducts,
    users,
    historicalIndexes,
  ] = await Promise.all([
    DatasetImport.findOne({ active: true, status: "active" }).lean().exec(),
    VinylRecord.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.collection.distinct("userKey", { datasetKey: AMAZON_DATASET_KEY }),
    VinylRecord.countDocuments({ source: "demo-seed", datasetKey: null }).exec(),
    User.find({}, { _id: 0, publicId: 1, role: 1, active: 1 }).sort({ publicId: 1 }).lean().exec(),
    HistoricalAmazonRating.collection.indexes(),
  ]);
  const userPublicIds = users.map((user) => user.publicId).sort();
  const invalidHistoricalKeys = await HistoricalAmazonRating.countDocuments({
    datasetKey: AMAZON_DATASET_KEY,
    userKey: { $not: /^[0-9a-f]{64}$/ },
  }).select("+userKey").exec();
  const checks = {
    activeDataset: active?.datasetKey === AMAZON_DATASET_KEY,
    products: datasetProducts === expected.products,
    historicalRatings: historicalRatings === expected.ratings,
    historicalUsers: historicalUsers.length === expected.pseudonymousUsers,
    legacyCatalogPreserved: legacyProducts === 116,
    showcaseUsersPreserved: JSON.stringify(userPublicIds) === JSON.stringify(SHOWCASE_PUBLIC_IDS),
    showcaseUsersAreCustomers: users.every((user) => user.role === "customer" && user.active === true),
    pseudonymousKeysValid: invalidHistoricalKeys === 0,
    historicalRatingsHaveNoTtl: historicalIndexes.every((index) => index.expireAfterSeconds === undefined),
  };
  const result = {
    datasetKey: active?.datasetKey || null,
    counts: {
      datasetProducts,
      historicalRatings,
      historicalUsers: historicalUsers.length,
      legacyProducts,
      showcaseUsers: users.length,
    },
    showcasePublicIds: userPublicIds,
    checks,
  };
  console.log(JSON.stringify(result, null, 2));
  if (Object.values(checks).some((value) => value !== true)) {
    throw new Error("Dataset activation verification failed.");
  }
} finally {
  await disconnectMongoDB();
}
