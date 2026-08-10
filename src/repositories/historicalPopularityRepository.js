import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";
import { HistoricalAmazonRating } from "../models/HistoricalAmazonRating.js";

export function createHistoricalPopularityRepository(
  model = HistoricalAmazonRating,
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
    listByDatasetKey: (datasetKey) => {
      if (!datasetKey) return Promise.resolve([]);
      return run(async () => model.aggregate([
        { $match: { datasetKey } },
        {
          $group: {
            _id: "$productPublicId",
            ratingCount: { $sum: 1 },
            meanRating: { $avg: "$rating" },
          },
        },
        {
          $project: {
            _id: 0,
            productPublicId: "$_id",
            ratingCount: 1,
            meanRating: 1,
          },
        },
      ]).exec());
    },
  };
}

export const historicalPopularityRepository = createHistoricalPopularityRepository();
