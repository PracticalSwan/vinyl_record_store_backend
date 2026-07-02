function hits(relevant, recommended, k) {
  let count = 0;
  for (let index = 0; index < Math.min(k, recommended.length); index += 1) {
    if (relevant.has(recommended[index])) count += 1;
  }
  return count;
}

export const precisionAtK = (relevant, recommended, k) =>
  hits(relevant, recommended, k) / k;

export const recallAtK = (relevant, recommended, k) =>
  relevant.size ? hits(relevant, recommended, k) / relevant.size : 0;

export const hitRateAtK = (relevant, recommended, k) =>
  hits(relevant, recommended, k) > 0 ? 1 : 0;

export function averagePrecisionAtK(relevant, recommended, k) {
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
