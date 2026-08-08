import test from "node:test";
import assert from "node:assert/strict";
import { ExternalCatalogError } from "../src/lib/external/musicBrainzClient.js";
import {
  createCoverArtArchiveClient,
  parseRetryAfterMilliseconds,
} from "../src/lib/external/coverArtArchiveClient.js";
import { createMusicBrainzClient } from "../src/lib/external/musicBrainzClient.js";

const noCache = { get: async () => null, set: async () => {} };
const noSleep = async () => {};
const releaseId = "11111111-1111-4111-8111-111111111111";

test("Cover Art Archive Retry-After parser supports seconds and HTTP dates", () => {
  const now = Date.parse("2026-08-09T00:00:00Z");
  assert.equal(parseRetryAfterMilliseconds("2", now), 2_000);
  assert.equal(
    parseRetryAfterMilliseconds("Sun, 09 Aug 2026 00:00:05 GMT", now),
    5_000,
  );
  assert.equal(parseRetryAfterMilliseconds("not-a-date", now), null);
});

function approvedFrontArtwork() {
  return {
    ok: true,
    status: 200,
    json: async () => ({ images: [{
      approved: true,
      front: true,
      image: "https://coverartarchive.org/full.jpg",
      thumbnails: {
        500: "https://coverartarchive.org/cover-500.jpg",
        1200: "https://coverartarchive.org/cover-1200.jpg",
      },
    }] }),
  };
}

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
  assert.deepEqual(waits, [1_100]);
  assert.equal(headers[0]["User-Agent"], "GroovehausTest/1.0 (test@example.com)");
});

test("MusicBrainz getReleaseGroup returns authoritative first-release-date", async () => {
  const releaseGroupId = "5dc32bc2-f734-4cff-b9c5-f9594d785148";
  const client = createMusicBrainzClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: releaseGroupId,
        title: "Test Album",
        "primary-type": "Album",
        "first-release-date": "2017-11-03",
        "artist-credit": [{ name: "Test Artist", joinphrase: "" }],
      }),
    }),
    sleep: noSleep,
    now: () => 0,
    cache: noCache,
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  const group = await client.getReleaseGroup(releaseGroupId);
  assert.equal(group.id, releaseGroupId);
  assert.equal(group.firstReleaseDate, "2017-11-03");
  assert.equal(group.title, "Test Album");
  assert.deepEqual(group.artistCredit, ["Test Artist"]);
});

test("MusicBrainz getReleaseGroup returns null for missing first-release-date", async () => {
  const releaseGroupId = "5dc32bc2-f734-4cff-b9c5-f9594d785148";
  const client = createMusicBrainzClient({
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      json: async () => ({
        id: releaseGroupId,
        title: "Test Album",
        "primary-type": "Album",
        "artist-credit": [],
      }),
    }),
    sleep: noSleep,
    now: () => 0,
    cache: noCache,
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  const group = await client.getReleaseGroup(releaseGroupId);
  assert.equal(group.firstReleaseDate, null);
});

test("MusicBrainz getReleaseGroup returns null for a 404", async () => {
  const releaseGroupId = "5dc32bc2-f734-4cff-b9c5-f9594d785148";
  const client = createMusicBrainzClient({
    fetchImpl: async () => ({ ok: false, status: 404 }),
    sleep: noSleep,
    now: () => 0,
    cache: noCache,
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  const group = await client.getReleaseGroup(releaseGroupId);
  assert.equal(group, null);
});

test("MusicBrainz getReleaseGroup rejects an invalid UUID", async () => {
  const client = createMusicBrainzClient({
    fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({}) }),
    sleep: noSleep,
    cache: noCache,
    userAgent: "GroovehausTest/1.0 (test@example.com)",
  });
  await assert.rejects(() => client.getReleaseGroup("not-a-uuid"), /invalid/i);
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

test("Cover Art Archive client resolves approved release-group artwork with group provenance", async () => {
  const releaseGroupId = "22222222-2222-4222-8222-222222222222";
  let requestedUrl = null;
  const client = createCoverArtArchiveClient({
    cache: noCache,
    fetchImpl: async (url) => {
      requestedUrl = url;
      return {
        ok: true,
        status: 200,
        json: async () => ({ images: [{
          approved: true,
          front: true,
          image: "https://coverartarchive.org/release/example/full.jpg",
          thumbnails: {
            500: "https://coverartarchive.org/release/example/500.jpg",
            1200: "https://coverartarchive.org/release/example/1200.jpg",
          },
        }] }),
      };
    },
  });
  const artwork = await client.getReleaseGroupArtwork(releaseGroupId);
  assert.equal(requestedUrl, `https://coverartarchive.org/release-group/${releaseGroupId}`);
  assert.equal(artwork.sourceUrl, `https://musicbrainz.org/release-group/${releaseGroupId}`);
  assert.equal(artwork.thumbnailUrl, `https://coverartarchive.org/release-group/${releaseGroupId}/front-500`);
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

test("Cover Art Archive client retries a transient 500 then succeeds", async () => {
  let calls = 0;
  const responses = [
    { ok: false, status: 500, headers: new Map() },
    approvedFrontArtwork(),
  ];
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => responses[calls++],
  });
  const artwork = await client.getReleaseArtwork(releaseId);
  assert.equal(calls, 2);
  assert.equal(artwork.thumbnailUrl, "https://coverartarchive.org/cover-500.jpg");
});

test("Cover Art Archive client retries a 429 honoring Retry-After then succeeds", async () => {
  let calls = 0;
  const responses = [
    { ok: false, status: 429, headers: new Map([["retry-after", "0"]]) },
    approvedFrontArtwork(),
  ];
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => responses[calls++],
  });
  const artwork = await client.getReleaseArtwork(releaseId);
  assert.equal(calls, 2);
  assert.equal(artwork.thumbnailUrl, "https://coverartarchive.org/cover-500.jpg");
});

test("Cover Art Archive client retries a network/timeout error then succeeds", async () => {
  let calls = 0;
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      if (calls === 1) throw new Error("ETIMEDOUT");
      return approvedFrontArtwork();
    },
  });
  const artwork = await client.getReleaseArtwork(releaseId);
  assert.equal(calls, 2);
  assert.equal(artwork.thumbnailUrl, "https://coverartarchive.org/cover-500.jpg");
});

test("Cover Art Archive client stops retrying after bounded attempts and throws", async () => {
  let calls = 0;
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      throw new Error("persistent network failure");
    },
  });
  await assert.rejects(
    () => client.getReleaseArtwork(releaseId),
    (error) => error instanceof ExternalCatalogError && error.service === "cover-art-archive",
  );
  assert.equal(calls, 4);
});

test("Cover Art Archive client does not retry a 404 and returns null", async () => {
  let calls = 0;
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 404, headers: new Map() };
    },
  });
  const result = await client.getReleaseArtwork(releaseId);
  assert.equal(result, null);
  assert.equal(calls, 1);
});

test("Cover Art Archive client does not retry a non-retryable 4xx and throws", async () => {
  let calls = 0;
  const client = createCoverArtArchiveClient({
    cache: noCache,
    sleep: noSleep,
    fetchImpl: async () => {
      calls += 1;
      return { ok: false, status: 403, headers: new Map() };
    },
  });
  await assert.rejects(
    () => client.getReleaseArtwork(releaseId),
    (error) => error.status === 403,
  );
  assert.equal(calls, 1);
});

test("Cover Art Archive client avoids fetch and retry entirely on a cached response", async () => {
  let calls = 0;
  const cachedArtwork = {
    resolvedArtwork: {
      thumbnailUrl: "https://coverartarchive.org/cached-500.jpg",
      detailUrl: "https://coverartarchive.org/cached-1200.jpg",
      source: "cover-art-archive",
      sourceUrl: `https://musicbrainz.org/release/${releaseId}`,
      retrievedAt: new Date().toISOString(),
    },
  };
  const client = createCoverArtArchiveClient({
    cache: { get: async () => cachedArtwork, set: async () => {} },
    sleep: noSleep,
    fetchImpl: async () => { calls += 1; return approvedFrontArtwork(); },
  });
  const artwork = await client.getReleaseArtwork(releaseId);
  assert.equal(artwork.thumbnailUrl, "https://coverartarchive.org/cached-500.jpg");
  assert.equal(calls, 0);
});
