import test from "node:test";
import assert from "node:assert/strict";
import { createCoverArtArchiveClient } from "../src/lib/external/coverArtArchiveClient.js";
import { createMusicBrainzClient } from "../src/lib/external/musicBrainzClient.js";

const noCache = { get: async () => null, set: async () => {} };

test("MusicBrainz client identifies the application and waits between uncached requests", async () => {
  const waits = [];
  const headers = [];
  const fetchImpl = async (_url, options) => {
    headers.push(options.headers);
    return { ok: true, status: 200, json: async () => ({ releases: [] }) };
  };
  const client = createMusicBrainzClient({
    fetchImpl,
    sleep: async (milliseconds) => { waits.push(milliseconds); },
    now: () => 0,
    cache: noCache,
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  await client.findReleaseCandidates({ title: "One", artist: "Artist" });
  await client.findReleaseCandidates({ title: "Two", artist: "Artist" });
  assert.deepEqual(waits, [1_000]);
  assert.equal(headers[0]["User-Agent"], "GroovehausTest/1.0 (test@example.com)");
});

test("Cover Art Archive client accepts only approved front art from its own host", async () => {
  const releaseId = "11111111-1111-4111-8111-111111111111";
  const client = createCoverArtArchiveClient({
    cache: noCache,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        images: [
          { approved: false, front: true, thumbnails: { 500: "https://coverartarchive.org/rejected.jpg" } },
          {
            approved: true,
            front: true,
            image: "https://coverartarchive.org/full.jpg",
            thumbnails: {
              500: "http://coverartarchive.org/cover-500.jpg",
              1200: "http://coverartarchive.org/cover-1200.jpg",
            },
          },
        ],
      }),
    }),
  });
  const artwork = await client.getReleaseArtwork(releaseId);
  assert.equal(artwork.thumbnailUrl, "https://coverartarchive.org/cover-500.jpg");
  assert.equal(artwork.sourceUrl, `https://musicbrainz.org/release/${releaseId}`);

  const hostile = createCoverArtArchiveClient({
    cache: noCache,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({ images: [{
        approved: true,
        front: true,
        image: "https://evil.example/full.jpg",
        thumbnails: { 500: "https://evil.example/500.jpg", 1200: "https://evil.example/1200.jpg" },
      }] }),
    }),
  });
  assert.equal(await hostile.getReleaseArtwork(releaseId), null);
});

test("Cover Art Archive client ignores a tampered resolved cache entry", async () => {
  const releaseId = "11111111-1111-4111-8111-111111111111";
  let fetched = 0;
  const client = createCoverArtArchiveClient({
    cache: {
      get: async () => ({ resolvedArtwork: {
        thumbnailUrl: "https://evil.example/500.jpg",
        detailUrl: "https://evil.example/1200.jpg",
        source: "cover-art-archive",
        sourceUrl: `https://musicbrainz.org/release/${releaseId}`,
        retrievedAt: new Date().toISOString(),
      } }),
      set: async () => {},
    },
    fetchImpl: async () => {
      fetched += 1;
      return {
        ok: true,
        status: 200,
        json: async () => ({ images: [{
          approved: true,
          front: true,
          image: "https://coverartarchive.org/full.jpg",
          thumbnails: {
            500: "https://coverartarchive.org/500.jpg",
            1200: "https://coverartarchive.org/1200.jpg",
          },
        }] }),
      };
    },
  });
  assert.equal((await client.getReleaseArtwork(releaseId)).thumbnailUrl, "https://coverartarchive.org/500.jpg");
  assert.equal(fetched, 1);
});
