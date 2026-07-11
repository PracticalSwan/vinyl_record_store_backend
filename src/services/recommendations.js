import { randomUUID } from "node:crypto";
import { getCatalogDataSource } from "../lib/db/dataSource.js";
import {
  recommendForProduct,
  recommendForUser,
} from "../lib/recommender/contentBased.js";
import { eventRepository } from "../repositories/eventRepository.js";

function recommendationItems(recommendations) {
  return recommendations.map((item) => ({
    productPublicId: item.product.id,
    score: item.score,
    rank: item.rank,
    reasons: item.reasons || [],
  }));
}

async function record(result, context, {
  events = eventRepository,
  environment = process.env,
} = {}) {
  const requestId = randomUUID();
  const listId = `${requestId}:primary`;
  const shouldLog = context.trackingAllowed !== false
    && getCatalogDataSource(environment) === "mongodb";
  if (shouldLog) {
    await events.appendRecommendationLog({
      requestId,
      listId,
      subjectType: context.subjectType,
      subjectId: context.subjectId || requestId,
      mode: result.mode,
      algorithmVersion: result.algorithmVersion,
      sourceProductId: context.sourceProductId ?? null,
      excludedProductIds: result.excludedProductIds || [],
      surface: context.surface,
      items: recommendationItems(result.recommendations),
    });
  }
  const { excludedProductIds: _excludedProductIds, ...publicResult } = result;
  return {
    ...publicResult,
    requestId,
    listId,
    recommendationLogged: shouldLog,
  };
}

export async function serveUserRecommendations(subject, limit, context, options = {}) {
  const actor = context?.actor;
  if (
    !["anonymous", "registered"].includes(actor?.kind)
    || (actor.kind === "registered" && !actor.publicId)
  ) {
    throw new TypeError("A verified recommendation actor is required.");
  }
  const result = await recommendForUser(subject, limit, options);
  return record(result, {
    subjectType: actor.kind === "registered" ? "user" : "anonymous",
    subjectId: actor.kind === "registered" ? actor.publicId : context.anonymousId || null,
    surface: context.surface,
    trackingAllowed: context.trackingAllowed,
  }, options);
}

export async function serveProductRecommendations(sourceId, limit, context, options = {}) {
  const result = await recommendForProduct(sourceId, limit, options);
  return record(result, {
    subjectType: "product",
    subjectId: String(result.sourceProductId),
    sourceProductId: result.sourceProductId,
    surface: context.surface,
    trackingAllowed: context.trackingAllowed,
  }, options);
}
