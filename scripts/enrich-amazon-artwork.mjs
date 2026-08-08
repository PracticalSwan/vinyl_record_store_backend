import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  AMAZON_DATASET_KEY,
  readJsonlRows,
  sha256File,
} from "../src/lib/dataset/amazonReviews2023.js";
import {
  getCurrentAmazonDatasetRelease,
  isCompatibleAmazonArtworkProgress,
} from "../src/lib/dataset/amazonDatasetReleases.js";
import {
  assertSealedArtworkReproduction,
  hydrateOriginalReleaseYear,
  needsOriginalYearHydration,
  originalReleaseYearFromDate,
  toCommittedArtworkEnrichmentEntry,
} from "../src/lib/dataset/amazonArtworkEnrichment.js";
import { writeJsonAtomically } from "../src/lib/dataset/integrity.js";
import { comparisonKey } from "../src/lib/catalog/normalize.js";
import { createCoverArtArchiveClient } from "../src/lib/external/coverArtArchiveClient.js";
import { createMusicBrainzClient } from "../src/lib/external/musicBrainzClient.js";

const POLICY_VERSION = "musicbrainz-high-confidence-v1";
const SCORE_MINIMUM = 95;
const CONCURRENCY = 6;
const dataRoot = path.join(process.cwd(), "data", "amazon-reviews-2023");
const currentRelease = getCurrentAmazonDatasetRelease();
const stagingRoot = path.join(dataRoot, "staging", AMAZON_DATASET_KEY);
const productsPath = path.join(stagingRoot, "products.jsonl");
const progressPath = path.join(stagingRoot, "artwork-enrichment-progress.json");
const destination = path.join(dataRoot, currentRelease.artworkEnrichmentFilename);
const restart = process.argv.includes("--restart");

let existingReport;
try {
  existingReport = JSON.parse(await readFile(destination, "utf8"));
} catch (error) {
  if (error.code === "ENOENT") {
    throw new Error(`The sealed ${currentRelease.datasetKey} artwork enrichment is missing; restore the committed artifact instead of regenerating it under the same key.`);
  }
  throw error;
}
if (
  existingReport.datasetKey !== AMAZON_DATASET_KEY
  || await sha256File(destination) !== currentRelease.artifactSha256.artworkEnrichment
) {
  throw new Error("The sealed current-release artwork enrichment differs from its pinned immutable evidence.");
}

function normalizedTitle(value) {
  return comparisonKey(String(value || ""))
    .replace(/\b(?:vinyl|lp|remaster(?:ed)?|deluxe|expanded|anniversary|edition|reissue|explicit lyrics?|picture disc|colored vinyl|colour vinyl|mono|stereo|ogv|mov)\b/g, " ")
    .replace(/\b(?:black|blue|red|green|white|clear|gold|silver)\b(?=\s*$)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizedArtist(value) {
  return comparisonKey(String(value || ""))
    .replace(/\b(?:artist|composer|performer|conductor|orchestra)\b/g, " ")
    .replace(/\bthe\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSimilarity(left, right) {
  const leftTokens = new Set(normalizedArtist(left).split(" ").filter((token) => token.length > 1));
  const rightTokens = new Set(normalizedArtist(right).split(" ").filter((token) => token.length > 1));
  if (!leftTokens.size || !rightTokens.size) return 0;
  const overlap = [...leftTokens].filter((token) => rightTokens.has(token)).length;
  return overlap / Math.min(leftTokens.size, rightTokens.size);
}

function candidateAccepts(product, candidate, method) {
  const sourceTitle = normalizedTitle(product.title);
  const candidateTitle = normalizedTitle(candidate.releaseGroupTitle || candidate.title);
  const titleExact = Boolean(sourceTitle && candidateTitle && sourceTitle === candidateTitle);
  const artistSimilarity = tokenSimilarity(product.artist, candidate.artistCreditPhrase);
  const artistAccepted = method === "asin" ? artistSimilarity >= 0.5 || !product.artist : artistSimilarity >= 0.8;
  const vinyl = candidate.mediaFormats.length === 0
    || candidate.mediaFormats.some((format) => /vinyl/i.test(format));
  return {
    accepted: candidate.score >= SCORE_MINIMUM
      && titleExact
      && artistAccepted
      && vinyl
      && candidate.status === "Official"
      && Boolean(candidate.releaseGroupId),
    titleExact,
    artistSimilarity,
    vinyl,
  };
}

async function findDecision(product, musicBrainz) {
  const sourceId = product.provenance?.find((entry) => entry.field === "catalog-record")?.sourceId || null;
  const attempts = [];
  if (product.artist) {
    attempts.push({
      method: "title-artist-vinyl",
      query: { title: product.title, artist: product.artist, vinylOnly: true, officialOnly: true, limit: 10 },
    });
  }
  if (sourceId) {
    attempts.push({
      method: "asin-vinyl",
      query: { asin: sourceId, vinylOnly: true, officialOnly: true, limit: 10 },
    });
  }

  const reviewed = [];
  for (const attempt of attempts) {
    const candidates = await musicBrainz.findReleaseCandidates(attempt.query);
    for (const candidate of candidates) {
      const match = candidateAccepts(product, candidate, attempt.method === "asin-vinyl" ? "asin" : "metadata");
      if (match.accepted) reviewed.push({ ...candidate, match, matchMethod: attempt.method });
    }
    if (reviewed.length) break;
  }

  const groups = new Map();
  for (const candidate of reviewed) {
    if (!groups.has(candidate.releaseGroupId)) groups.set(candidate.releaseGroupId, []);
    groups.get(candidate.releaseGroupId).push(candidate);
  }
  if (groups.size === 0) {
    return {
      publicId: product.publicId,
      status: "unresolved",
      confidence: "none",
      input: { title: product.title, artist: product.artist },
      decisionCodes: [product.artist ? "NO_STRICT_MUSICBRAINZ_MATCH" : "SOURCE_ARTIST_UNRESOLVED"],
      candidateReleaseGroups: 0,
    };
  }
  if (groups.size > 1) {
    return {
      publicId: product.publicId,
      status: "ambiguous",
      confidence: "none",
      input: { title: product.title, artist: product.artist },
      decisionCodes: ["MULTIPLE_STRICT_RELEASE_GROUPS"],
      candidateReleaseGroups: groups.size,
    };
  }
  const candidates = [...groups.values()][0].sort((left, right) => (
    right.score - left.score
    || String(left.date || "").localeCompare(String(right.date || ""))
    || left.id.localeCompare(right.id)
  ));
  const selected = candidates[0];
  const decision = {
    publicId: product.publicId,
    status: "matched",
    confidence: "high",
    input: { title: product.title, artist: product.artist },
    artist: selected.artistCreditPhrase || product.artist,
    originalReleaseYear: null,
    editionReleaseYear: originalReleaseYearFromDate(selected.date) || product.editionReleaseYear,
    musicBrainzReleaseId: selected.id,
    musicBrainzReleaseGroupId: selected.releaseGroupId,
    matchMethod: selected.matchMethod,
    matchScore: selected.score,
    matchEvidence: {
      titleExact: selected.match.titleExact,
      artistSimilarity: Number(selected.match.artistSimilarity.toFixed(3)),
      official: selected.status === "Official",
      vinyl: selected.match.vinyl,
      releaseGroupUnique: true,
    },
    decisionCodes: ["STRICT_UNIQUE_RELEASE_GROUP_MATCH"],
    candidateReleaseGroups: 1,
  };
  return hydrateOriginalReleaseYear(decision, musicBrainz, {
    knownFirstReleaseDate: selected.releaseGroupFirstReleaseDate,
  });
}

async function runWorkers(items, worker, concurrency = CONCURRENCY) {
  const output = new Array(items.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      output[index] = await worker(items[index], index);
    }
  }));
  return output;
}

const products = [];
for await (const product of readJsonlRows(productsPath, "current v3 staged product")) products.push(product);
products.sort((left, right) => left.publicId - right.publicId);
const inputDigest = createHash("sha256")
  .update(JSON.stringify(products.map((product) => ({
    publicId: product.publicId,
    title: product.title,
    artist: product.artist,
    externalItemKey: product.externalItemKey,
  }))))
  .digest("hex");

let decisions = new Map();
if (!restart) {
  try {
    const progress = JSON.parse(await readFile(progressPath, "utf8"));
    if (isCompatibleAmazonArtworkProgress(progress, {
      datasetKey: AMAZON_DATASET_KEY,
      policyVersion: POLICY_VERSION,
      inputDigest,
    })) {
      decisions = new Map(progress.entries
        .filter((entry) => entry.status !== "error")
        .map((entry) => [entry.publicId, entry]));
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

const musicBrainz = createMusicBrainzClient();
for (const [index, product] of products.entries()) {
  const existing = decisions.get(product.publicId);
  if (existing && !needsOriginalYearHydration(existing)) continue;
  try {
    decisions.set(product.publicId, existing
      ? await hydrateOriginalReleaseYear(existing, musicBrainz)
      : await findDecision(product, musicBrainz));
  } catch (error) {
    decisions.set(product.publicId, {
      publicId: product.publicId,
      status: "error",
      confidence: "none",
      input: { title: product.title, artist: product.artist },
      decisionCodes: ["UPSTREAM_LOOKUP_ERROR"],
      error: String(error?.message || error).slice(0, 300),
      candidateReleaseGroups: 0,
    });
  }
  const progressEntries = products
    .map((item) => decisions.get(item.publicId))
    .filter(Boolean);
  await writeJsonAtomically(progressPath, {
    schemaVersion: 1,
    datasetKey: AMAZON_DATASET_KEY,
    policyVersion: POLICY_VERSION,
    inputDigest,
    entries: progressEntries,
  });
  if ((index + 1) % 25 === 0 || index === products.length - 1) {
    process.stderr.write(`[MusicBrainz ${index + 1}/${products.length}] ${product.publicId}\n`);
  }
}

const retryableHydrations = [...decisions.values()]
  .filter((entry) => entry.originalYearHydrationStatus === "retryable-error");
if (retryableHydrations.length) {
  throw new Error(
    `${retryableHydrations.length} MusicBrainz original-year lookups remain retryable; rerun enrichment to resume.`,
  );
}

const coverArt = createCoverArtArchiveClient();
const matched = products
  .map((product) => decisions.get(product.publicId))
  .filter((entry) => entry.status === "matched");
await runWorkers(matched, async (entry, index) => {
  try {
    const artwork = await coverArt.getReleaseArtwork(entry.musicBrainzReleaseId)
      || await coverArt.getReleaseGroupArtwork(entry.musicBrainzReleaseGroupId);
    if (!artwork) {
      Object.assign(entry, {
        status: "unresolved",
        decisionCodes: [...entry.decisionCodes, "APPROVED_FRONT_ARTWORK_NOT_FOUND"],
      });
      return;
    }
    Object.assign(entry, {
      status: "accepted",
      artwork: {
        url: artwork.url,
        thumbnailUrl: artwork.thumbnailUrl,
        detailUrl: artwork.detailUrl,
        source: artwork.source,
        sourceUrl: artwork.sourceUrl,
        retrievedAt: artwork.retrievedAt.toISOString(),
      },
      provenance: [{
        field: "artwork",
        source: "musicbrainz-cover-art-archive",
        sourceId: entry.musicBrainzReleaseId,
        retrievedAt: artwork.retrievedAt.toISOString(),
      }],
      decisionCodes: [...entry.decisionCodes, "APPROVED_FRONT_ARTWORK_FOUND"],
    });
  } catch (error) {
    Object.assign(entry, {
      status: "error",
      decisionCodes: [...entry.decisionCodes, "ARTWORK_LOOKUP_ERROR"],
      error: String(error?.message || error).slice(0, 300),
    });
  }
  if ((index + 1) % 25 === 0 || index === matched.length - 1) {
    process.stderr.write(`[Cover Art Archive ${index + 1}/${matched.length}] ${entry.publicId}\n`);
  }
});

const entries = products.map((product) => {
  const decision = decisions.get(product.publicId);
  // The committed enrichment registry is a technical mapping, not a second
  // copy of source catalog text. Keep operator-only match inputs and the
  // MusicBrainz artist phrase in ignored staging progress.
  return toCommittedArtworkEnrichmentEntry(decision);
});
const entriesDigest = createHash("sha256").update(JSON.stringify(entries)).digest("hex");
const counts = Object.fromEntries(["accepted", "ambiguous", "unresolved", "error"].map((status) => [
  status,
  entries.filter((entry) => entry.status === status).length,
]));
if (counts.error > 0) {
  throw new Error(`${counts.error} upstream artwork decisions remain retryable; the immutable enrichment artifact was not published.`);
}
assertSealedArtworkReproduction(existingReport, {
  datasetKey: AMAZON_DATASET_KEY,
  inputDigest,
  entriesDigest,
});
console.log(JSON.stringify({
  destination,
  entries: entries.length,
  entriesDigest,
  counts,
  publication: "unchanged",
}, null, 2));
