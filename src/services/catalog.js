import { records } from "../data/records.js";
import { invalid, notFound } from "../lib/errors.js";
import { optionalNumber, positiveInteger, productId } from "../validation/catalog.js";

const text = (value) => String(value || "").trim().toLowerCase();
const CURRENT_CENTURY_START = 2000;
const DEFAULT_PAGE_SIZE = 24;
const MAX_QUERY_LENGTH = 100;
const VALID_ERAS = new Set(["1950s", "1960s", "1970s", "1980s", "1990s", "2000s+"]);

function matchesEra(year, era) {
  if (!era) return true;
  if (era === "2000s+") return year >= CURRENT_CENTURY_START;
  const decade = Number.parseInt(era, 10);
  return Number.isInteger(decade) && year >= decade && year < decade + 10;
}

export function toPublicProduct(record) {
  if (!record) return null;
  const { reason: _seedReason, ...product } = record;
  return { ...product, currency: "USD", imageUrl: null };
}

export function getProductRecord(value) {
  const id = productId(value);
  const record = records.find((item) => item.id === id);
  if (!record) throw notFound(`Product ${id} was not found.`);
  return record;
}

export function getProduct(value) {
  return toPublicProduct(getProductRecord(value));
}

export function listProducts(searchParams) {
  const page = positiveInteger(searchParams.get("page"), 1, { name: "page", max: 10_000 });
  const limit = positiveInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, { name: "limit", max: 100 });
  const minPrice = optionalNumber(searchParams.get("minPrice"), "minPrice");
  const maxPrice = optionalNumber(searchParams.get("maxPrice"), "maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw invalid("minPrice cannot be greater than maxPrice.");
  }

  const query = text(searchParams.get("q"));
  if (query.length > MAX_QUERY_LENGTH) throw invalid(`q must be ${MAX_QUERY_LENGTH} characters or fewer.`);
  const genre = text(searchParams.get("genre"));
  const artist = text(searchParams.get("artist"));
  const label = text(searchParams.get("label"));
  const condition = text(searchParams.get("condition"));
  const era = searchParams.get("era");
  if (era && !VALID_ERAS.has(era)) throw invalid("era is not supported.");
  const inStock = text(searchParams.get("inStock"));
  if (inStock && !["true", "false"].includes(inStock)) {
    throw invalid("inStock must be true or false.");
  }

  const filtered = records
    .filter((record) => {
      const searchable = `${record.title} ${record.artist} ${record.genre} ${record.label}`.toLowerCase();
      if (query && !searchable.includes(query)) return false;
      if (genre && text(record.genre) !== genre) return false;
      if (artist && !text(record.artist).includes(artist)) return false;
      if (label && !text(record.label).includes(label)) return false;
      if (condition && text(record.condition) !== condition) return false;
      if (!matchesEra(record.year, era)) return false;
      if (minPrice !== null && record.price < minPrice) return false;
      if (maxPrice !== null && record.price > maxPrice) return false;
      if (inStock === "true" && record.stock === "out") return false;
      if (inStock === "false" && record.stock !== "out") return false;
      return true;
    })
    .sort((a, b) => b.year - a.year || a.title.localeCompare(b.title));

  const start = (page - 1) * limit;
  return {
    items: filtered.slice(start, start + limit).map(toPublicProduct),
    meta: { page, limit, total: filtered.length },
  };
}
