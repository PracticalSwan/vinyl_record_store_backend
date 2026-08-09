import { FEEDBACK_KINDS } from "../../models/constants.js";

export function applyUserExclusions(candidates, feedback = []) {
  if (!Array.isArray(candidates) || !Array.isArray(feedback)) {
    throw new TypeError("Candidates and feedback must be arrays.");
  }
  const candidateIds = new Set(candidates.map((candidate) => candidate.id));
  const suppressed = new Set();
  for (const item of feedback) {
    if (!FEEDBACK_KINDS.includes(item?.kind) || !Number.isInteger(item?.productPublicId)) {
      throw new TypeError("Feedback rows must contain a supported kind and numeric product ID.");
    }
    if (suppressed.has(item.productPublicId)) throw new TypeError("Duplicate feedback rows are not allowed.");
    suppressed.add(item.productPublicId);
  }
  const excludedProductIds = [...suppressed].filter((id) => candidateIds.has(id)).sort((a, b) => a - b);
  const excluded = new Set(excludedProductIds);
  return {
    candidates: candidates.filter((candidate) => !excluded.has(candidate.id)),
    excludedProductIds,
  };
}
