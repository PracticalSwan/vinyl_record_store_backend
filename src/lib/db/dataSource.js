import { invalid, persistenceUnavailable } from "../errors.js";
import { getMongoDBConfig } from "./mongodb.js";
import { mongoCatalogRepository } from "../../repositories/mongoCatalogRepository.js";
import { seedCatalogRepository } from "../../repositories/seedCatalogRepository.js";

export const CATALOG_DATA_SOURCES = ["seed", "mongodb"];

export function getCatalogDataSource(environment = process.env) {
  const source = environment.CATALOG_DATA_SOURCE?.trim().toLowerCase() || "seed";
  if (!CATALOG_DATA_SOURCES.includes(source)) {
    throw invalid(`CATALOG_DATA_SOURCE must be one of: ${CATALOG_DATA_SOURCES.join(", ")}.`);
  }
  if (source === "mongodb") {
    try {
      getMongoDBConfig(environment);
    } catch {
      throw persistenceUnavailable();
    }
  }
  return source;
}

export function getCatalogRepository(environment = process.env) {
  return getCatalogDataSource(environment) === "mongodb"
    ? mongoCatalogRepository
    : seedCatalogRepository;
}
