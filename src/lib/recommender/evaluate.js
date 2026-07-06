function hits(relevant, recommended, k) {
  let count = 0;
  for (let index = 0; index < Math.min(k, recommended.length); index += 1) {
    if (relevant.has(recommended[index])) count += 1;
  }
  return count;
}

function validK(k) {
  if (!Number.isInteger(k) || k < 1) throw new TypeError("k must be a positive integer.");
  return k;
}

export const precisionAtK = (relevant, recommended, k) =>
  hits(relevant, recommended, validK(k)) / k;

export const recallAtK = (relevant, recommended, k) => {
  validK(k);
  return relevant.size ? hits(relevant, recommended, k) / relevant.size : 0;
};

export const hitRateAtK = (relevant, recommended, k) =>
  hits(relevant, recommended, validK(k)) > 0 ? 1 : 0;

export function averagePrecisionAtK(relevant, recommended, k) {
  validK(k);
  let sum = 0;
  let hitCount = 0;
  for (let index = 0; index < Math.min(k, recommended.length); index += 1) {
    if (relevant.has(recommended[index])) {
      hitCount += 1;
      sum += hitCount / (index + 1);
    }
  }
  return sum / Math.min(k, relevant.size || 1);
}

export function ndcgAtK(relevant, recommended, k) {
  validK(k);
  let dcg = 0;
  for (let index = 0; index < Math.min(k, recommended.length); index += 1) {
    if (relevant.has(recommended[index])) dcg += 1 / Math.log2(index + 2);
  }
  const idealCount = Math.min(k, relevant.size);
  const idcg = Array.from({ length: idealCount }).reduce(
    (sum, _item, index) => sum + 1 / Math.log2(index + 2),
    0,
  );
  return idcg ? dcg / idcg : 0;
}

export const meanOverUsers = (perUser) =>
  perUser.length ? perUser.reduce((sum, value) => sum + value, 0) / perUser.length : 0;

export const catalogCoverage = (allRecommendations, itemUniverse) => {
  const surfaced = new Set(allRecommendations.flat());
  return itemUniverse.size ? surfaced.size / itemUniverse.size : 0;
};

export function reciprocalRankAtK(relevant, recommended, k) {
  validK(k);
  for (let index = 0; index < Math.min(k, recommended.length); index += 1) {
    if (relevant.has(recommended[index])) return 1 / (index + 1);
  }
  return 0;
}

export function noveltyAtK(recommended, k, popularityByItem, subjectCount) {
  validK(k);
  if (!Number.isInteger(subjectCount) || subjectCount < 1) return 0;
  const items = recommended.slice(0, k);
  if (items.length === 0) return 0;
  return items.reduce((sum, itemId) => {
    const subjects = popularityByItem.get(itemId) || 0;
    const probability = subjects > 0 ? subjects / subjectCount : 1 / (subjectCount + 1);
    return sum - Math.log2(probability);
  }, 0) / items.length;
}

export function personalization(allRecommendations, k) {
  validK(k);
  if (allRecommendations.length < 2) return 0;
  let similarity = 0;
  let pairs = 0;
  for (let left = 0; left < allRecommendations.length; left += 1) {
    const leftItems = new Set(allRecommendations[left].slice(0, k));
    for (let right = left + 1; right < allRecommendations.length; right += 1) {
      const rightItems = new Set(allRecommendations[right].slice(0, k));
      const intersection = [...leftItems].filter((item) => rightItems.has(item)).length;
      const denominator = Math.sqrt(leftItems.size * rightItems.size);
      similarity += denominator ? intersection / denominator : 0;
      pairs += 1;
    }
  }
  return pairs ? 1 - similarity / pairs : 0;
}
