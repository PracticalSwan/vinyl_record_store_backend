import { getCatalogDataSource, getCatalogRepository } from "../lib/db/dataSource.js";
import { conflict, notFound, persistenceUnavailable } from "../lib/errors.js";
import {
  consumePreviewToken,
  createPreviewToken,
} from "../lib/admin/previewTokens.js";
import { mongoCatalogRepository } from "../repositories/mongoCatalogRepository.js";
import { eventRepository } from "../repositories/eventRepository.js";
import { parseCatalogImport } from "../lib/catalog/parseImport.js";
import {
  planCatalogImport,
  prepareCatalogImport,
  summarizeCatalogImport,
} from "./catalogImport.js";
import { resolveArtworkForProduct } from "./artworkRefresh.js";

const AUDIT_SUMMARY_MAX = 500;
const PREVIEW_ACTION_SAMPLE_MAX = 200;

function requireMongo(environment) {
  if (getCatalogDataSource(environment) !== "mongodb") throw persistenceUnavailable();
}

function clipSummary(value) {
  const text = String(value || "");
  return text.length > AUDIT_SUMMARY_MAX ? `${text.slice(0, AUDIT_SUMMARY_MAX - 1)}…` : text;
}

// Audit is best-effort. A flaky audit store must not roll back a successful
// catalog mutation; the mutation is the source of truth and audit is secondary.
async function recordAudit({ auditRepository, admin, action, entityPublicId, changedFields, summary, requestId }) {
  if (!auditRepository) return;
  try {
    await auditRepository.appendAuditLog({
      adminUserPublicId: admin.publicId,
      action,
      entityType: "product",
      entityPublicId: String(entityPublicId),
      requestId: requestId || "unknown",
      changedFields: changedFields || [],
      summary: clipSummary(summary),
    });
  } catch (error) {
    // Best-effort: a flaky audit store must not roll back the mutation. Log so a
    // genuinely broken audit store is observable during classroom debugging.
    console.error("[adminCatalog] audit log write failed", error?.message || error);
  }
}

function publicAction(action) {
  return {
    rowNumber: action.rowNumber,
    action: action.type,
    publicId: action.publicId ?? null,
    reason: action.reason || null,
    errors: action.errors || [],
    warnings: action.warnings || [],
  };
}

export async function getAdminSummary({
  environment = process.env,
  repository = getCatalogRepository(environment),
  auditRepository = eventRepository,
} = {}) {
  const summary = await repository.adminSummary();
  let recentActions = [];
  try {
    recentActions = await auditRepository.listRecentAuditActions(10);
  } catch {
    // Seed-catalog mode has no audit store; the dashboard still renders counts.
    recentActions = [];
  }
  return { summary, recentActions };
}

export async function listAdminProducts(query, {
  environment = process.env,
  repository = getCatalogRepository(environment),
} = {}) {
  return repository.listProductsForAdmin(query);
}

export async function getAdminProduct(publicId, {
  environment = process.env,
  repository = getCatalogRepository(environment),
} = {}) {
  const product = await repository.findProductForAdmin(publicId);
  if (!product) throw notFound("That product was not found.");
  return product;
}

export async function createAdminProduct(admin, desired, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const product = await mongoRepository.createProduct(desired);
  await recordAudit({
    auditRepository,
    admin,
    action: "product.create",
    entityPublicId: product.id,
    changedFields: Object.keys(desired),
    summary: `Created product ${product.id} (${product.title} by ${product.artist}).`,
    requestId,
  });
  return product;
}

export async function updateAdminProduct(admin, publicId, { updatedAt, patch }, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const result = await mongoRepository.updateProduct(publicId, patch, updatedAt);
  if (result.status === "not_found") throw notFound("That product was not found.");
  if (result.status === "conflict") {
    const error = conflict("This product was changed by another administrator. Review the current record before editing again.");
    // The current record is attached for service-level/test consumers. The HTTP
    // envelope serializes only code/message, so the frontend refetches on 409.
    error.current = result.current ?? null;
    throw error;
  }
  await recordAudit({
    auditRepository,
    admin,
    action: "product.update",
    entityPublicId: publicId,
    changedFields: Object.keys(patch),
    summary: `Updated product ${publicId} (${result.product.title}).`,
    requestId,
  });
  return result.product;
}

export async function deleteAdminProduct(admin, publicId, updatedAt, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const result = await mongoRepository.softDeleteProduct(publicId, updatedAt);
  if (result.status === "not_found") throw notFound("That product was not found.");
  if (result.status === "conflict") {
    const error = conflict("This product was changed by another administrator. Review the current record before deleting it.");
    error.current = result.current ?? null;
    throw error;
  }
  await recordAudit({
    auditRepository,
    admin,
    action: "product.delete",
    entityPublicId: publicId,
    changedFields: ["deletedAt"],
    summary: `Soft-deleted product ${publicId}.`,
    requestId,
  });
  return result.product;
}

export async function restoreAdminProduct(admin, publicId, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const result = await mongoRepository.restoreProduct(publicId);
  if (result.status === "not_found") throw notFound("That product was not found or is not soft-deleted.");
  await recordAudit({
    auditRepository,
    admin,
    action: "product.restore",
    entityPublicId: publicId,
    changedFields: ["deletedAt"],
    summary: `Restored product ${publicId}.`,
    requestId,
  });
  return result.product;
}

export async function previewCatalogImport(admin, input, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  tokenStore = { create: createPreviewToken },
  requestId,
} = {}) {
  requireMongo(environment);
  const rows = parseCatalogImport(input.content, input.fileName);
  const prepared = await prepareCatalogImport(rows, { enabled: input.enrich });
  // Plan against the live catalog so duplicate/conflict detection reflects the
  // current state the apply will write into.
  const existing = await mongoRepository.listAllRawForImport();
  const actions = planCatalogImport(prepared, existing);
  const summary = summarizeCatalogImport(actions);
  const token = tokenStore.create({ prepared, allowPartial: input.allowPartial, fileName: input.fileName });
  return {
    summary,
    actions: actions.map(publicAction).slice(0, PREVIEW_ACTION_SAMPLE_MAX),
    totalActions: actions.length,
    previewToken: token,
  };
}

export async function applyCatalogImportToken(admin, { token, allowPartial }, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  tokenStore = { consume: consumePreviewToken },
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const payload = tokenStore.consume(token);
  const usePartial = allowPartial || payload.allowPartial || false;
  const result = await mongoRepository.applyImport(payload.prepared, { allowPartial: usePartial });
  await recordAudit({
    auditRepository,
    admin,
    action: "catalog.import",
    entityPublicId: "catalog",
    changedFields: [],
    summary: `Catalog import applied: ${result.summary.creates} created, ${result.summary.updates} updated, ${result.summary.skips} unchanged.`,
    requestId,
  });
  return {
    writes: result.writes,
    inserted: result.inserted,
    modified: result.modified,
    allocatedPublicIds: result.allocatedPublicIds,
    summary: result.summary,
  };
}

export async function previewArtwork(admin, publicId, {
  environment = process.env,
  repository = getCatalogRepository(environment),
  musicBrainz,
  coverArt,
} = {}) {
  const product = await repository.findProductForAdmin(publicId);
  if (!product) throw notFound("That product was not found.");
  const resolution = await resolveArtworkForProduct(
    { title: product.title, artist: product.artist, year: product.year, musicBrainzReleaseId: product.musicBrainzReleaseId, musicBrainzReleaseGroupId: product.musicBrainzReleaseGroupId },
    { musicBrainz, coverArt },
  );
  return {
    product,
    release: resolution.release,
    artwork: resolution.artwork,
    warnings: resolution.warnings,
  };
}

export async function applyArtwork(admin, publicId, { releaseId, updatedAt }, {
  environment = process.env,
  mongoRepository = mongoCatalogRepository,
  musicBrainz,
  coverArt,
  auditRepository = eventRepository,
  requestId,
} = {}) {
  requireMongo(environment);
  const current = await mongoRepository.findProductForAdmin(publicId);
  if (!current) throw notFound("That product was not found.");
  const resolution = await resolveArtworkForProduct(
    { title: current.title, artist: current.artist, year: current.year, musicBrainzReleaseId: current.musicBrainzReleaseId, musicBrainzReleaseGroupId: current.musicBrainzReleaseGroupId },
    { musicBrainz, coverArt, releaseId },
  );
  if (!resolution.artwork) {
    const error = conflict("No approved artwork could be resolved for the selected release.");
    error.warnings = resolution.warnings;
    throw error;
  }
  const now = new Date();
  const patch = {
    artwork: resolution.artwork,
    musicBrainzReleaseId: resolution.release?.id || current.musicBrainzReleaseId || null,
    musicBrainzReleaseGroupId: resolution.release?.releaseGroupId || current.musicBrainzReleaseGroupId || null,
  };
  const result = await mongoRepository.updateProduct(publicId, patch, updatedAt);
  if (result.status === "not_found") throw notFound("That product was not found.");
  if (result.status === "conflict") {
    const error = conflict("This product was changed by another administrator. Review the current record before refreshing artwork.");
    error.current = result.current ?? null;
    throw error;
  }
  await recordAudit({
    auditRepository,
    admin,
    action: "product.artwork",
    entityPublicId: publicId,
    changedFields: ["artwork", "musicBrainzReleaseId", "musicBrainzReleaseGroupId"],
    summary: `Refreshed artwork for product ${publicId} from release ${resolution.release?.id}.`,
    requestId,
  });
  return result.product;
}
