import { writeFile } from "node:fs/promises";
import { createImplementationDigest } from "./historicalOfflineEvaluation.js";

export const HISTORICAL_MF_IMPLEMENTATION_FILES = Object.freeze([
  "scripts/run-historical-mf-experiment.mjs",
  "src/lib/dataset/historicalEvaluationAdapter.js",
  "src/lib/recommender/biasedMatrixFactorization.js",
  "src/lib/recommender/contentBased.js",
  "src/lib/recommender/evaluate.js",
  "src/lib/recommender/historicalMatrixFactorizationAuthorization.js",
  "src/lib/recommender/historicalMatrixFactorizationEvaluation.js",
  "src/lib/recommender/historicalOfflineEvaluation.js",
  "src/repositories/historicalEvaluationRepository.js",
]);

export function createHistoricalMfImplementationDescriptor(sourceByName) {
  const sources = Object.fromEntries(HISTORICAL_MF_IMPLEMENTATION_FILES.map((filename) => {
    const source = sourceByName?.[filename];
    if (typeof source !== "string" || source.length === 0) {
      throw new Error(`Missing test-critical implementation source: ${filename}.`);
    }
    return [filename, source];
  }));
  return {
    files: [...HISTORICAL_MF_IMPLEMENTATION_FILES],
    digest: createImplementationDigest(sources),
  };
}

export function historicalMfGridFromContract(contract) {
  const configurations = [];
  for (const factors of contract?.validationGrid?.factors || []) {
    for (const learningRate of contract.validationGrid.learningRate || []) {
      for (const regularization of contract.validationGrid.regularization || []) {
        for (const epochs of contract.validationGrid.epochs || []) {
          configurations.push({ factors, learningRate, regularization, epochs });
        }
      }
    }
  }
  if (configurations.length !== contract?.validationGrid?.configurationCount) {
    throw new Error("The frozen matrix-factorization grid size is inconsistent.");
  }
  return configurations;
}

export async function claimHistoricalFinalTestAttempt(filename, claim, write = writeFile) {
  await write(filename, `${JSON.stringify(claim, null, 2)}\n`, {
    encoding: "utf8",
    flag: "wx",
  });
  return claim;
}
