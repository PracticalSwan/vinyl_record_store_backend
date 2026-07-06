import { createHmac } from "node:crypto";
import { connectMongoDB } from "../lib/db/mongodb.js";
import { Interaction } from "../models/Interaction.js";
import { RecommendationLog } from "../models/RecommendationLog.js";
import { VinylRecord } from "../models/VinylRecord.js";
import { toPublicProduct } from "./catalogMapping.js";
import { createMongoRunner } from "./repositorySupport.js";

const pseudonym = (type, value, salt) => createHmac("sha256", salt)
  .update(`${type}:${value}`)
  .digest("hex");

const isCaptured = (value) => value !== null && value !== undefined && value !== "";

function fieldCoverage(rows, fields) {
  return fields.map(({ field, value }) => {
    const present = rows.reduce((count, row) => count + (isCaptured(value(row)) ? 1 : 0), 0);
    return {
      field,
      present,
      total: rows.length,
      rate: rows.length ? Number((present / rows.length).toFixed(4)) : 0,
    };
  });
}

export function createEvaluationRepository({
  interactionModel = Interaction,
  recommendationLogModel = RecommendationLog,
  productModel = VinylRecord,
} = {}, connect = connectMongoDB) {
  const run = createMongoRunner(connect);
  return {
    readInputs: ({ from, to, pseudonymSalt }) => run(async () => {
      if (!pseudonymSalt) throw new Error("A per-run pseudonym salt is required.");
      const range = { $gte: from, $lte: to };
      const [interactionRows, recommendationRows, productRows] = await Promise.all([
        interactionModel.find({ occurredAt: range })
          .select("+anonymousId")
          .sort({ occurredAt: 1, eventId: 1 })
          .lean()
          .exec(),
        recommendationLogModel.find({ servedAt: range })
          .select({
            requestId: 1,
            listId: 1,
            algorithmVersion: 1,
            mode: 1,
            sourceProductId: 1,
            excludedProductIds: 1,
            surface: 1,
            items: 1,
            servedAt: 1,
          })
          .sort({ servedAt: 1 })
          .lean()
          .exec(),
        productModel.find({ deletedAt: null })
          .sort({ publicId: 1 })
          .lean()
          .exec(),
      ]);

      const interactions = interactionRows.flatMap((row) => {
        const rawSubject = row.userPublicId || row.anonymousId;
        if (!rawSubject) return [];
        return [{
          eventId: row.eventId,
          subjectId: pseudonym(row.userPublicId ? "user" : "anonymous", rawSubject, pseudonymSalt),
          type: row.type,
          productPublicId: row.productPublicId,
          value: row.value,
          occurredAt: row.occurredAt,
        }];
      });
      const versions = new Map();
      for (const row of recommendationRows) {
        const key = `${row.algorithmVersion}:${row.mode}`;
        versions.set(key, (versions.get(key) || 0) + 1);
      }
      return {
        interactions,
        products: productRows.map(toPublicProduct),
        capturedFieldCoverage: {
          interactions: fieldCoverage(interactionRows, [
            { field: "event ID", value: (row) => row.eventId },
            { field: "subject", value: (row) => row.userPublicId || row.anonymousId },
            { field: "type", value: (row) => row.type },
            { field: "product public ID", value: (row) => row.productPublicId },
            { field: "value", value: (row) => row.value },
            { field: "source", value: (row) => row.source },
            { field: "surface", value: (row) => row.surface },
            { field: "recommendation request ID", value: (row) => row.recommendationContext?.requestId },
            { field: "recommendation rank", value: (row) => row.recommendationContext?.rank },
            { field: "occurred at", value: (row) => row.occurredAt },
          ]),
          recommendationLogs: fieldCoverage(recommendationRows, [
            { field: "request ID", value: (row) => row.requestId },
            { field: "list ID", value: (row) => row.listId },
            { field: "algorithm version", value: (row) => row.algorithmVersion },
            { field: "mode", value: (row) => row.mode },
            { field: "surface", value: (row) => row.surface },
            { field: "items", value: (row) => row.items },
            { field: "served at", value: (row) => row.servedAt },
          ]),
        },
        recommendationVersions: [...versions.entries()].map(([key, requests]) => {
          const separator = key.lastIndexOf(":");
          return {
            algorithmVersion: key.slice(0, separator),
            mode: key.slice(separator + 1),
            requests,
          };
        }),
      };
    }),
  };
}

export const evaluationRepository = createEvaluationRepository();
