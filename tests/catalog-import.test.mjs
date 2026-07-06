import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalogImport, parseCsv } from "../src/lib/catalog/parseImport.js";
import { normalizeAndValidateImportRow } from "../src/lib/catalog/validateImport.js";
import {
  applyCatalogImport,
  enrichCatalogRows,
  planCatalogImport,
  prepareCatalogImport,
  summarizeCatalogImport,
} from "../src/services/catalogImport.js";

const baseRow = (overrides = {}) => ({
  publicId: 500,
  title: "  Test   Record ",
  artist: "Test Artist",
  genre: "hip hop",
  year: 2025,
  price: "29.50",
  currency: "usd",
  stock: "in stock",
  condition: "nm",
  label: "Test Label",
  format: "lp",
  pressing: "2025 US pressing",
  description: "A controlled import fixture.",
  source: "catalog-import",
  ...overrides,
});

const existingFrom = (value, overrides = {}) => ({
  ...value,
  slug: `test-record-${value.publicId}`,
  deletedAt: null,
  artwork: value.artwork || {},
  provenance: value.provenance || [],
  ...overrides,
});

test("CSV and JSON imports preserve quoted values and reject malformed envelopes", () => {
  const csv = 'title,description\r\n"Record, One","Line one\nline two"\r\n';
  assert.deepEqual(parseCsv(csv), [{ title: "Record, One", description: "Line one\nline two" }]);
  assert.deepEqual(parseCatalogImport('[{"title":"One"}]', "catalog.json"), [{ title: "One" }]);
  assert.throws(() => parseCatalogImport('{"items":[]}', "catalog.json"), /records array/);
  assert.throws(() => parseCsv('a,a\n1,2'), /headers must be unique/);
});

test("normalization is bounded, controlled, and rejects unapproved artwork hosts", () => {
  const valid = normalizeAndValidateImportRow(baseRow(), 1, { currentYear: 2026 });
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.value.title, "Test Record");
  assert.equal(valid.value.genre, "Hip-Hop");
  assert.equal(valid.value.stock, "in");
  assert.equal(valid.value.condition, "NM");
  assert.equal(valid.value.format, "LP, 33 1/3 rpm");
  assert.equal(valid.value.price, 29.5);

  const invalid = normalizeAndValidateImportRow(baseRow({
    price: -1,
    year: 1899,
    artwork: {
      thumbnailUrl: "https://images.example.com/cover.jpg",
      detailUrl: "https://images.example.com/cover-large.jpg",
      source: "cover-art-archive",
      sourceUrl: "https://musicbrainz.org/release/example",
    },
  }), 2, { currentYear: 2026 });
  assert.ok(invalid.errors.some((error) => error.code === "INVALID_PRICE"));
  assert.ok(invalid.errors.some((error) => error.code === "INVALID_YEAR"));
  assert.ok(invalid.errors.some((error) => error.code === "UNAPPROVED_ARTWORK_URL"));
});

test("the import contract accepts only store-required fields and rejects invalid supplied metadata", () => {
  const minimal = normalizeAndValidateImportRow({
    title: "Minimal Record",
    artist: "Test Artist",
    price: 20,
    stock: "in",
    condition: "NM",
    format: "LP",
    source: "catalog-import",
  }, 1, { currentYear: 2026 });
  assert.equal(minimal.errors.length, 0);
  assert.equal(minimal.value.genre, null);
  assert.equal(minimal.value.year, null);
  assert.equal(minimal.value.label, null);
  assert.equal(minimal.value.description, null);

  const invalid = normalizeAndValidateImportRow({
    ...baseRow(),
    genre: "invented genre",
    year: "unknown",
  }, 2, { currentYear: 2026 });
  assert.ok(invalid.errors.some((error) => error.code === "UNSUPPORTED_GENRE"));
  assert.ok(invalid.errors.some((error) => error.code === "INVALID_YEAR"));
});

test("supplied artwork must match an imported release and receives server-owned provenance", () => {
  const releaseId = "11111111-1111-4111-8111-111111111111";
  const retrievedAt = new Date("2026-07-06T00:00:00.000Z");
  const valid = normalizeAndValidateImportRow(baseRow({
    musicBrainzReleaseId: releaseId,
    artwork: {
      thumbnailUrl: `https://coverartarchive.org/release/${releaseId}/front-500.jpg`,
      detailUrl: `https://coverartarchive.org/release/${releaseId}/front-1200.jpg`,
      source: "cover-art-archive",
      sourceUrl: `https://musicbrainz.org/release/${releaseId}`,
      retrievedAt: "2000-01-01T00:00:00.000Z",
    },
  }), 1, { currentYear: 2026, now: () => retrievedAt });
  assert.equal(valid.errors.length, 0);
  assert.equal(valid.value.artwork.retrievedAt, retrievedAt);
  assert.deepEqual(valid.value.provenance, [{
    field: "artwork",
    source: "cover-art-archive",
    sourceId: releaseId,
    retrievedAt,
  }]);

  const mismatched = normalizeAndValidateImportRow(baseRow({
    musicBrainzReleaseId: releaseId,
    artwork: {
      thumbnailUrl: "https://coverartarchive.org/release/22222222-2222-4222-8222-222222222222/front-500.jpg",
      detailUrl: "https://coverartarchive.org/release/22222222-2222-4222-8222-222222222222/front-1200.jpg",
      source: "cover-art-archive",
      sourceUrl: "https://musicbrainz.org/release/22222222-2222-4222-8222-222222222222",
    },
  }), 2, { currentYear: 2026 });
  assert.ok(mismatched.errors.some((error) => error.code === "ARTWORK_RELEASE_MISMATCH"));
});

test("planning reports every duplicate, pressing ambiguity, ownership conflict, update, and skip", async () => {
  const [prepared] = await prepareCatalogImport([baseRow()], { currentYear: 2026 });
  const existing = existingFrom(prepared.value);
  const skip = planCatalogImport([prepared], [existing]);
  assert.equal(skip[0].type, "skip");

  const changed = await prepareCatalogImport([baseRow({ price: 31 })], { currentYear: 2026 });
  assert.equal(planCatalogImport(changed, [existing])[0].type, "update");
  assert.equal(
    planCatalogImport(changed, [{ ...existing, source: "admin" }])[0].reason,
    "source-owned",
  );
  assert.equal(
    planCatalogImport(changed, [{ ...existing, publicId: 501 }])[0].reason,
    "public-id-mismatch",
  );

  const newPressing = await prepareCatalogImport([
    baseRow({ publicId: null, pressing: "2026 EU reissue" }),
  ], { currentYear: 2026 });
  assert.equal(planCatalogImport(newPressing, [existing])[0].reason, "pressing-review-required");

  const duplicates = await prepareCatalogImport([baseRow(), baseRow({ price: 30 })], { currentYear: 2026 });
  const duplicatePlan = planCatalogImport(duplicates, []);
  assert.equal(summarizeCatalogImport(duplicatePlan).errors, 1);
  assert.ok(duplicatePlan[1].errors.some((error) => error.code === "DUPLICATE_IMPORT_ROW"));
});

test("a shared release group with a different pressing triggers pressing review instead of overwriting", async () => {
  const [prepared] = await prepareCatalogImport([baseRow()], { currentYear: 2026 });
  const existing = existingFrom(prepared.value, {
    musicBrainzReleaseId: "11111111-1111-4111-8111-111111111111",
    musicBrainzReleaseGroupId: "22222222-2222-4222-8222-222222222222",
  });
  const differentPressing = await prepareCatalogImport([
    baseRow({
      publicId: null,
      pressing: "2026 EU reissue",
      musicBrainzReleaseId: "33333333-3333-4333-8333-333333333333",
      musicBrainzReleaseGroupId: "22222222-2222-4222-8222-222222222222",
    }),
  ], { currentYear: 2026 });
  const action = planCatalogImport(differentPressing, [existing])[0];
  assert.equal(action.type, "conflict");
  assert.equal(action.reason, "pressing-review-required");
});

test("enrichment accepts one exact release, preserves store fields, and records approved artwork provenance", async () => {
  const [validated] = await prepareCatalogImport([baseRow({ publicId: null })], { currentYear: 2026 });
  const release = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Test Record",
    score: 100,
    date: "2025-02-01",
    artistCredit: ["Test Artist"],
    releaseGroupId: "22222222-2222-4222-8222-222222222222",
  };
  const enriched = await enrichCatalogRows([validated], {
    enabled: true,
    musicBrainz: {
      findReleaseCandidates: async () => [release],
      getRelease: async () => release,
    },
    coverArt: {
      getReleaseArtwork: async () => ({
        url: "https://coverartarchive.org/release/example/cover-1200.jpg",
        thumbnailUrl: "https://coverartarchive.org/release/example/cover-500.jpg",
        detailUrl: "https://coverartarchive.org/release/example/cover-1200.jpg",
        source: "cover-art-archive",
        sourceUrl: `https://musicbrainz.org/release/${release.id}`,
        retrievedAt: new Date("2026-07-06T00:00:00.000Z"),
      }),
    },
    now: () => new Date("2026-07-06T00:00:00.000Z"),
  });
  const value = enriched[0].value;
  assert.equal(value.price, 29.5, "external metadata must not replace store price");
  assert.equal(value.stock, "in", "external metadata must not replace store stock");
  assert.equal(value.musicBrainzReleaseId, release.id);
  assert.equal(value.artwork.source, "cover-art-archive");
  assert.ok(value.provenance.some((item) => item.field === "artwork"));
});

test("enrichment fills optional metadata from verified release detail without replacing store values", async () => {
  const [validated] = await prepareCatalogImport([{
    title: "Test Record",
    artist: "Test Artist",
    price: 20,
    stock: "in",
    condition: "NM",
    format: "LP",
    source: "catalog-import",
  }], { currentYear: 2026 });
  const release = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Test Record",
    score: 100,
    date: "2025-02-01",
    artistCredit: ["Test Artist"],
    artistCreditPhrase: "Test Artist",
    releaseGroupId: "22222222-2222-4222-8222-222222222222",
    label: "Verified Label",
    genres: ["hip hop"],
  };
  const enriched = await enrichCatalogRows([validated], {
    enabled: true,
    musicBrainz: {
      findReleaseCandidates: async () => [release],
      getRelease: async () => release,
    },
    coverArt: { getReleaseArtwork: async () => null },
    now: () => new Date("2026-07-06T00:00:00.000Z"),
  });
  assert.equal(enriched[0].value.year, 2025);
  assert.equal(enriched[0].value.label, "Verified Label");
  assert.equal(enriched[0].value.genre, "Hip-Hop");
  assert.ok(enriched[0].value.provenance.some((item) => item.field === "year"));
  assert.ok(enriched[0].value.provenance.some((item) => item.field === "label"));
  assert.ok(enriched[0].value.provenance.some((item) => item.field === "genre"));
});

test("ambiguous matches and external outages keep a usable placeholder without inventing a match", async () => {
  const [validated] = await prepareCatalogImport([baseRow({ publicId: null })], { currentYear: 2026 });
  const candidate = {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Test Record",
    score: 100,
    date: "2025",
    artistCredit: ["Test Artist"],
    releaseGroupId: null,
  };
  const ambiguous = await enrichCatalogRows([validated], {
    enabled: true,
    musicBrainz: { findReleaseCandidates: async () => [candidate, { ...candidate, id: "33333333-3333-4333-8333-333333333333" }] },
    coverArt: { getReleaseArtwork: async () => assert.fail("artwork must not run for ambiguity") },
  });
  assert.equal(ambiguous[0].value.musicBrainzReleaseId, null);
  assert.equal(ambiguous[0].value.artwork.thumbnailUrl, undefined);
  assert.ok(ambiguous[0].warnings.some((warning) => warning.code === "AMBIGUOUS_MUSICBRAINZ_MATCH"));

  const unavailable = await enrichCatalogRows([validated], {
    enabled: true,
    musicBrainz: { findReleaseCandidates: async () => { throw Object.assign(new Error("offline"), { service: "musicbrainz" }); } },
  });
  assert.equal(unavailable[0].errors.length, 0);
  assert.ok(unavailable[0].warnings.some((warning) => warning.code === "EXTERNAL_SERVICE_UNAVAILABLE"));
});

function chain(value) {
  const query = {};
  query.session = () => query;
  query.lean = () => query;
  query.exec = async () => value;
  return query;
}

test("apply is transactional, allocates collision-free IDs, and refuses an invalid atomic batch", async () => {
  const prepared = await prepareCatalogImport([
    baseRow({ publicId: 900 }),
    baseRow({ publicId: null, title: "Second Record", pressing: "2025 EU pressing" }),
  ], { currentYear: 2026 });
  const operations = [];
  let transactions = 0;
  const model = {
    find: () => chain([]),
    bulkWrite: async (value) => {
      operations.push(...value);
      return { insertedCount: value.length, matchedCount: 0, modifiedCount: 0 };
    },
  };
  const counterModel = {
    findOneAndUpdate: () => ({ lean: () => chain({ value: 901 }) }),
  };
  const session = {
    withTransaction: async (callback) => { transactions += 1; await callback(); },
    endSession: async () => {},
  };
  const result = await applyCatalogImport(prepared, {
    connection: { startSession: async () => session },
    model,
    counterModel,
  });
  assert.equal(transactions, 1);
  assert.deepEqual(result.allocatedPublicIds, [901]);
  assert.deepEqual(
    operations.map((operation) => operation.insertOne.document.publicId),
    [900, 901],
  );

  const invalid = await prepareCatalogImport([baseRow({ price: -1 })], { currentYear: 2026 });
  await assert.rejects(
    () => applyCatalogImport(invalid, {
      connection: { startSession: async () => session },
      model,
      counterModel,
    }),
    /errors or conflicts/,
  );
  assert.equal(operations.length, 2, "invalid atomic import must not add writes");
});
