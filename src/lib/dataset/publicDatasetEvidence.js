const PUBLIC_REPORT_FIELDS = Object.freeze([
  "schemaVersion",
  "datasetKey",
  "sourceRevision",
  "staged",
  "filtering",
  "quality",
  "artwork",
  "sourceLimitations",
  "acceptance",
]);

export function createPublicDataQualitySummary(report, { sourceRevision }) {
  const summary = {
    schemaVersion: 2,
    datasetKey: report.datasetKey,
    sourceRevision,
    staged: report.staged,
    filtering: report.filtering,
    quality: report.quality,
    artwork: report.artwork,
    sourceLimitations: {
      reviewTextIncluded: false,
      verifiedPurchaseAvailable: false,
      amazonImagesIncluded: false,
      commercialFieldsAvailable: false,
      formatGranularity: "broad-vinyl-only",
    },
    acceptance: report.acceptance,
  };
  if (Object.keys(summary).some((key) => !PUBLIC_REPORT_FIELDS.includes(key))) {
    throw new Error("Public data-quality summary contains an internal-only field.");
  }
  return summary;
}
