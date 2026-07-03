import { connectMongoDB, disconnectMongoDB } from "../src/lib/db/mongodb.js";
import { ALL_MODELS } from "../src/models/index.js";

const ensure = process.argv.includes("--ensure");
const signature = (keys, options = {}) => JSON.stringify({
  keys,
  unique: Boolean(options.unique),
  expireAfterSeconds: options.expireAfterSeconds ?? null,
});

try {
  await connectMongoDB();
  const report = [];

  for (const model of ALL_MODELS) {
    if (ensure) {
      await model.createCollection();
      await model.createIndexes();
    }

    let actual = [];
    try {
      actual = await model.collection.indexes();
    } catch (error) {
      if (error?.codeName !== "NamespaceNotFound") throw error;
    }
    const actualSignatures = new Set(actual.map((index) => signature(
      index.key,
      { unique: index.unique, expireAfterSeconds: index.expireAfterSeconds },
    )));
    const missing = model.schema.indexes()
      .filter(([keys, options]) => !actualSignatures.has(signature(keys, options)))
      .map(([keys, options]) => ({ keys, unique: Boolean(options.unique), expireAfterSeconds: options.expireAfterSeconds ?? null }));
    report.push({ collection: model.collection.name, missing });
  }

  console.log(JSON.stringify({ mode: ensure ? "ensure-and-verify" : "verify", collections: report }, null, 2));
  if (report.some((entry) => entry.missing.length > 0)) process.exitCode = 1;
} catch (error) {
  console.error(`MongoDB index verification failed: ${error.name || "Error"}`);
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
