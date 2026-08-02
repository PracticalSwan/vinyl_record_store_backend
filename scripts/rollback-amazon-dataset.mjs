import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { DatasetImport } from "../src/models/DatasetImport.js";

const target = process.argv.find((value) => value.startsWith("--to="))?.slice(5) || "legacy";
const apply = process.argv.includes("--apply");
if (!apply) {
  console.log(JSON.stringify({ mode: "dry-run", target, deletion: false }, null, 2));
  process.exit(0);
}
try {
  const connection = await connectMongoDB();
  await connection.transaction(async (session) => {
    await DatasetImport.updateMany(
      { active: true },
      { $set: { active: false, status: "superseded" } },
      { session },
    );
    if (target !== "legacy") {
      const result = await DatasetImport.updateOne(
        { datasetKey: target, status: { $in: ["completed", "superseded"] } },
        { $set: { active: true, status: "active", activatedAt: new Date() } },
        { session },
      );
      if (result.matchedCount !== 1) throw new Error("Rollback target is not a completed dataset import.");
    }
  });
  console.log(JSON.stringify({ mode: "apply", target, deletion: false }, null, 2));
} finally {
  await disconnectMongoDB();
}
