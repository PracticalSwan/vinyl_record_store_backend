import { comparisonKey } from "../lib/catalog/normalize.js";
import { createCoverArtArchiveClient } from "../lib/external/coverArtArchiveClient.js";
import { createMusicBrainzClient } from "../lib/external/musicBrainzClient.js";

const defaultMusicBrainzClient = createMusicBrainzClient();
const defaultCoverArtArchiveClient = createCoverArtArchiveClient();

function artistMatches(candidate, artist) {
  const expected = comparisonKey(artist);
  return comparisonKey(candidate.artistCreditPhrase) === expected
    || (Array.isArray(candidate.artistCredit)
      && candidate.artistCredit.some((credit) => comparisonKey(credit) === expected));
}

// Same matching rules as catalogImport so an administrator previewing artwork
// sees exactly what import-time enrichment would accept.
function candidateMatches(candidate, product) {
  const candidateYear = candidate.date ? Number.parseInt(candidate.date.slice(0, 4), 10) : null;
  return candidate.score >= 95
    && comparisonKey(candidate.title) === comparisonKey(product.title)
    && artistMatches(candidate, product.artist)
    && (!product.year || candidateYear === product.year)
    && (!product.musicBrainzReleaseGroupId
      || candidate.releaseGroupId === product.musicBrainzReleaseGroupId);
}

function toSafeRelease(release) {
  if (!release) return null;
  return {
    id: release.id,
    releaseGroupId: release.releaseGroupId ?? null,
    title: release.title ?? null,
    artistCreditPhrase: release.artistCreditPhrase ?? null,
    date: release.date ?? null,
    label: release.label ?? null,
    genres: Array.isArray(release.genres) ? release.genres : [],
  };
}

function warning(code, message) {
  return { code, message };
}

// Resolve a MusicBrainz release and Cover Art Archive artwork for a product
// without writing anything. `releaseId` pins the lookup to a specific release
// (used by apply to make the saved artwork deterministic and reviewable).
export async function resolveArtworkForProduct(product, {
  musicBrainz = defaultMusicBrainzClient,
  coverArt = defaultCoverArtArchiveClient,
  releaseId = null,
} = {}) {
  const warnings = [];
  try {
    let release = null;
    const pinned = releaseId || product.musicBrainzReleaseId || null;
    if (pinned) {
      release = await musicBrainz.getRelease(pinned);
      if (!release) {
        return {
          release: null,
          artwork: null,
          warnings: [warning("MUSICBRAINZ_NOT_FOUND", "The selected MusicBrainz release was not found.")],
        };
      }
      if (!candidateMatches({ ...release, score: 100 }, product)) {
        return {
          release: null,
          artwork: null,
          warnings: [warning("MUSICBRAINZ_MISMATCH", "The MusicBrainz release does not match this product.")],
        };
      }
    } else {
      const candidates = await musicBrainz.findReleaseCandidates(product);
      const exact = candidates.filter((candidate) => candidateMatches(candidate, product));
      if (exact.length === 1) {
        release = await musicBrainz.getRelease(exact[0].id);
        if (!release || !candidateMatches({ ...release, score: 100 }, product)) {
          release = null;
          warnings.push(warning(
            "MUSICBRAINZ_DETAIL_MISMATCH",
            "The exact search result could not be verified against its release detail.",
          ));
        }
      } else {
        warnings.push(warning(
          exact.length > 1 ? "AMBIGUOUS_MUSICBRAINZ_MATCH" : "NO_MUSICBRAINZ_MATCH",
          exact.length > 1
            ? "Multiple exact MusicBrainz releases require administrator review."
            : "No exact MusicBrainz release was accepted.",
        ));
      }
    }

    if (!release) return { release: null, artwork: null, warnings };

    let artwork = await coverArt.getReleaseArtwork(release.id);
    if (!artwork && release.releaseGroupId && typeof coverArt.getReleaseGroupArtwork === "function") {
      artwork = await coverArt.getReleaseGroupArtwork(release.releaseGroupId);
      if (artwork) {
        warnings.push(warning(
          "ARTWORK_RELEASE_GROUP_FALLBACK",
          "The exact release has no approved front artwork; approved artwork from the same release group was used.",
        ));
      }
    }
    if (!artwork) {
      warnings.push(warning("ARTWORK_NOT_FOUND", "No approved front artwork was found for this release or its release group."));
    }
    return { release: toSafeRelease(release), artwork, warnings };
  } catch (error) {
    return {
      release: null,
      artwork: null,
      warnings: [warning(
        "EXTERNAL_SERVICE_UNAVAILABLE",
        `${error.service || "External metadata service"} was unavailable; no artwork was saved.`,
      )],
    };
  }
}
