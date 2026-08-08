import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { AMAZON_DATASET_KEY } from "../src/lib/dataset/amazonReviews2023.js";
import { assertFailedImportCleanable } from "../src/lib/dataset/integrity.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { DatasetProduct } from "../src/models/DatasetProduct.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";

const apply = process.argv.includes("--apply");

try {
  const connection = await connectMongoDB();
  const document = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).lean().exec();
  assertFailedImportCleanable(document);
  const [products, ratings] = await Promise.all([
    DatasetProduct.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
    HistoricalAmazonRating.countDocuments({ datasetKey: AMAZON_DATASET_KEY }).exec(),
  ]);
  const summary = {
    mode: apply ? "apply" : "dry-run",
    datasetKey: AMAZON_DATASET_KEY,
    status: document.status,
    products,
    ratings,
    deletesOnlyUnsealedInactiveTarget: true,
  };
  if (apply) {
    await connection.transaction(async (session) => {
      const transactional = await DatasetImport.findOne({ datasetKey: AMAZON_DATASET_KEY }).session(session).lean().exec();
      assertFailedImportCleanable(transactional);
      await DatasetProduct.deleteMany({ datasetKey: AMAZON_DATASET_KEY }, { session });
      await HistoricalAmazonRating.deleteMany({ datasetKey: AMAZON_DATASET_KEY }, { session });
      const removed = await DatasetImport.deleteOne({
        datasetKey: AMAZON_DATASET_KEY,
        active: false,
        sealedAt: null,
        status: { $in: ["failed", "importing"] },
      }, { session });
      if (removed.deletedCount !== 1) throw new Error("The failed import changed before cleanup completed.");
    });
  }
  console.log(JSON.stringify(summary, null, 2));
} finally {
  await disconnectMongoDB();
}
