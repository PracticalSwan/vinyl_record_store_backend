import { iterateHistoricalEvaluationSubjects } from "../lib/dataset/historicalEvaluationAdapter.js";
import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";
import { DatasetImport } from "../models/DatasetImport.js";
import { DatasetProduct } from "../models/DatasetProduct.js";
import { HistoricalAmazonRating } from "../models/HistoricalAmazonRating.js";

const ALLOWED_SPLITS = new Set(["train", "validation", "test"]);

function validateSplits(splits) {
  if (!Array.isArray(splits) || splits.length === 0) {
    throw new TypeError("Historical evaluation requires at least one allowed split.");
  }
  if (splits.some((split) => !ALLOWED_SPLITS.has(split))) {
    throw new TypeError("Historical evaluation received an unsupported split.");
  }
}

export function createHistoricalEvaluationRepository({
  datasetImportModel = DatasetImport,
  datasetProductModel = DatasetProduct,
  historicalRatingModel = HistoricalAmazonRating,
} = {}, connect = connectMongoDB) {
  const run = async (operation) => {
    try {
      await connect();
      return await operation();
    } catch (error) {
      if (error?.code === "PERSISTENCE_UNAVAILABLE") throw error;
      throw persistenceUnavailable();
    }
  };

  const activeProjection = {
    datasetKey: 1,
    counts: 1,
    source: 1,
    sourceVersion: 1,
    productCollection: 1,
    configDigest: 1,
    identityRegistryDigest: 1,
    sealedAt: 1,
  };

  const getActiveDataset = () => run(() => datasetImportModel.findOne(
    { active: true, status: "active" },
    activeProjection,
  ).lean().exec());

  return {
    async getActiveDataset() {
      return getActiveDataset();
    },

    async readProducts(datasetKey) {
      return run(() => datasetProductModel.find(
      { datasetKey, deletedAt: null },
      {
        datasetKey: 1,
        publicId: 1,
        title: 1,
        artist: 1,
        genre: 1,
        year: 1,
        originalReleaseYear: 1,
        label: 1,
        stock: 1,
      },
    )
      .sort({ publicId: 1 })
      .lean()
      .exec()
      .then((products) => products.map((product) => ({
        datasetKey: product.datasetKey,
        id: product.publicId,
        title: product.title,
        artist: product.artist,
        genre: product.genre,
        year: product.originalReleaseYear ?? product.year,
        label: product.label,
        stock: product.stock,
      }))));
    },

    async readSubjects(datasetKey, { splits = ["train", "validation"] } = {}) {
      validateSplits(splits);
      return run(async () => {
        const cursor = historicalRatingModel.find(
      { datasetKey, split: { $in: splits } },
      {
        datasetKey: 1,
        userKey: 1,
        productPublicId: 1,
        rating: 1,
        occurredAt: 1,
        split: 1,
      },
    )
      .select("+userKey")
      .sort({ userKey: 1, occurredAt: 1, productPublicId: 1 })
      .lean()
      .cursor({ batchSize: 1_000 });
        const subjects = [];
        for await (const subject of iterateHistoricalEvaluationSubjects(cursor, { datasetKey })) {
          subjects.push(subject);
        }
        return subjects;
      });
    },

    async assertReleaseStillActive(expected) {
      const current = await getActiveDataset();
      const fields = [
        "datasetKey",
        "sourceVersion",
        "productCollection",
        "configDigest",
        "identityRegistryDigest",
        "sealedAt",
      ];
      const countFields = ["products", "users", "ratings"];
      if (
        !current
        || fields.some((field) => String(current[field] ?? "") !== String(expected[field] ?? ""))
        || countFields.some((field) => current.counts?.[field] !== expected.counts?.[field])
      ) {
        throw new Error("The active historical dataset changed during evaluation.");
      }
      return current;
    },
  };
}

export const historicalEvaluationRepository = createHistoricalEvaluationRepository();
