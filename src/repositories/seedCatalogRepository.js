import { catalogRecords as records } from "../data/catalogRecords.js";
import { PRODUCT_CONDITIONS, PRODUCT_GENRES, PRODUCT_STOCK_LEVELS } from "../models/constants.js";
import { toAdminProduct, toPublicProduct } from "./catalogMapping.js";

const text = (value) => String(value || "").trim().toLowerCase();
const CURRENT_CENTURY_START = 2000;
const MAX_RECOMMENDATION_CANDIDATES = 1_000;

function matchesEra(year, eras) {
  if (!eras.length) return true;
  return eras.some((era) => {
    if (era === "2000s+") return year >= CURRENT_CENTURY_START;
    const decade = Number.parseInt(era, 10);
    return Number.isInteger(decade) && year >= decade && year < decade + 10;
  });
}

function eraOf(year) {
  if (year >= CURRENT_CENTURY_START) return "2000s+";
  return `${Math.floor(year / 10) * 10}s`;
}

function matches(record, query) {
  const searchable = `${record.title} ${record.artist} ${record.genre} ${record.label}`.toLowerCase();
  if (query.q && !searchable.includes(query.q.toLowerCase())) return false;
  if (query.genres.length && !query.genres.includes(record.genre)) return false;
  if (query.artist && !text(record.artist).includes(query.artist)) return false;
  if (query.label && !text(record.label).includes(query.label)) return false;
  if (query.conditions.length && !query.conditions.includes(record.condition)) return false;
  if (!matchesEra(record.year, query.eras)) return false;
  if (query.minPrice !== null && record.price < query.minPrice) return false;
  if (query.maxPrice !== null && record.price > query.maxPrice) return false;
  if (query.inStock === "true" && record.stock === "out") return false;
  if (query.inStock === "false" && record.stock !== "out") return false;
  return true;
}

function compareProducts(a, b, sort) {
  if (sort === "price-asc") return a.price - b.price || a.id - b.id;
  if (sort === "price-desc") return b.price - a.price || a.id - b.id;
  if (sort === "artist-asc") return a.artist.localeCompare(b.artist) || a.id - b.id;
  return b.year - a.year || a.id - b.id;
}

function countValues(source, values, selector) {
  return values.map((value) => ({
    value,
    count: source.filter((record) => selector(record) === value).length,
  }));
}

function buildFacets(source) {
  const prices = source.map((record) => record.price);
  return {
    genres: countValues(source, PRODUCT_GENRES, (record) => record.genre),
    eras: countValues(source, ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s+"], (record) => eraOf(record.year)),
    conditions: countValues(source, PRODUCT_CONDITIONS, (record) => record.condition),
    price: {
      min: prices.length ? Math.min(...prices) : null,
      max: prices.length ? Math.max(...prices) : null,
    },
    stock: countValues(source, PRODUCT_STOCK_LEVELS, (record) => record.stock),
  };
}

export const seedCatalogRepository = {
  source: "seed",

  async findByPublicId(publicId) {
    return toPublicProduct(records.find((record) => record.id === publicId && !record.deletedAt));
  },

  async findProducts(query) {
    const active = records.filter((record) => !record.deletedAt);
    const filtered = active
      .filter((record) => matches(record, query))
      .sort((a, b) => compareProducts(a, b, query.sort));
    const start = (query.page - 1) * query.limit;
    return {
      items: filtered.slice(start, start + query.limit).map(toPublicProduct),
      total: filtered.length,
      facets: buildFacets(active),
    };
  },

  async listRecommendationCandidates() {
    return records
      .filter((record) => !record.deletedAt)
      .map(toPublicProduct)
      .sort((a, b) => a.id - b.id)
      .slice(0, MAX_RECOMMENDATION_CANDIDATES);
  },

  // --- Administrator surface (BFP-07), read-only. The seed catalog is an
  // in-memory fixture; admin writes are mongodb-only and never reach here. ---

  async listProductsForAdmin({ page = 1, limit = 20, includeDeleted = false } = {}) {
    const source = includeDeleted ? records : records.filter((record) => !record.deletedAt);
    const sorted = [...source].sort((a, b) => a.id - b.id);
    const start = (page - 1) * limit;
    return {
      items: sorted.slice(start, start + limit).map(toAdminProduct),
      total: sorted.length,
      page,
      limit,
    };
  },

  async findProductForAdmin(publicId) {
    return toAdminProduct(records.find((record) => record.id === publicId) || null);
  },

  async adminSummary() {
    const active = records.filter((record) => !record.deletedAt);
    return {
      activeProducts: active.length,
      lowStock: active.filter((record) => record.stock === "low").length,
      outOfStock: active.filter((record) => record.stock === "out").length,
      unresolvedArtwork: active.filter((record) => !record.artwork?.thumbnailUrl).length,
      softDeleted: records.filter((record) => record.deletedAt).length,
    };
  },
};
