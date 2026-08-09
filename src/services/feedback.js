import { forbidden, notFound } from "../lib/errors.js";
import { getCatalogRepository } from "../lib/db/dataSource.js";
import { FEEDBACK_KINDS } from "../models/constants.js";
import { feedbackRepository } from "../repositories/feedbackRepository.js";

function assertCustomer(user) {
  if (!user || user.role !== "customer" || !user.publicId) {
    throw forbidden("Customer feedback is not available for this account.");
  }
}

export async function putFeedback(user, productPublicId, kind, {
  repository = feedbackRepository,
  catalog = getCatalogRepository(),
} = {}) {
  assertCustomer(user);
  if (!FEEDBACK_KINDS.includes(kind)) throw new TypeError("A valid feedback kind is required.");
  const existing = typeof repository.findByUserAndProduct === "function"
    ? await repository.findByUserAndProduct(user.publicId, productPublicId)
    : null;
  if (!existing && !(await catalog.findByPublicId(productPublicId))) {
    throw notFound(`Product ${productPublicId} was not found.`);
  }
  await repository.upsert(user.publicId, productPublicId, kind);
  return { productPublicId, kind };
}

export async function deleteFeedback(user, productPublicId, {
  repository = feedbackRepository,
} = {}) {
  assertCustomer(user);
  const removed = await repository.remove(user.publicId, productPublicId);
  return { productPublicId, removed: Boolean(removed) };
}

export async function listFeedback(user, { repository = feedbackRepository } = {}) {
  assertCustomer(user);
  return repository.listByUser(user.publicId);
}
