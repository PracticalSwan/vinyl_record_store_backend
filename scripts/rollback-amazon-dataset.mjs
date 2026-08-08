import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { AMAZON_PREVIOUS_DATASET_KEY } from "../src/lib/dataset/amazonReviews2023.js";
import { assertRollbackTarget } from "../src/lib/dataset/integrity.js";
import { DatasetImport } from "../src/models/DatasetImport.js";

const target = process.argv.find((value) => value.startsWith("--to="))?.slice(5) || "legacy";
const apply = process.argv.includes("--apply");
if (target !== "legacy" && !/^[a-z0-9][a-z0-9-]{0,159}$/.test(target)) throw new Error("--to must be legacy or a valid dataset key.");
try {
  const connection = await connectMongoDB();
  const current = await DatasetImport.findOne({ active: true, status: "active" }).lean().exec();
  const targetDocument = target === "legacy"
    ? null
    : await DatasetImport.findOne({ datasetKey: target }).lean().exec();
  if (target !== "legacy") {
    assertRollbackTarget(targetDocument, { allowLegacyUnsealed: target === AMAZON_PREVIOUS_DATASET_KEY });
  }
  if (!apply) {
    console.log(JSON.stringify({
      mode: "dry-run",
      current: current?.datasetKey || "legacy",
      target,
      targetStatus: targetDocument?.status || null,
      deletion: false,
    }, null, 2));
  } else {
    await connection.transaction(async (session) => {
      if (target !== "legacy") {
        const transactionalTarget = await DatasetImport.findOne({ datasetKey: target }).session(session).lean().exec();
        assertRollbackTarget(transactionalTarget, { allowLegacyUnsealed: target === AMAZON_PREVIOUS_DATASET_KEY });
      }
      await DatasetImport.updateMany(
        { active: true },
        { $set: { active: false, status: "superseded" } },
        { session },
      );
      if (target !== "legacy") {
        const result = await DatasetImport.updateOne(
          { datasetKey: target, active: false, status: { $in: ["completed", "superseded"] } },
          { $set: { active: true, status: "active", activatedAt: new Date() } },
          { session },
        );
        if (result.matchedCount !== 1) throw new Error("Rollback target is not a completed dataset import.");
      }
    });
    console.log(JSON.stringify({ mode: "apply", target, deletion: false }, null, 2));
  }
} finally {
  await disconnectMongoDB();
}
