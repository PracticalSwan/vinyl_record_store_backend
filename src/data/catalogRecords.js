import { artworkManifest, ARTWORK_REVIEWED_AT } from "./artworkManifest.js";
import { records } from "./records.js";

const artworkByPublicId = new Map(artworkManifest.map((entry) => [entry.publicId, entry]));
const stableSlugs = new Map([
  [17, "sault-exile-in-godhead-17"],
  [40, "glenn-gould-glenn-gould-plays-bach-goldberg-variations-40"],
  [42, "beethoven-berlin-philharmonic-karajan-symphony-no-9-choral-42"],
  [115, "new-order-substance-115"],
  [125, "junior-wells-hoodoo-man-blues-125"],
  [126, "gustav-holst-london-philharmonic-the-planets-126"],
  [127, "george-gershwin-bernstein-ny-phil-rhapsody-in-blue-127"],
  [203, "grant-green-grant-green-idle-moments-203"],
  [207, "max-roach-we-insist-freedom-now-suite-207"],
  [238, "muddy-waters-muddy-waters-at-newport-238"],
  [241, "j-s-bach-pablo-casals-cello-suite-no-1-in-g-major-241"],
  [242, "beethoven-wilhelm-kempff-piano-sonatas-vol-1-242"],
  [244, "beethoven-carlos-kleiber-vienna-philharmonic-symphony-no-5-7-244"],
]);

if (artworkByPublicId.size !== records.length) {
  throw new Error("The reviewed artwork manifest must contain one unique entry per catalog record.");
}

export const catalogRecords = Object.freeze(records.map((record) => {
  const reviewed = artworkByPublicId.get(record.id);
  if (!reviewed || reviewed.catalogTitle !== record.title || reviewed.catalogArtist !== record.artist) {
    throw new Error(`The reviewed artwork manifest is stale for catalog publicId ${record.id}.`);
  }
  return Object.freeze({
    ...record,
    ...(stableSlugs.has(record.id) ? { slug: stableSlugs.get(record.id) } : {}),
    musicBrainzReleaseId: reviewed.musicBrainzReleaseId,
    musicBrainzReleaseGroupId: reviewed.musicBrainzReleaseGroupId,
    artwork: { ...reviewed.artwork },
    provenance: [
      {
        field: "musicBrainzReleaseId",
        source: "musicbrainz",
        sourceId: reviewed.musicBrainzReleaseId,
        retrievedAt: ARTWORK_REVIEWED_AT,
      },
      {
        field: "musicBrainzReleaseGroupId",
        source: "musicbrainz",
        sourceId: reviewed.musicBrainzReleaseGroupId,
        retrievedAt: ARTWORK_REVIEWED_AT,
      },
      {
        field: "artwork",
        source: "cover-art-archive",
        sourceId: reviewed.review.artworkEntityId,
        retrievedAt: ARTWORK_REVIEWED_AT,
      },
    ],
  });
}));
