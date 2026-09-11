import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";
import { HistoricalAmazonRating } from "../models/HistoricalAmazonRating.js";

const LIVE_COLLABORATIVE_SPLITS = Object.freeze(["train", "validation"]);
const POSITIVE_RATING_THRESHOLD = 4;

function normalizeAnchors(anchorProductIds) {
  return [...new Set((anchorProductIds || []).filter(
    (value) => Number.isInteger(value) && value > 0,
  ))].sort((a, b) => a - b);
}

export function createHistoricalCollaborativeRepository(
  model = HistoricalAmazonRating,
  connect = connectMongoDB,
) {
  const supportCache = new Map();
  const run = async (operation) => {
    try {
      await connect();
      return await operation();
    } catch (error) {
      if (error?.code === "PERSISTENCE_UNAVAILABLE") throw error;
      throw persistenceUnavailable();
    }
  };

  const positiveSupports = (datasetKey) => {
    if (supportCache.has(datasetKey)) return supportCache.get(datasetKey);
    const pending = model.aggregate([
      {
        $match: {
          datasetKey,
          split: { $in: LIVE_COLLABORATIVE_SPLITS },
          rating: { $gte: POSITIVE_RATING_THRESHOLD },
        },
      },
      { $group: { _id: "$productPublicId", positiveUserCount: { $sum: 1 } } },
      {
        $project: {
          _id: 0,
          productPublicId: "$_id",
          positiveUserCount: 1,
        },
      },
      { $sort: { productPublicId: 1 } },
    ]).exec().catch((error) => {
      supportCache.delete(datasetKey);
      throw error;
    });
    supportCache.set(datasetKey, pending);
    return pending;
  };

  return {
    listItemEvidence: (datasetKey, anchorProductIds) => {
      const anchors = normalizeAnchors(anchorProductIds);
      if (!datasetKey || anchors.length === 0) return Promise.resolve({ supports: [], pairs: [] });
      return run(async () => {
        const supportsPromise = positiveSupports(datasetKey);
        const anchorRows = await model.find({
          datasetKey,
          split: { $in: LIVE_COLLABORATIVE_SPLITS },
          rating: { $gte: POSITIVE_RATING_THRESHOLD },
          productPublicId: { $in: anchors },
        }).select("+userKey productPublicId").lean().exec();
        if (anchorRows.length === 0) return { supports: await supportsPromise, pairs: [] };

        const anchorsByUser = new Map();
        for (const row of anchorRows) {
          if (!anchorsByUser.has(row.userKey)) anchorsByUser.set(row.userKey, new Set());
          anchorsByUser.get(row.userKey).add(row.productPublicId);
        }
        const userKeys = [...anchorsByUser.keys()];
        const neighborRows = await model.find({
          datasetKey,
          split: { $in: LIVE_COLLABORATIVE_SPLITS },
          rating: { $gte: POSITIVE_RATING_THRESHOLD },
          userKey: { $in: userKeys },
        }).select("+userKey productPublicId").lean().exec();

        const pairCounts = new Map();
        for (const row of neighborRows) {
          for (const sourceProductPublicId of anchorsByUser.get(row.userKey) || []) {
            if (sourceProductPublicId === row.productPublicId) continue;
            const pairKey = `${sourceProductPublicId}:${row.productPublicId}`;
            pairCounts.set(pairKey, (pairCounts.get(pairKey) || 0) + 1);
          }
        }
        const pairs = [...pairCounts]
          .map(([pairKey, coPositiveUsers]) => {
            const [sourceProductPublicId, candidateProductPublicId] = pairKey.split(":").map(Number);
            return { sourceProductPublicId, candidateProductPublicId, coPositiveUsers };
          })
          .sort((a, b) => (
            a.sourceProductPublicId - b.sourceProductPublicId
            || a.candidateProductPublicId - b.candidateProductPublicId
          ));
        return { supports: await supportsPromise, pairs };
      });
    },
  };
}

export const historicalCollaborativeRepository = createHistoricalCollaborativeRepository();
