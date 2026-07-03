import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { planSeedMigration, summarizeMigration } from "../src/lib/db/seedMigration.js";
import { VinylRecord } from "../src/models/VinylRecord.js";

const apply = process.argv.includes("--apply");

try {
  const connection = await connectMongoDB();
  const existing = await VinylRecord.find({}).lean().exec();
  const actions = planSeedMigration(existing);
  const summary = summarizeMigration(actions);
  const conflicts = actions
    .filter((action) => action.type === "conflict")
    .map(({ publicId, slug, reason }) => ({ publicId, slug, reason }));

  console.log(JSON.stringify({ mode: apply ? "apply" : "dry-run", ...summary, conflicts }, null, 2));

  if (summary.conflicts > 0) {
    process.exitCode = 1;
  } else if (apply) {
    await VinylRecord.createIndexes();
    const operations = actions.flatMap((action) => {
      if (action.type === "create") return [{ insertOne: { document: action.desired } }];
      if (action.type === "update") {
        return [{
          updateOne: {
            filter: { publicId: action.publicId, source: "demo-seed" },
            update: { $set: action.desired },
          },
        }];
      }
      return [];
    });
    if (operations.length > 0) {
      const session = await connection.startSession();
      try {
        await session.withTransaction(() => VinylRecord.bulkWrite(
          operations,
          { ordered: true, session },
        ));
      } finally {
        await session.endSession();
      }
    }
    console.log(JSON.stringify({ status: "applied", writes: operations.length }));
  }
} catch (error) {
  console.error(`MongoDB seed migration failed: ${error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
