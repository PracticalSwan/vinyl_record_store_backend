import {
  disconnectMongoDB,
  pingMongoDB,
} from "../src/lib/db/mongodb.js";

try {
  const result = await pingMongoDB();
  console.log(JSON.stringify(result));
} catch (error) {
  console.error(JSON.stringify({
    status: "failed",
    error: error.name,
    message: "MongoDB connection or ping failed.",
  }));
  process.exitCode = 1;
} finally {
  await disconnectMongoDB();
}
