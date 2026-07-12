import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { records } from "../src/data/records.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const EXPECTED_MANUAL_REVIEW_IDS = [17, 128, 210, 213, 236, 243];
const MANUAL_REVIEW_NOTES = new Map([
  [17, "Exact album identity. MusicBrainz has no vinyl release entry, so the official digital album anchors the approved artwork."],
  [128, "Exact work and performer. MusicBrainz has no cataloged vinyl edition, so an official CD edition anchors the approved artwork."],
  [210, "Exact official US 2xLP. The catalog keeps an ASCII title while MusicBrainz uses the release's typographic symbol."],
  [213, "Exact album identity. MusicBrainz has no vinyl edition, so the official US 2xCD edition anchors the approved artwork."],
  [236, "Exact album identity. MusicBrainz has no vinyl album entry, so the official US CD edition anchors the approved artwork."],
  [243, "Exact performer and work family. MusicBrainz has no original vinyl entry, so the official collection anchors the approved artwork."],
]);

function parseArguments(argv) {
  const options = { input: null, output: null };
  for (const argument of argv) {
    if (argument.startsWith("--input=")) options.input = argument.slice("--input=".length);
    else if (argument.startsWith("--output=")) options.output = argument.slice("--output=".length);
    else throw new Error(`Unsupported argument: ${argument}`);
  }
  if (!options.input || !options.output) {
    throw new Error("Usage: node scripts/build-artwork-manifest.mjs --input=<reviewed-report.json> --output=<manifest.js>");
  }
  return options;
}

function assertReviewReport(report) {
  if (!report || !Array.isArray(report.proposals)) throw new Error("The review report has no proposals array.");
  if (report.rows !== records.length || report.proposals.length !== records.length) {
    throw new Error(`Expected ${records.length} reviewed catalog rows.`);
  }
  if (report.counts?.withArtwork !== records.length || report.counts?.close !== 0) {
    throw new Error("Every row must have approved artwork and no unresolved close match.");
  }

  const publicIds = report.proposals.map((proposal) => proposal.publicId);
  if (new Set(publicIds).size !== records.length) throw new Error("Review report public IDs must be unique.");
  const expectedIds = records.map((record) => record.id).sort((left, right) => left - right);
  const actualIds = [...publicIds].sort((left, right) => left - right);
  if (JSON.stringify(actualIds) !== JSON.stringify(expectedIds)) throw new Error("Review report does not cover the full catalog.");

  const manualIds = report.proposals
    .filter((proposal) => proposal.quality === "manual-review")
    .map((proposal) => proposal.publicId)
    .sort((left, right) => left - right);
  if (JSON.stringify(manualIds) !== JSON.stringify(EXPECTED_MANUAL_REVIEW_IDS)) {
    throw new Error(`Unexpected manual-review boundary: ${manualIds.join(", ")}.`);
  }

  for (const proposal of report.proposals) {
    const record = records.find((candidate) => candidate.id === proposal.publicId);
    const selected = proposal.selected;
    if (!record || proposal.record?.title !== record.title || proposal.record?.artist !== record.artist) {
      throw new Error(`Catalog identity drifted for publicId ${proposal.publicId}.`);
    }
    if (!selected || !UUID_PATTERN.test(selected.id) || !UUID_PATTERN.test(selected.releaseGroupId)) {
      throw new Error(`MusicBrainz identity is incomplete for publicId ${proposal.publicId}.`);
    }
    if (selected.status !== "Official" || selected.primaryType !== "Album") {
      throw new Error(`Selected identity is not an official album for publicId ${proposal.publicId}.`);
    }
    if (proposal.quality === "exact" && !selected.match?.albumVinyl) {
      throw new Error(`Exact review is not bound to album vinyl for publicId ${proposal.publicId}.`);
    }
    const artwork = selected.artwork;
    if (!artwork || !UUID_PATTERN.test(artwork.entityId)) {
      throw new Error(`Approved artwork is incomplete for publicId ${proposal.publicId}.`);
    }
    for (const value of [artwork.thumbnailUrl, artwork.detailUrl]) {
      const url = new URL(value);
      if (url.protocol !== "https:" || !["coverartarchive.org", "www.coverartarchive.org"].includes(url.hostname)) {
        throw new Error(`Artwork host is not approved for publicId ${proposal.publicId}.`);
      }
      if (artwork.entity === "release" && !url.pathname.includes(artwork.entityId)) {
        throw new Error(`Artwork is not bound to its reviewed entity for publicId ${proposal.publicId}.`);
      }
      if (artwork.entity === "release-group" && !/^\/release\/[0-9a-f-]+\//i.test(url.pathname)) {
        throw new Error(`Release-group artwork is not a Cover Art Archive image for publicId ${proposal.publicId}.`);
      }
    }
  }
}

function buildEntry(proposal, reviewedAt) {
  const selected = proposal.selected;
  const artwork = selected.artwork;
  const stableArtwork = artwork.entity === "release-group"
    ? {
        thumbnailUrl: `https://coverartarchive.org/release-group/${artwork.entityId}/front-500`,
        detailUrl: `https://coverartarchive.org/release-group/${artwork.entityId}/front-1200`,
      }
    : {
        thumbnailUrl: artwork.thumbnailUrl,
        detailUrl: artwork.detailUrl,
      };
  return {
    publicId: proposal.publicId,
    catalogTitle: proposal.record.title,
    catalogArtist: proposal.record.artist,
    musicBrainzReleaseId: selected.id,
    musicBrainzReleaseGroupId: selected.releaseGroupId,
    artwork: {
      url: stableArtwork.detailUrl,
      thumbnailUrl: stableArtwork.thumbnailUrl,
      detailUrl: stableArtwork.detailUrl,
      source: "cover-art-archive",
      sourceUrl: `https://musicbrainz.org/release/${selected.id}`,
      retrievedAt: reviewedAt,
    },
    review: {
      status: "approved",
      matchQuality: proposal.quality,
      note: proposal.quality === "exact"
        ? "Exact official album-vinyl identity confirmed in the visual review gallery."
        : MANUAL_REVIEW_NOTES.get(proposal.publicId),
      selectedTitle: String(selected.title || "").replace(/\u262e\ufe0e?/g, "O"),
      selectedArtist: String(selected.artist || "").replace(/\u262e\ufe0e?/g, "O"),
      releaseDate: selected.date,
      country: selected.country,
      formats: selected.formats,
      primaryType: selected.primaryType,
      artworkEntity: artwork.entity,
      artworkEntityId: artwork.entityId,
    },
  };
}

const options = parseArguments(process.argv.slice(2));
const report = JSON.parse(await readFile(path.resolve(options.input), "utf8"));
assertReviewReport(report);
const reviewedAt = new Date(report.generatedAt).toISOString();
const manifest = report.proposals.map((proposal) => buildEntry(proposal, reviewedAt));
const source = `// Generated by scripts/build-artwork-manifest.mjs from the human-reviewed curation report.\n`
  + `// Re-run the review before replacing this file.\n\n`
  + `export const ARTWORK_REVIEWED_AT = ${JSON.stringify(reviewedAt)};\n\n`
  + `export const artworkManifest = Object.freeze(${JSON.stringify(manifest, null, 2)});\n`;
const destination = path.resolve(options.output);
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, source, "utf8");
console.log(JSON.stringify({ output: destination, rows: manifest.length, reviewedAt }, null, 2));
