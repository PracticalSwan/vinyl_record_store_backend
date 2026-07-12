import test from "node:test";
import assert from "node:assert/strict";
import { artworkManifest, ARTWORK_REVIEWED_AT } from "../src/data/artworkManifest.js";
import { catalogRecords } from "../src/data/catalogRecords.js";
import { records } from "../src/data/records.js";
import { toPublicProduct } from "../src/repositories/catalogMapping.js";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

test("reviewed artwork manifest covers every catalog record exactly once", () => {
  assert.equal(artworkManifest.length, records.length);
  assert.equal(new Set(artworkManifest.map((entry) => entry.publicId)).size, records.length);
  assert.deepEqual(
    artworkManifest.map((entry) => entry.publicId).sort((left, right) => left - right),
    records.map((record) => record.id).sort((left, right) => left - right),
  );
  assert.equal(artworkManifest.filter((entry) => entry.review.matchQuality === "exact").length, 110);
  assert.deepEqual(
    artworkManifest
      .filter((entry) => entry.review.matchQuality === "manual-review")
      .map((entry) => entry.publicId)
      .sort((left, right) => left - right),
    [17, 128, 210, 213, 236, 243],
  );
});

test("each reviewed entry is bound to MusicBrainz and approved Cover Art Archive URLs", () => {
  for (const entry of artworkManifest) {
    assert.match(entry.musicBrainzReleaseId, UUID_PATTERN);
    assert.match(entry.musicBrainzReleaseGroupId, UUID_PATTERN);
    assert.equal(entry.review.status, "approved");
    assert.equal(entry.artwork.source, "cover-art-archive");
    assert.equal(entry.artwork.retrievedAt, ARTWORK_REVIEWED_AT);
    assert.equal(entry.artwork.sourceUrl, `https://musicbrainz.org/release/${entry.musicBrainzReleaseId}`);
    for (const value of [entry.artwork.thumbnailUrl, entry.artwork.detailUrl]) {
      const url = new URL(value);
      assert.equal(url.protocol, "https:");
      assert.equal(url.hostname, "coverartarchive.org");
      assert.ok(
        url.pathname.includes(entry.musicBrainzReleaseId)
          || url.pathname.includes(entry.musicBrainzReleaseGroupId),
      );
    }
  }
});

test("seed catalog exposes every reviewed cover and preserves audit provenance", () => {
  assert.equal(catalogRecords.length, records.length);
  for (const record of catalogRecords) {
    const product = toPublicProduct(record);
    assert.ok(product.image, `missing public artwork for ${record.id}`);
    assert.equal(record.provenance.length, 3);
    assert.equal(record.musicBrainzReleaseId, artworkManifest.find((entry) => entry.publicId === record.id).musicBrainzReleaseId);
  }
});
