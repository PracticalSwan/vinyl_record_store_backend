import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { summarizeHistoricalEvaluationReadiness } from "../src/lib/dataset/historicalEvaluationAdapter.js";
import { DatasetImport } from "../src/models/DatasetImport.js";
import { HistoricalAmazonRating } from "../src/models/HistoricalAmazonRating.js";

try {
  await connectMongoDB();
  const active = await DatasetImport.findOne(
    { active: true, status: "active" },
    { datasetKey: 1 },
  ).lean().exec();
  if (!active) {
    console.log(JSON.stringify({
      schemaVersion: 1,
      evidenceSource: "historical-amazon-ratings",
      status: "inactive",
      aggregateOnly: true,
    }, null, 2));
    process.exitCode = 2;
  } else {
    const cursor = HistoricalAmazonRating.find(
      { datasetKey: active.datasetKey },
      {
        datasetKey: 1,
        userKey: 1,
        productPublicId: 1,
        rating: 1,
        occurredAt: 1,
        split: 1,
      },
    )
      .select("+userKey")
      .sort({ userKey: 1, occurredAt: 1, productPublicId: 1 })
      .lean()
      .cursor();
    const summary = await summarizeHistoricalEvaluationReadiness(cursor, {
      datasetKey: active.datasetKey,
    });
    console.log(JSON.stringify(summary, null, 2));
  }
} finally {
  await disconnectMongoDB();
}
