import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";
import { DatasetImport } from "../models/DatasetImport.js";

export function createDatasetImportRepository(
  model = DatasetImport,
  connect = connectMongoDB,
) {
  const run = async (operation) => {
    try {
      await connect();
      return await operation();
    } catch (error) {
      if (error?.code === "PERSISTENCE_UNAVAILABLE") throw error;
      throw persistenceUnavailable();
    }
  };

  return {
    activeStatus: () => run(async () => {
      const active = await model.findOne(
        { active: true, status: "active" },
        {
          _id: 0,
          datasetKey: 1,
          source: 1,
          sourceVersion: 1,
          counts: 1,
          stagedAt: 1,
          completedAt: 1,
          activatedAt: 1,
        },
      ).lean().exec();
      return active || null;
    }),
  };
}

export const datasetImportRepository = createDatasetImportRepository();
