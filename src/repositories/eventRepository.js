import { AuditLog } from "../models/AuditLog.js";
import { Interaction } from "../models/Interaction.js";
import { RecommendationLog } from "../models/RecommendationLog.js";
import { RETENTION_MS } from "../models/constants.js";
import { createMongoRunner, toPlainObject } from "./repositorySupport.js";

const clean = (document) => {
  const value = toPlainObject(document);
  if (!value) return null;
  const { _id, anonymousId, sessionId, subjectId, adminUserPublicId, ...result } = value;
  return result;
};

export function createEventRepository(
  {
    interactionModel = Interaction,
    recommendationLogModel = RecommendationLog,
    auditLogModel = AuditLog,
  } = {},
  connect,
) {
  const run = createMongoRunner(connect);
  return {
    appendInteraction: (data) => run(async () => clean(await interactionModel.create(data))),
    appendInteractions: (items) => run(async () => {
      const receivedAt = new Date();
      const expiresAt = new Date(receivedAt.getTime() + RETENTION_MS);
      const operations = items.map((item) => ({
        updateOne: {
          filter: { eventId: item.eventId },
          update: { $setOnInsert: { ...item, receivedAt, expiresAt } },
          upsert: true,
        },
      }));
      const result = await interactionModel.bulkWrite(operations, { ordered: false });
      const inserted = result.upsertedCount || 0;
      return { accepted: inserted, duplicates: items.length - inserted };
    }),
    appendRecommendationLog: (data) => run(async () => clean(
      await recommendationLogModel.create(data),
    )),
    appendAuditLog: (data) => run(async () => clean(await auditLogModel.create(data))),
    // Recent safe audit actions for the admin dashboard. adminUserPublicId is
    // select:false on the schema and is also stripped here; only the safe
    // action/entity/summary projection is returned.
    listRecentAuditActions: (limit = 10) => run(async () => {
      const documents = await auditLogModel
        .find({}, {
          action: 1,
          entityType: 1,
          entityPublicId: 1,
          changedFields: 1,
          summary: 1,
          createdAt: 1,
        })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return documents.map((document) => {
        const { _id, adminUserPublicId, ...safe } = toPlainObject(document);
        return safe;
      });
    }),
    deleteUserInteractions: (userPublicId, { session } = {}) => run(async () => (
      interactionModel.deleteMany({ userPublicId }, { session })
    )),
  };
}

export const eventRepository = createEventRepository();
