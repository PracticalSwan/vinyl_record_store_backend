import test from "node:test";
import assert from "node:assert/strict";
import { createSessionToken } from "../src/lib/auth/session.js";
import { requireRole } from "../src/lib/auth/requireSession.js";
import {
  consumePreviewToken,
  createPreviewToken,
  __clearPreviewTokens,
} from "../src/lib/admin/previewTokens.js";
import {
  applyArtwork,
  applyCatalogImportToken,
  createAdminProduct,
  deleteAdminProduct,
  getAdminProduct,
  getAdminSummary,
  listAdminProducts,
  previewArtwork,
  previewCatalogImport,
  restoreAdminProduct,
  updateAdminProduct,
} from "../src/services/adminCatalog.js";
import {
  parseAdminProductCreate,
  parseAdminProductUpdate,
  parseArtworkApplyInput,
  parseImportApplyInput,
  parseImportPreviewInput,
} from "../src/validation/admin.js";
import { seedCatalogRepository } from "../src/repositories/seedCatalogRepository.js";

const secret = "test-auth-secret-with-at-least-thirty-two-characters";
const origin = "http://localhost:5173";
const seedEnvironment = { CATALOG_DATA_SOURCE: "seed", AUTH_SECRET: secret };
const mongoEnvironment = {
  AUTH_SECRET: secret,
  CATALOG_DATA_SOURCE: "mongodb",
  MONGODB_URI: "mongodb://localhost:27017",
  MONGODB_DB_NAME: "vinyl_record_store_test",
};

function request({ cookie } = {}) {
  const headers = new Headers({ origin });
  if (cookie) headers.set("cookie", cookie);
  return new Request("http://localhost:3000/api/admin/test", { headers });
}

function adminAccount() {
  return { publicId: "demo-admin", username: "admin", displayName: "Admin", role: "admin", active: true, preferences: {} };
}

function adminCookie(environment = { AUTH_SECRET: secret }) {
  const token = createSessionToken(adminAccount(), { environment });
  return `groovehaus_session=${encodeURIComponent(token)}`;
}

function customerAccount() {
  return { publicId: "demo-customer", username: "listener", displayName: null, role: "customer", active: true, preferences: {} };
}

// ---------- Authorization ----------

test("requireRole('admin') accepts an admin session and rejects a customer session", async () => {
  const environment = { AUTH_SECRET: secret };
  const adminRepo = { findByPublicId: async () => adminAccount() };
  const adminReq = request({ cookie: adminCookie(environment) });
  const resolved = await requireRole(adminReq, "admin", { environment, repository: adminRepo });
  assert.equal(resolved.role, "admin");

  const customerToken = createSessionToken(customerAccount(), { environment });
  const customerReq = request({ cookie: `groovehaus_session=${encodeURIComponent(customerToken)}` });
  const customerRepo = { findByPublicId: async () => customerAccount() };
  await assert.rejects(
    () => requireRole(customerReq, "admin", { environment, repository: customerRepo }),
    (error) => error.code === "FORBIDDEN",
  );
});

test("requireRole('admin') rejects anonymous requests as unauthenticated", async () => {
  await assert.rejects(
    () => requireRole(request(), "admin", { environment: { AUTH_SECRET: secret } }),
    (error) => error.code === "UNAUTHENTICATED",
  );
});

// ---------- Reads (real seed repository, no database) ----------

test("admin summary against the seed catalog returns honest counts", async () => {
  const { summary, recentActions } = await getAdminSummary({
    environment: seedEnvironment,
    auditRepository: { listRecentAuditActions: async () => [] },
  });
  assert.equal(summary.activeProducts, 116);
  assert.equal(summary.softDeleted, 0);
  assert.equal(summary.unresolvedArtwork, 116);
  assert.ok(summary.lowStock >= 0);
  assert.deepEqual(recentActions, []);
});

test("admin product list paginates and get returns a product or not-found", async () => {
  const page = await listAdminProducts({ page: 1, limit: 5, includeDeleted: false }, { environment: seedEnvironment });
  assert.equal(page.items.length, 5);
  assert.equal(page.total, 116);
  const product = await getAdminProduct(1, { environment: seedEnvironment });
  assert.equal(product.id, 1);
  await assert.rejects(
    () => getAdminProduct(999_999, { environment: seedEnvironment }),
    (error) => error.code === "NOT_FOUND",
  );
});

// ---------- Write gating ----------

test("admin writes are rejected when the catalog data source is seed", async () => {
  await assert.rejects(
    () => createAdminProduct(adminAccount(), { title: "X", artist: "Y", price: 10, stock: "in", condition: "M", format: "LP", source: "admin-manual" }, { environment: seedEnvironment }),
    (error) => error.code === "PERSISTENCE_UNAVAILABLE",
  );
});

// ---------- Create / update / delete / restore (stubbed mongo repo) ----------

function recordingAudit() {
  const calls = [];
  return {
    calls,
    auditRepository: { appendAuditLog: async (entry) => { calls.push(entry); } },
  };
}

test("create allocates a product through the mongo repository and records an audit entry", async () => {
  const { calls, auditRepository } = recordingAudit();
  const created = { id: 117, title: "New Album", artist: "New Artist" };
  const mongoRepository = {
    createProduct: async (desired) => ({ ...created, ...desired }),
  };
  const desired = { title: "New Album", artist: "New Artist", price: 10, stock: "in", condition: "M", format: "LP", source: "admin-manual" };
  const result = await createAdminProduct(adminAccount(), desired, {
    environment: mongoEnvironment,
    mongoRepository,
    auditRepository,
    requestId: "req-1",
  });
  assert.equal(result.id, 117);
  assert.equal(calls.length, 1);
  assert.equal(calls[0].action, "product.create");
  assert.equal(calls[0].adminUserPublicId, "demo-admin");
  assert.equal(calls[0].requestId, "req-1");
  assert.ok(calls[0].changedFields.includes("title"));
});

test("update returns the product on ok and surfaces conflicts and missing records", async () => {
  const { calls, auditRepository } = recordingAudit();
  const product = { id: 1, title: "Kind of Blue", updatedAt: "2026-01-01T00:00:00.000Z" };
  const okRepo = { updateProduct: async () => ({ status: "ok", product }) };
  const updated = await updateAdminProduct(adminAccount(), 1, { updatedAt: "2026-01-01T00:00:00.000Z", patch: { price: 50 } }, { environment: mongoEnvironment, mongoRepository: okRepo, auditRepository });
  assert.equal(updated.title, "Kind of Blue");
  assert.equal(calls[0].action, "product.update");

  const conflictRepo = { updateProduct: async () => ({ status: "conflict", current: product }) };
  await assert.rejects(
    () => updateAdminProduct(adminAccount(), 1, { updatedAt: "2026-01-01T00:00:00.000Z", patch: { price: 50 } }, { environment: mongoEnvironment, mongoRepository: conflictRepo, auditRepository }),
    (error) => error.code === "CONFLICT" && error.current?.id === 1,
  );

  const missingRepo = { updateProduct: async () => ({ status: "not_found" }) };
  await assert.rejects(
    () => updateAdminProduct(adminAccount(), 1, { updatedAt: "2026-01-01T00:00:00.000Z", patch: { price: 50 } }, { environment: mongoEnvironment, mongoRepository: missingRepo, auditRepository }),
    (error) => error.code === "NOT_FOUND",
  );
});

test("soft delete and restore go through the repository and audit", async () => {
  const { calls, auditRepository } = recordingAudit();
  const product = { id: 1, title: "Kind of Blue", deletedAt: "2026-07-07T00:00:00.000Z" };
  const deleteRepo = { softDeleteProduct: async () => ({ status: "ok", product }) };
  const deleted = await deleteAdminProduct(adminAccount(), 1, "2026-01-01T00:00:00.000Z", { environment: mongoEnvironment, mongoRepository: deleteRepo, auditRepository });
  assert.equal(deleted.deletedAt, product.deletedAt);
  assert.equal(calls[0].action, "product.delete");

  const restoreRepo = { restoreProduct: async () => ({ status: "ok", product: { ...product, deletedAt: null } }) };
  const restored = await restoreAdminProduct(adminAccount(), 1, { environment: mongoEnvironment, mongoRepository: restoreRepo, auditRepository });
  assert.equal(restored.deletedAt, null);
  assert.equal(calls[1].action, "product.restore");

  const missingRepo = { restoreProduct: async () => ({ status: "not_found" }) };
  await assert.rejects(
    () => restoreAdminProduct(adminAccount(), 1, { environment: mongoEnvironment, mongoRepository: missingRepo, auditRepository }),
    (error) => error.code === "NOT_FOUND",
  );
});

// ---------- Preview tokens ----------

test("preview tokens are one-time and expire", () => {
  __clearPreviewTokens();
  let now = 1_000_000;
  const token = createPreviewToken({ prepared: [1] }, { now: () => now, ttlMs: 1000 });
  assert.deepEqual(consumePreviewToken(token, { now: () => now }).prepared, [1]);
  // Consumed tokens cannot be reused.
  assert.throws(
    () => consumePreviewToken(token, { now: () => now }),
    (error) => error.code === "INVALID_INPUT",
  );
  // Expired tokens are rejected.
  now += 2000;
  const expired = createPreviewToken({ prepared: [2] }, { now: () => 0, ttlMs: 1000 });
  assert.throws(
    () => consumePreviewToken(expired, { now: () => now }),
    (error) => error.code === "INVALID_INPUT",
  );
});

// ---------- Import preview / apply (stubbed) ----------

test("import preview plans creates and returns a one-time token", async () => {
  const content = JSON.stringify([{ title: "Imported Album", artist: "Imported Artist", genre: "Jazz", year: 2020, price: 25, stock: "in", condition: "M", format: "LP", source: "admin-import" }]);
  let created = null;
  const mongoRepository = { listAllRawForImport: async () => [] };
  const tokenStore = { create: (payload) => { created = payload; return "preview-token"; } };
  const result = await previewCatalogImport(adminAccount(), { content, fileName: "catalog.json", enrich: false, allowPartial: false }, {
    environment: mongoEnvironment,
    mongoRepository,
    tokenStore,
  });
  assert.equal(result.summary.creates, 1);
  assert.equal(result.previewToken, "preview-token");
  assert.equal(created.fileName, "catalog.json");
});

test("import apply consumes the token and records an audit entry", async () => {
  const { calls, auditRepository } = recordingAudit();
  const summary = { creates: 1, updates: 0, skips: 0, warnings: 0, errors: 0, conflicts: 0 };
  const mongoRepository = {
    applyImport: async () => ({ summary, writes: 1, inserted: 1, modified: 0, allocatedPublicIds: [117] }),
  };
  const tokenStore = { consume: async () => ({ prepared: [], allowPartial: false }) };
  const result = await applyCatalogImportToken(adminAccount(), { token: "tok", allowPartial: false }, {
    environment: mongoEnvironment,
    mongoRepository,
    tokenStore,
    auditRepository,
    requestId: "req-import",
  });
  assert.equal(result.inserted, 1);
  assert.equal(calls[0].action, "catalog.import");
  assert.equal(calls[0].requestId, "req-import");
});

// ---------- Artwork preview / apply (stubbed external clients) ----------

function stubMusicBrainz() {
  const release = {
    id: "00000000-0000-0000-0000-000000000001",
    releaseGroupId: "00000000-0000-0000-0000-000000000002",
    title: "Kind of Blue",
    artistCreditPhrase: "Miles Davis",
    artistCredit: ["Miles Davis"],
    date: "1959-03-02",
    label: "Columbia",
    genres: ["Jazz"],
  };
  return {
    findReleaseCandidates: async () => [{ ...release, score: 99 }],
    getRelease: async () => release,
  };
}

function stubCoverArt() {
  return {
    getReleaseArtwork: async () => ({
      thumbnailUrl: "https://coverartarchive.org/release/00000000-0000-0000-0000-000000000001/front-250",
      detailUrl: "https://coverartarchive.org/release/00000000-0000-0000-0000-000000000001/front",
      source: "cover-art-archive",
      sourceUrl: "https://musicbrainz.org/release/00000000-0000-0000-0000-000000000001",
      retrievedAt: new Date("2026-07-07T00:00:00.000Z"),
    }),
  };
}

test("artwork preview resolves a release without writing", async () => {
  const repository = {
    findProductForAdmin: async () => ({ id: 1, title: "Kind of Blue", artist: "Miles Davis", year: 1959, musicBrainzReleaseId: null, musicBrainzReleaseGroupId: null }),
  };
  const result = await previewArtwork(adminAccount(), 1, {
    environment: seedEnvironment,
    repository,
    musicBrainz: stubMusicBrainz(),
    coverArt: stubCoverArt(),
  });
  assert.equal(result.release.id, "00000000-0000-0000-0000-000000000001");
  assert.ok(result.artwork.thumbnailUrl.includes("coverartarchive.org"));
});

test("artwork apply writes the resolved artwork and audits", async () => {
  const { calls, auditRepository } = recordingAudit();
  const current = { id: 1, title: "Kind of Blue", artist: "Miles Davis", year: 1959, musicBrainzReleaseId: null, musicBrainzReleaseGroupId: null };
  let writtenPatch = null;
  const mongoRepository = {
    findProductForAdmin: async () => current,
    updateProduct: async (_id, patch) => { writtenPatch = patch; return { status: "ok", product: { ...current, ...patch } }; },
  };
  const result = await applyArtwork(adminAccount(), 1, {
    releaseId: "00000000-0000-0000-0000-000000000001",
    updatedAt: "2026-01-01T00:00:00.000Z",
  }, {
    environment: mongoEnvironment,
    mongoRepository,
    musicBrainz: stubMusicBrainz(),
    coverArt: stubCoverArt(),
    auditRepository,
    requestId: "req-art",
  });
  assert.ok(writtenPatch.artwork.thumbnailUrl.includes("coverartarchive.org"));
  assert.equal(writtenPatch.musicBrainzReleaseId, "00000000-0000-0000-0000-000000000001");
  assert.equal(calls[0].action, "product.artwork");
});

test("artwork apply without a resolved artwork returns a conflict", async () => {
  const mongoRepository = {
    findProductForAdmin: async () => ({ id: 1, title: "Kind of Blue", artist: "Miles Davis", year: 1959, musicBrainzReleaseId: null, musicBrainzReleaseGroupId: null }),
    updateProduct: async () => ({ status: "ok", product: {} }),
  };
  const noArt = { getReleaseArtwork: async () => null };
  await assert.rejects(
    () => applyArtwork(adminAccount(), 1, { releaseId: "00000000-0000-0000-0000-000000000001", updatedAt: "2026-01-01T00:00:00.000Z" }, {
      environment: mongoEnvironment,
      mongoRepository,
      musicBrainz: stubMusicBrainz(),
      coverArt: noArt,
    }),
    (error) => error.code === "CONFLICT",
  );
});

// ---------- Validation ----------

test("create validation accepts a complete product and rejects unknown fields", () => {
  const desired = parseAdminProductCreate({
    title: "Album", artist: "Artist", genre: "Jazz", year: 2020, price: 25, stock: "in", condition: "M", format: "LP", source: "admin",
  });
  assert.equal(desired.title, "Album");
  assert.equal(desired.currency, "USD");
  assert.throws(
    () => parseAdminProductCreate({ title: "X", artist: "Y", price: 10, stock: "in", condition: "M", format: "LP", source: "s", unexpected: true }),
    /unsupported fields/,
  );
  assert.throws(() => parseAdminProductCreate({ artist: "Y", price: 10, stock: "in", condition: "M", format: "LP", source: "s" }), /title is required/);
});

test("update validation requires updatedAt and at least one field", () => {
  const { updatedAt, patch } = parseAdminProductUpdate({ updatedAt: "2026-01-01T00:00:00.000Z", price: 30 });
  assert.equal(patch.price, 30);
  assert.equal(updatedAt, "2026-01-01T00:00:00.000Z");
  assert.throws(() => parseAdminProductUpdate({ price: 30 }), /updatedAt is required/);
  assert.throws(() => parseAdminProductUpdate({ updatedAt: "2026-01-01T00:00:00.000Z" }), /At least one product field/);
});

test("import preview and apply input validation enforce shape", () => {
  const preview = parseImportPreviewInput({ content: "[]", fileName: "catalog.json" });
  assert.equal(preview.enrich, false);
  assert.throws(() => parseImportPreviewInput({ content: "[]", fileName: "catalog.txt" }), /\.csv or \.json/);
  assert.throws(() => parseImportPreviewInput({ content: "", fileName: "catalog.json" }), /non-empty/);
  const apply = parseImportApplyInput({ token: "tok" });
  assert.equal(apply.token, "tok");
  assert.equal(apply.allowPartial, false);
});

test("artwork apply input requires a valid release id and updatedAt", () => {
  const validRelease = "123e4567-e89b-12d3-a456-426614174000";
  const parsed = parseArtworkApplyInput({ releaseId: validRelease, updatedAt: "2026-01-01T00:00:00.000Z" });
  assert.equal(parsed.releaseId, validRelease);
  assert.throws(() => parseArtworkApplyInput({ releaseId: "not-a-uuid", updatedAt: "2026-01-01T00:00:00.000Z" }), /UUID/);
  assert.throws(() => parseArtworkApplyInput({ releaseId: validRelease }), /updatedAt is required/);
});
