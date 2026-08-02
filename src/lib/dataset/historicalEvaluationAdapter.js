export const HISTORICAL_POSITIVE_RATING = 4;

const SPLITS = ["train", "validation", "test"];

function asTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) throw new Error("Historical rating has an invalid timestamp.");
  return time;
}

function validateRow(row, expectedDatasetKey) {
  if (!row || row.datasetKey !== expectedDatasetKey) {
    throw new Error("Historical evaluation rows must belong to one pinned dataset version.");
  }
  if (!/^[0-9a-f]{64}$/.test(row.userKey || "")) {
    throw new Error("Historical evaluation row has an invalid pseudonymous user key.");
  }
  if (!Number.isInteger(row.productPublicId) || row.productPublicId < 1) {
    throw new Error("Historical evaluation row has an invalid product ID.");
  }
  if (!Number.isFinite(row.rating) || row.rating < 1 || row.rating > 5) {
    throw new Error("Historical evaluation row has an invalid rating.");
  }
  if (!SPLITS.includes(row.split)) throw new Error("Historical evaluation row has an invalid split.");
  asTime(row.occurredAt);
}

export function buildHistoricalEvaluationSubject(userKey, rows, {
  positiveThreshold = HISTORICAL_POSITIVE_RATING,
  minimumTrainingRatings = 3,
} = {}) {
  if (!rows.length) throw new Error("Historical evaluation subject requires at least one row.");
  const datasetKey = rows[0].datasetKey;
  const ordered = [...rows].sort((left, right) => (
    asTime(left.occurredAt) - asTime(right.occurredAt)
    || left.productPublicId - right.productPublicId
  ));
  const seenProducts = new Set();
  let highestSplit = -1;
  for (const row of ordered) {
    validateRow(row, datasetKey);
    if (row.userKey !== userKey) throw new Error("Historical evaluation subject mixes user keys.");
    if (seenProducts.has(row.productPublicId)) {
      throw new Error("Historical evaluation subject contains a duplicate user-item pair.");
    }
    seenProducts.add(row.productPublicId);
    const splitIndex = SPLITS.indexOf(row.split);
    if (splitIndex < highestSplit) throw new Error("Historical evaluation splits violate chronology.");
    highestSplit = splitIndex;
  }

  const mapRows = (split) => ordered
    .filter((row) => row.split === split)
    .map((row) => ({
      productId: row.productPublicId,
      rating: row.rating,
      occurredAt: new Date(row.occurredAt).toISOString(),
    }));
  const training = mapRows("train");
  const validation = mapRows("validation");
  const test = mapRows("test");
  const relevant = (values) => values
    .filter((row) => row.rating >= positiveThreshold)
    .map((row) => row.productId);

  return {
    datasetKey,
    subjectKey: userKey,
    training,
    validation,
    test,
    validationRelevantProductIds: relevant(validation),
    testRelevantProductIds: relevant(test),
    eligible: training.length >= minimumTrainingRatings && relevant(test).length > 0,
  };
}

export async function* iterateHistoricalEvaluationSubjects(rows, options = {}) {
  let currentUserKey = null;
  let currentRows = [];
  let datasetKey = options.datasetKey || null;
  for await (const row of rows) {
    datasetKey ||= row.datasetKey;
    validateRow(row, datasetKey);
    if (currentUserKey !== null && row.userKey !== currentUserKey) {
      yield buildHistoricalEvaluationSubject(currentUserKey, currentRows, options);
      currentRows = [];
    }
    currentUserKey = row.userKey;
    currentRows.push(row);
  }
  if (currentRows.length) yield buildHistoricalEvaluationSubject(currentUserKey, currentRows, options);
}

export async function summarizeHistoricalEvaluationReadiness(rows, {
  datasetKey,
  minimumEligibleSubjects = 20,
  ...subjectOptions
} = {}) {
  if (!datasetKey) throw new Error("Historical readiness requires a pinned dataset key.");
  const candidateProductIds = new Set();
  const splitCounts = { train: 0, validation: 0, test: 0 };
  const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let subjects = 0;
  let eligibleSubjects = 0;
  let testPositiveItems = 0;

  for await (const subject of iterateHistoricalEvaluationSubjects(rows, {
    ...subjectOptions,
    datasetKey,
  })) {
    subjects += 1;
    if (subject.eligible) eligibleSubjects += 1;
    testPositiveItems += subject.testRelevantProductIds.length;
    for (const [split, values] of [
      ["train", subject.training],
      ["validation", subject.validation],
      ["test", subject.test],
    ]) {
      splitCounts[split] += values.length;
      for (const row of values) {
        candidateProductIds.add(row.productId);
        ratingDistribution[row.rating] += 1;
      }
    }
  }

  return {
    schemaVersion: 1,
    evidenceSource: "historical-amazon-ratings",
    datasetKey,
    status: eligibleSubjects >= minimumEligibleSubjects ? "ready" : "insufficient-evidence",
    positiveRatingThreshold: subjectOptions.positiveThreshold || HISTORICAL_POSITIVE_RATING,
    minimumEligibleSubjects,
    subjects,
    eligibleSubjects,
    candidateProducts: candidateProductIds.size,
    ratings: splitCounts.train + splitCounts.validation + splitCounts.test,
    splitCounts,
    ratingDistribution,
    testPositiveItems,
    aggregateOnly: true,
  };
}
