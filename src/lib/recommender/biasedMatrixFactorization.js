import { createHash } from "node:crypto";

export const BIASED_MATRIX_FACTORIZATION_VERSION = "biased-matrix-factorization-v1";
export const BIASED_MATRIX_FACTORIZATION_SEED = "groovehaus-biased-mf-v1";

const compareStrings = (left, right) => (left < right ? -1 : left > right ? 1 : 0);

function seedNumber(value) {
  return createHash("sha256").update(value).digest().readUInt32LE(0);
}

function mulberry32(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function assertFinite(value, message) {
  if (!Number.isFinite(value)) throw new Error(message);
  return value;
}

export function canonicalMatrixFactorizationConfiguration(configuration) {
  const normalized = {
    factors: configuration?.factors,
    learningRate: configuration?.learningRate,
    regularization: configuration?.regularization,
    epochs: configuration?.epochs,
  };
  if (!Number.isInteger(normalized.factors) || normalized.factors < 1 || normalized.factors > 128) {
    throw new TypeError("Matrix-factorization factors must be an integer from 1 through 128.");
  }
  if (!Number.isFinite(normalized.learningRate) || normalized.learningRate <= 0 || normalized.learningRate > 1) {
    throw new TypeError("Matrix-factorization learning rate must be in (0, 1].");
  }
  if (!Number.isFinite(normalized.regularization) || normalized.regularization < 0 || normalized.regularization > 1) {
    throw new TypeError("Matrix-factorization regularization must be in [0, 1].");
  }
  if (!Number.isInteger(normalized.epochs) || normalized.epochs < 1 || normalized.epochs > 1_000) {
    throw new TypeError("Matrix-factorization epochs must be an integer from 1 through 1000.");
  }
  return normalized;
}

export function matrixFactorizationConfigurationId(configuration) {
  const value = canonicalMatrixFactorizationConfiguration(configuration);
  return `factors=${value.factors};learningRate=${value.learningRate};regularization=${value.regularization};epochs=${value.epochs}`;
}

function canonicalObservations(observations) {
  if (!Array.isArray(observations) || observations.length === 0) {
    throw new TypeError("Biased matrix factorization requires observed ratings.");
  }
  const rows = observations.map((observation) => {
    if (typeof observation?.subjectKey !== "string" || observation.subjectKey.length === 0) {
      throw new TypeError("A matrix-factorization observation has an invalid subject key.");
    }
    if (!Number.isInteger(observation.productId) || observation.productId < 1) {
      throw new TypeError("A matrix-factorization observation has an invalid product ID.");
    }
    if (!Number.isFinite(observation.rating) || observation.rating < 1 || observation.rating > 5) {
      throw new TypeError("A matrix-factorization observation has an invalid rating.");
    }
    return {
      subjectKey: observation.subjectKey,
      productId: observation.productId,
      rating: observation.rating,
    };
  }).sort((left, right) => (
    compareStrings(left.subjectKey, right.subjectKey)
    || left.productId - right.productId
  ));
  const pairs = new Set();
  for (const row of rows) {
    const pair = `${row.subjectKey}\0${row.productId}`;
    if (pairs.has(pair)) throw new Error("Biased matrix factorization received a duplicate user-item pair.");
    pairs.add(pair);
  }
  return rows;
}

function shuffledIndexes(length, seed) {
  const indexes = Array.from({ length }, (_value, index) => index);
  const random = mulberry32(seedNumber(seed));
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const target = Math.floor(random() * (index + 1));
    [indexes[index], indexes[target]] = [indexes[target], indexes[index]];
  }
  return indexes;
}

export function trainBiasedMatrixFactorization({
  observations,
  configuration,
  seed = BIASED_MATRIX_FACTORIZATION_SEED,
  onResourceSample = () => {},
  assertWithinResourceGuard = () => {},
} = {}) {
  const config = canonicalMatrixFactorizationConfiguration(configuration);
  const configurationId = matrixFactorizationConfigurationId(config);
  const rows = canonicalObservations(observations);
  const subjectKeys = [...new Set(rows.map((row) => row.subjectKey))].sort(compareStrings);
  const itemIds = [...new Set(rows.map((row) => row.productId))].sort((left, right) => left - right);
  const userIndexes = new Map(subjectKeys.map((key, index) => [key, index]));
  const itemIndexes = new Map(itemIds.map((id, index) => [id, index]));
  const indexedRows = rows.map((row) => ({
    userIndex: userIndexes.get(row.subjectKey),
    itemIndex: itemIndexes.get(row.productId),
    rating: row.rating,
  }));
  const globalMean = assertFinite(
    rows.reduce((sum, row) => sum + row.rating, 0) / rows.length,
    "Biased matrix factorization produced a non-finite global mean.",
  );
  const userBiases = new Float64Array(subjectKeys.length);
  const itemBiases = new Float64Array(itemIds.length);
  const userFactors = new Float64Array(subjectKeys.length * config.factors);
  const itemFactors = new Float64Array(itemIds.length * config.factors);
  const initializer = mulberry32(seedNumber(seed));
  for (let index = 0; index < userFactors.length; index += 1) {
    userFactors[index] = initializer() * 0.02 - 0.01;
  }
  for (let index = 0; index < itemFactors.length; index += 1) {
    itemFactors[index] = initializer() * 0.02 - 0.01;
  }

  const predictIndexes = (userIndex, itemIndex) => {
    let prediction = globalMean + userBiases[userIndex] + itemBiases[itemIndex];
    const userOffset = userIndex * config.factors;
    const itemOffset = itemIndex * config.factors;
    for (let factor = 0; factor < config.factors; factor += 1) {
      prediction += userFactors[userOffset + factor] * itemFactors[itemOffset + factor];
    }
    return assertFinite(prediction, "Biased matrix factorization produced a non-finite prediction.");
  };

  onResourceSample({ phase: "initialized", configurationId });
  assertWithinResourceGuard({ phase: "initialized", configurationId });
  for (let epoch = 1; epoch <= config.epochs; epoch += 1) {
    const order = shuffledIndexes(
      indexedRows.length,
      `${seed}:${configurationId}:${epoch}`,
    );
    for (const rowIndex of order) {
      const row = indexedRows[rowIndex];
      const prediction = predictIndexes(row.userIndex, row.itemIndex);
      const residual = assertFinite(
        row.rating - prediction,
        "Biased matrix factorization produced a non-finite residual.",
      );
      const userBiasBefore = userBiases[row.userIndex];
      const itemBiasBefore = itemBiases[row.itemIndex];
      userBiases[row.userIndex] = assertFinite(
        userBiasBefore + config.learningRate * (
          residual - config.regularization * userBiasBefore
        ),
        "Biased matrix factorization produced a non-finite user bias.",
      );
      itemBiases[row.itemIndex] = assertFinite(
        itemBiasBefore + config.learningRate * (
          residual - config.regularization * itemBiasBefore
        ),
        "Biased matrix factorization produced a non-finite item bias.",
      );
      const userOffset = row.userIndex * config.factors;
      const itemOffset = row.itemIndex * config.factors;
      for (let factor = 0; factor < config.factors; factor += 1) {
        const userFactorBefore = userFactors[userOffset + factor];
        const itemFactorBefore = itemFactors[itemOffset + factor];
        userFactors[userOffset + factor] = assertFinite(
          userFactorBefore + config.learningRate * (
            residual * itemFactorBefore - config.regularization * userFactorBefore
          ),
          "Biased matrix factorization produced a non-finite user factor.",
        );
        itemFactors[itemOffset + factor] = assertFinite(
          itemFactorBefore + config.learningRate * (
            residual * userFactorBefore - config.regularization * itemFactorBefore
          ),
          "Biased matrix factorization produced a non-finite item factor.",
        );
      }
    }
    onResourceSample({ phase: "epoch", configurationId, epoch });
    assertWithinResourceGuard({ phase: "epoch", configurationId, epoch });
  }

  let squaredError = 0;
  for (const row of indexedRows) {
    const residual = row.rating - predictIndexes(row.userIndex, row.itemIndex);
    squaredError += residual * residual;
  }
  const trainingRmse = assertFinite(
    Math.sqrt(squaredError / indexedRows.length),
    "Biased matrix factorization produced a non-finite training RMSE.",
  );
  onResourceSample({ phase: "trained", configurationId });
  assertWithinResourceGuard({ phase: "trained", configurationId });

  return Object.freeze({
    algorithmVersion: BIASED_MATRIX_FACTORIZATION_VERSION,
    configuration: config,
    configurationId,
    globalMean,
    trainingRmse,
    ratingCount: rows.length,
    userCount: subjectKeys.length,
    itemCount: itemIds.length,
    hasUser: (subjectKey) => userIndexes.has(subjectKey),
    hasItem: (productId) => itemIndexes.has(productId),
    predict(subjectKey, productId) {
      const userIndex = userIndexes.get(subjectKey);
      const itemIndex = itemIndexes.get(productId);
      let prediction = globalMean;
      if (userIndex !== undefined) prediction += userBiases[userIndex];
      if (itemIndex !== undefined) prediction += itemBiases[itemIndex];
      if (userIndex !== undefined && itemIndex !== undefined) {
        const userOffset = userIndex * config.factors;
        const itemOffset = itemIndex * config.factors;
        for (let factor = 0; factor < config.factors; factor += 1) {
          prediction += userFactors[userOffset + factor] * itemFactors[itemOffset + factor];
        }
      }
      return assertFinite(prediction, "Biased matrix factorization produced a non-finite prediction.");
    },
  });
}
