import test from "node:test";
import assert from "node:assert/strict";
import {
  getMongoDBConfig,
  MongoDBConfigurationError,
} from "../src/lib/db/mongodb.js";

test("MongoDB configuration requires a connection string", () => {
  assert.throws(
    () => getMongoDBConfig({ MONGODB_DB_NAME: "vinyl_record_store" }),
    MongoDBConfigurationError,
  );
});

test("MongoDB configuration requires a database name", () => {
  assert.throws(
    () => getMongoDBConfig({ MONGODB_URI: "mongodb://localhost:27017" }),
    MongoDBConfigurationError,
  );
});

test("MongoDB configuration trims environment values", () => {
  assert.deepEqual(
    getMongoDBConfig({
      MONGODB_URI: " mongodb://localhost:27017 ",
      MONGODB_DB_NAME: " vinyl_record_store ",
    }),
    {
      uri: "mongodb://localhost:27017",
      database: "vinyl_record_store",
    },
  );
});
