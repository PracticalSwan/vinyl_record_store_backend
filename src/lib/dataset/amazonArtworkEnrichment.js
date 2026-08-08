export function originalReleaseYearFromDate(value) {
  const match = String(value || "").match(/^(19\d{2}|20\d{2})(?:-(\d{2})(?:-(\d{2}))?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  if (!match[2]) return year;
  const month = Number(match[2]);
  if (month < 1 || month > 12) return null;
  if (!match[3]) return year;
  const day = Number(match[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day
    ? year
    : null;
}

export function assertSealedArtworkReproduction(report, {
  datasetKey,
  inputDigest,
  entriesDigest,
}) {
  if (report?.datasetKey !== datasetKey || report?.inputDigest !== inputDigest) {
    throw new Error("The recomputed artwork input provenance differs from the sealed release.");
  }
  if (report.entriesDigest !== entriesDigest) {
    throw new Error("Refusing to rewrite immutable artwork enrichment under the current dataset key.");
  }
}

export function needsOriginalYearHydration(entry) {
  if (!entry || !["matched", "accepted"].includes(entry.status)) return false;
  if (!entry.musicBrainzReleaseGroupId) return false;
  if (Number.isInteger(entry.originalReleaseYear)) return false;
  return !["complete", "not-available"].includes(entry.originalYearHydrationStatus);
}

export async function hydrateOriginalReleaseYear(entry, musicBrainz, {
  knownFirstReleaseDate = null,
} = {}) {
  const knownYear = originalReleaseYearFromDate(knownFirstReleaseDate);
  if (knownYear) {
    return {
      ...entry,
      originalReleaseYear: knownYear,
      originalYearHydrationStatus: "complete",
      originalYearHydrationError: undefined,
    };
  }
  try {
    const releaseGroup = await musicBrainz.getReleaseGroup(entry.musicBrainzReleaseGroupId);
    const originalReleaseYear = originalReleaseYearFromDate(releaseGroup?.firstReleaseDate);
    return {
      ...entry,
      originalReleaseYear,
      originalYearHydrationStatus: originalReleaseYear ? "complete" : "not-available",
      originalYearHydrationError: undefined,
    };
  } catch (error) {
    return {
      ...entry,
      originalReleaseYear: null,
      originalYearHydrationStatus: "retryable-error",
      originalYearHydrationError: String(error?.message || error).slice(0, 300),
    };
  }
}

export function toCommittedArtworkEnrichmentEntry(entry) {
  const {
    input: _operatorInput,
    artist: _artist,
    originalYearHydrationStatus: _hydrationStatus,
    originalYearHydrationError: _hydrationError,
    ...committed
  } = entry;
  return committed;
}
