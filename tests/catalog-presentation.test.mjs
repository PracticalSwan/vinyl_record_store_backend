import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildMongoCatalogFilter, createMongoCatalogRepository } from "../src/repositories/mongoCatalogRepository.js";
import { toPublicProduct } from "../src/repositories/catalogMapping.js";

const overlay = JSON.parse(await readFile(
  new URL("../src/data/catalogPresentationOverlay.json", import.meta.url),
  "utf8",
));

const baseQuery = {
  page: 1, limit: 24, q: "", genres: [], artist: "", label: "",
  conditions: [], formats: [], eras: [], minPrice: null, maxPrice: null,
  inStock: "", sort: "newest",
};

test("active research catalog filter excludes only presentation duplicates", () => {
  const active = buildMongoCatalogFilter(baseQuery, { datasetKey: overlay.datasetKey });
  assert.deepEqual(active.publicId, { $nin: overlay.hiddenPublicIds });
  const ordinary = buildMongoCatalogFilter(baseQuery, { datasetKey: null });
  assert.equal(ordinary.publicId, undefined);
});

test("public mapping removes duplicated artist prefixes without damaging legitimate repeated names", () => {
  assert.equal(toPublicProduct({ publicId: 900001, title: "Moanin'", artist: "Art Blakey Art Blakey and the Jazz Messengers" }).artist, "Art Blakey and the Jazz Messengers");
  assert.equal(toPublicProduct({ publicId: 900002, title: "Rio", artist: "Duran Duran" }).artist, "Duran Duran");
  assert.equal(toPublicProduct({ publicId: 900003, title: "Dizzy Up The Girl", artist: "Goo Goo Dolls" }).artist, "Goo Goo Dolls");
});

test("Mongo recommendation candidates use the same presentation visibility filter", async () => {
  let candidateFilter = null;
  const datasetImportModel = {
    findOne: () => ({ lean: () => ({ exec: async () => ({ datasetKey: overlay.datasetKey, productCollection: "datasetProducts" }) }) }),
  };
  const datasetProductModel = {
    find(filter) {
      candidateFilter = filter;
      return { sort: () => ({ limit: () => ({ lean: () => ({ exec: async () => [] }) }) }) };
    },
  };
  const repository = createMongoCatalogRepository({}, async () => {}, datasetImportModel, datasetProductModel);
  await repository.listRecommendationCandidates();
  assert.deepEqual(candidateFilter.publicId, { $nin: overlay.hiddenPublicIds });
});

test("catalog HTTP policy advertises short-lived durable query-keyed CDN caching", async () => {
  const policy = await import("../src/lib/catalogCachePolicy.js").catch(() => ({}));
  assert.equal(typeof policy.catalogCacheHeaders, "function");
  assert.deepEqual(policy.catalogCacheHeaders(), {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=600",
    "Netlify-Vary": "query",
  });
});

test("public mapping uses supplemental album artwork only when sealed artwork is absent", () => {
  const product = toPublicProduct({
    publicId: 255248,
    datasetKey: overlay.datasetKey,
    title: "Pale Communion",
    artist: "Opeth",
    artwork: null,
  });
  assert.deepEqual(product.image, {
    thumbnailUrl: "https://coverartarchive.org/release-group/d7605e9c-8a96-4a41-9cf6-f45f80de112f/front-500",
    detailUrl: "https://coverartarchive.org/release-group/d7605e9c-8a96-4a41-9cf6-f45f80de112f/front-1200",
    source: "cover-art-archive",
    sourceUrl: "https://musicbrainz.org/release-group/d7605e9c-8a96-4a41-9cf6-f45f80de112f",
  });
});

test("sealed structured artwork takes precedence over supplemental presentation artwork", () => {
  const product = toPublicProduct({
    publicId: 255248,
    datasetKey: overlay.datasetKey,
    title: "Pale Communion",
    artist: "Opeth",
    artwork: {
      thumbnailUrl: "https://coverartarchive.org/release/sealed/cover-500.jpg",
      detailUrl: "https://coverartarchive.org/release/sealed/cover-1200.jpg",
      source: "cover-art-archive",
      sourceUrl: "https://musicbrainz.org/release/sealed",
    },
  });
  assert.equal(product.image.thumbnailUrl, "https://coverartarchive.org/release/sealed/cover-500.jpg");
  assert.equal(product.image.sourceUrl, "https://musicbrainz.org/release/sealed");
});

test("presentation artwork matcher accepts exactly one high-confidence album group", async () => {
  const enrichment = await import("../src/lib/catalog/presentationEnrichment.js").catch(() => ({}));
  assert.equal(typeof enrichment.selectPresentationReleaseGroup, "function");
  const selected = enrichment.selectPresentationReleaseGroup(
    { title: "Pale Communion [LP]", artist: "Opeth" },
    [{ id: "33333333-3333-4333-8333-333333333333", title: "Pale Communion", score: 100, primaryType: "Album", artistCreditPhrase: "Opeth" }],
  );
  assert.equal(selected?.id, "33333333-3333-4333-8333-333333333333");
});

test("presentation artwork matcher rejects ambiguous or weak album groups", async () => {
  const { selectPresentationReleaseGroup } = await import("../src/lib/catalog/presentationEnrichment.js");
  const row = { title: "Abbey Road", artist: "The Beatles" };
  const valid = (id) => ({ id, title: "Abbey Road", score: 100, primaryType: "Album", artistCreditPhrase: "The Beatles" });
  assert.equal(selectPresentationReleaseGroup(row, [valid("33333333-3333-4333-8333-333333333333"), valid("44444444-4444-4444-8444-444444444444")]), null);
  assert.equal(selectPresentationReleaseGroup(row, [{ ...valid("33333333-3333-4333-8333-333333333333"), score: 90 }]), null);
});

test("public mapping removes retail-only title markers without erasing edition details", () => {
  assert.equal(toPublicProduct({ publicId: 900004, title: "American Teen Explicit Lyrics", artist: "Khalid" }).title, "American Teen");
  assert.equal(toPublicProduct({ publicId: 900005, title: "Blues Walk (Blue Note Classic Vinyl Series)[LP]", artist: "Lou Donaldson" }).title, "Blues Walk (Blue Note Classic Vinyl Series)");
  assert.equal(toPublicProduct({ publicId: 900006, title: "Blue Train [Mono LP]", artist: "John Coltrane" }).title, "Blue Train [Mono LP]");
  assert.equal(toPublicProduct({ publicId: 900007, title: "Whitesnake (30th Anniversary Deluxe Edition)", artist: "Whitesnake" }).title, "Whitesnake (30th Anniversary Deluxe Edition)");
});

test("presentation overlay is internally consistent and auditable", () => {
  assert.deepEqual(overlay.hiddenPublicIds, [...overlay.hiddenPublicIds].sort((a, b) => a - b));
  assert.equal(new Set(overlay.hiddenPublicIds).size, overlay.hiddenPublicIds.length);
  const hidden = new Set(overlay.hiddenPublicIds.map(String));
  for (const [publicId, artwork] of Object.entries(overlay.supplementalArtwork)) {
    assert.equal(hidden.has(publicId), false);
    assert.match(publicId, /^[1-9][0-9]*$/);
    assert.match(artwork.releaseGroupId, /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    assert.ok(Number(artwork.matchScore) >= 95);
  }
});

test("product detail cache policy uses the path identity without query variation", async () => {
  const { productDetailCacheHeaders } = await import("../src/lib/catalogCachePolicy.js");
  assert.equal(typeof productDetailCacheHeaders, "function");
  assert.deepEqual(productDetailCacheHeaders(), {
    "Cache-Control": "public, max-age=0, must-revalidate",
    "Netlify-CDN-Cache-Control": "public, durable, s-maxage=300, stale-while-revalidate=600",
  });
});
