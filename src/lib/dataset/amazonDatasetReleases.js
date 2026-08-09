import { isDeepStrictEqual } from "node:util";

export const AMAZON_CURRENT_DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v3";
export const AMAZON_ROLLBACK_DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v2";
export const AMAZON_IDENTITY_BASE_DATASET_KEY = "amazon-reviews-2023-cds-vinyl-5core-v1";

const RELEASES = new Map([
  [AMAZON_CURRENT_DATASET_KEY, Object.freeze({
    role: "current",
    datasetKey: AMAZON_CURRENT_DATASET_KEY,
    sourceVersion: "2023-cds-vinyl-5core-v3",
    sourceManifestFilename: "source-manifest.json",
    transformationConfigFilename: "transformation-config.json",
    artworkEnrichmentFilename: "artwork-enrichment-v3.json",
    artifactSha256: Object.freeze({
      sourceManifest: "00aded7f613f2afa50735b47942f180a87c56f2748bef39ee95a8b13c6ff2083",
      transformationConfig: "f69f62eb01090c5ee6c89f619f9e604d56a56715b135288a486045d4606bbb4d",
      artworkEnrichment: "07196a96951548e9fe825e94bd00d8841e6d4cf152470e2455df22b609062516",
    }),
    productCollection: "datasetProducts",
    sealedEvidenceRequired: true,
  })],
  [AMAZON_ROLLBACK_DATASET_KEY, Object.freeze({
    role: "rollback",
    datasetKey: AMAZON_ROLLBACK_DATASET_KEY,
    sourceVersion: "2023-cds-vinyl-5core-v2",
    sourceManifestFilename: "source-manifest-v2.json",
    transformationConfigFilename: "transformation-config-v2.json",
    artworkEnrichmentFilename: "artwork-enrichment-v2.json",
    localArtworkEvidenceFilename: "local-artwork-evidence-v2.json",
    artifactSha256: Object.freeze({
      sourceManifest: "cde4b8e4048e8394f624f197df24d40e447ddc3c72aba738223ee9b67d8c4831",
      transformationConfig: "9859ee0db9b005eb61ef934d0d44aabf3f64f3fc314cab31f929fb974fdade48",
      artworkEnrichment: "4d00de07f7b0aff47b545bcbed0daa571cc267eaf80ce388b9e2375f5fabf40c",
      localArtworkEvidence: "e52da0b71defae49bb01e13cca7a4dc8a721ebf9e5e1b77b03b3c58b54dac139",
    }),
    productCollection: "datasetProducts",
    sealedEvidenceRequired: true,
  })],
  [AMAZON_IDENTITY_BASE_DATASET_KEY, Object.freeze({
    role: "identity-base",
    datasetKey: AMAZON_IDENTITY_BASE_DATASET_KEY,
    sourceVersion: "2023-cds-vinyl-5core-v1",
    sourceManifestFilename: null,
    transformationConfigFilename: null,
    artworkEnrichmentFilename: null,
    localArtworkEvidenceFilename: null,
    artifactSha256: null,
    productCollection: "vinylRecords",
    sealedEvidenceRequired: false,
  })],
]);

export function getAmazonDatasetRelease(datasetKey) {
  const release = RELEASES.get(datasetKey);
  if (!release) throw new Error(`Unsupported Amazon dataset release: ${datasetKey}`);
  return release;
}

export function getCurrentAmazonDatasetRelease() {
  return getAmazonDatasetRelease(AMAZON_CURRENT_DATASET_KEY);
}

export function assertAmazonReleaseArtifactDigest(release, artifactName, actualSha256) {
  const expectedSha256 = release.artifactSha256?.[artifactName];
  if (!expectedSha256) {
    throw new Error(`${release.datasetKey} does not define immutable ${artifactName} evidence.`);
  }
  if (actualSha256 !== expectedSha256) {
    throw new Error(`The ${artifactName} artifact differs from pinned immutable ${release.datasetKey} evidence.`);
  }
}

function stableStagingReport(report) {
  if (!report || typeof report !== "object") return null;
  const { generatedAt: _generatedAt, ...stable } = report;
  return stable;
}

export function assertAmazonSealedStagingReproduction(existingReport, candidateReport) {
  const existing = stableStagingReport(existingReport);
  const candidate = stableStagingReport(candidateReport);
  if (!existing || !candidate) {
    throw new Error("The sealed staging report is missing; restore the private staging evidence instead of regenerating it in place.");
  }
  if (!isDeepStrictEqual(existing, candidate)) {
    throw new Error("Refusing to rewrite sealed staging because the reproduced report differs from the published release evidence.");
  }
}

export function assertAmazonIdentityRegistryReproduction(existing, expected) {
  if (!existing) {
    throw new Error("The sealed identity registry is missing; restore the committed artifact instead of regenerating it.");
  }
  if (JSON.stringify(existing) !== JSON.stringify(expected)) {
    throw new Error("Refusing to rewrite the sealed identity registry from changed v1 staging.");
  }
}

export function assertAmazonReleaseArtifactOwnership(release, {
  sourceManifest,
  transformationConfig,
  artworkEnrichment,
  report,
} = {}) {
  for (const [label, artifact] of [
    ["source manifest", sourceManifest],
    ["transformation config", transformationConfig],
    ["artwork enrichment", artworkEnrichment],
    ["staging report", report],
  ]) {
    if (artifact && artifact.datasetKey !== release.datasetKey) {
      throw new Error(`The ${label} does not belong to ${release.datasetKey}.`);
    }
  }
  if (sourceManifest?.previousDatasetKey !== undefined
    && sourceManifest.previousDatasetKey !== AMAZON_IDENTITY_BASE_DATASET_KEY) {
    throw new Error("The source manifest identity-base dataset is invalid.");
  }
  if (transformationConfig?.previousDatasetKey !== undefined
    && transformationConfig.previousDatasetKey !== AMAZON_IDENTITY_BASE_DATASET_KEY) {
    throw new Error("The transformation config identity-base dataset is invalid.");
  }
  if (sourceManifest?.files && report?.sourceFiles) {
    for (const name of ["metadata", "ratings"]) {
      const manifestFile = sourceManifest.files[name];
      const reportFile = report.sourceFiles[name];
      if (manifestFile?.bytes !== reportFile?.bytes || manifestFile?.sha256 !== reportFile?.sha256) {
        throw new Error(`The staging report ${name} source evidence differs from the pinned source manifest.`);
      }
    }
  }
}

export function isCompatibleAmazonArtworkProgress(progress, {
  datasetKey,
  policyVersion,
  inputDigest,
}) {
  return progress?.datasetKey === datasetKey
    && progress?.policyVersion === policyVersion
    && progress?.inputDigest === inputDigest
    && Array.isArray(progress?.entries);
}
