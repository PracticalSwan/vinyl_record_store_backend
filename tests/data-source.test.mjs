import test from "node:test";
import assert from "node:assert/strict";
import { getCatalogDataSource, getCatalogRepository } from "../src/lib/db/dataSource.js";

test("catalog data source defaults to seed", () => {
  assert.equal(getCatalogDataSource({}), "seed");
  assert.equal(getCatalogRepository({}).source, "seed");
});

test("catalog data source defaults to MongoDB when Atlas is configured", () => {
  const environment = {
    MONGODB_URI: "mongodb://localhost:27017",
    MONGODB_DB_NAME: "vinyl_record_store",
  };
  assert.equal(getCatalogDataSource(environment), "mongodb");
});

test("catalog data source rejects unsupported values", () => {
  assert.throws(
    () => getCatalogDataSource({ CATALOG_DATA_SOURCE: "automatic" }),
    /CATALOG_DATA_SOURCE must be one of/,
  );
});

test("MongoDB mode requires configuration and fails safely", () => {
  assert.throws(
    () => getCatalogDataSource({ CATALOG_DATA_SOURCE: "mongodb" }),
    (error) => error.code === "PERSISTENCE_UNAVAILABLE" && error.status === 503,
  );
});

test("MongoDB mode can be selected without connecting eagerly", () => {
  const environment = {
    CATALOG_DATA_SOURCE: "mongodb",
    MONGODB_URI: "mongodb://localhost:27017",
    MONGODB_DB_NAME: "vinyl_record_store",
  };
  assert.equal(getCatalogDataSource(environment), "mongodb");
  assert.equal(getCatalogRepository(environment).source, "mongodb");
});
