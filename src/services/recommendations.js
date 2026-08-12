import { randomUUID } from "node:crypto";
import { getCatalogDataSource, getCatalogRepository } from "../lib/db/dataSource.js";
import { forbidden } from "../lib/errors.js";
import {
  recommendForProduct,
  recommendForUser,
  prepareUserRecommendation,
} from "../lib/recommender/contentBased.js";
import {
  personalizationBehavioralRankingEnabled,
  personalizationHybridEnabled,
  personalizationNegativeFeedbackEnabled,
  personalizationPopularityEnabled,
  personalizationPreferenceRankingEnabled,
  personalizationProfileDomainEnabled,
} from "../lib/features.js";
import { eventRepository } from "../repositories/eventRepository.js";
import { historicalPopularityRepository } from "../repositories/historicalPopularityRepository.js";
import { getProductRecord } from "./catalog.js";
import { buildUserRecommendationProfile } from "./recommendationProfile.js";

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
    const stored = await events.appendRecommendationLog({
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
    if (context.subjectType === "user" && stored === null) {
      throw forbidden("The recommendation account is no longer active.");
    }
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
  if (
    subject.kind === "registered"
    && (actor.kind !== "registered" || actor.publicId !== subject.publicId)
  ) {
    throw forbidden("The recommendation subject does not belong to the active session.");
  }
  const environment = options.environment || process.env;
  const profileEnabled = personalizationProfileDomainEnabled(environment);
  const preferenceRankingEnabled = profileEnabled
    && personalizationPreferenceRankingEnabled(environment);
  const feedbackEnabled = profileEnabled
    && personalizationNegativeFeedbackEnabled(environment);
  const behaviorRankingEnabled = profileEnabled
    && personalizationBehavioralRankingEnabled(environment);
  const popularityEnabled = personalizationPopularityEnabled(environment);
  const hybridEnabled = preferenceRankingEnabled
    && behaviorRankingEnabled
    && personalizationHybridEnabled(environment);
  const profile = options.profile || (
    subject.kind === "registered" && (preferenceRankingEnabled || feedbackEnabled || behaviorRankingEnabled)
      ? await buildUserRecommendationProfile(subject, {
          trackingAllowed: context.trackingAllowed !== false,
          feedbackAllowed: feedbackEnabled,
          users: options.users,
          state: options.state,
          feedback: options.feedback,
        })
      : null
  );
  const repository = options.repository || getCatalogRepository(environment);
  const candidates = options.candidates || await repository.listRecommendationCandidates();
  const now = options.now || new Date();
  const prepared = prepareUserRecommendation(subject, candidates, {
    profile,
    preferenceRankingEnabled,
    feedbackEnabled,
    behaviorRankingEnabled,
    popularityEnabled,
    hybridEnabled,
    trackingEnabled: context.trackingAllowed !== false,
    now,
  });
  const popularityRepository = options.popularityRepository || historicalPopularityRepository;
  const popularityAggregates = prepared.popularityNeeded && prepared.datasetKey
    ? await popularityRepository.listByDatasetKey(prepared.datasetKey)
    : [];
  const result = await recommendForUser(subject, limit, {
    ...options,
    candidates,
    prepared,
    profile,
    popularityAggregates,
    preferenceRankingEnabled,
    feedbackEnabled,
    behaviorRankingEnabled,
    popularityEnabled,
    hybridEnabled,
    trackingEnabled: context.trackingAllowed !== false,
    now,
  });
  return record(result, {
    subjectType: actor.kind === "registered" ? "user" : "anonymous",
    subjectId: actor.kind === "registered" ? actor.publicId : context.anonymousId || null,
    surface: context.surface,
    trackingAllowed: context.trackingAllowed,
  }, options);
}

export async function serveProductRecommendations(sourceId, limit, context, options = {}) {
  const environment = options.environment || process.env;
  const repository = options.repository || getCatalogRepository(environment);
  const [source, candidates] = await Promise.all([
    getProductRecord(sourceId, { repository }),
    repository.listRecommendationCandidates(),
  ]);
  const result = await recommendForProduct(source.id, limit, {
    ...options,
    source,
    candidates,
  });
  return record(result, {
    subjectType: "product",
    subjectId: String(result.sourceProductId),
    sourceProductId: result.sourceProductId,
    surface: context.surface,
    trackingAllowed: context.trackingAllowed,
  }, options);
}
