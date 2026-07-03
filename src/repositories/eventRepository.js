import { AuditLog } from "../models/AuditLog.js";
import { Interaction } from "../models/Interaction.js";
import { RecommendationLog } from "../models/RecommendationLog.js";
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
    appendRecommendationLog: (data) => run(async () => clean(
      await recommendationLogModel.create(data),
    )),
    appendAuditLog: (data) => run(async () => clean(await auditLogModel.create(data))),
  };
}

export const eventRepository = createEventRepository();
