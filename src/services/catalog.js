import { getCatalogRepository } from "../lib/db/dataSource.js";
import { invalid, notFound } from "../lib/errors.js";
import { PRODUCT_CONDITIONS, PRODUCT_GENRES } from "../models/constants.js";
import { toPublicProduct } from "../repositories/catalogMapping.js";
import {
  boundedLiteral,
  optionalNumber,
  positiveInteger,
  productId,
  repeatedControlledValues,
} from "../validation/catalog.js";

const text = (value) => String(value || "").trim().toLowerCase();
const DEFAULT_PAGE_SIZE = 24;
const MAX_QUERY_LENGTH = 100;
const VALID_ERAS = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s+"];
const VALID_SORTS = ["newest", "price-asc", "price-desc", "artist-asc"];

export function parseCatalogQuery(searchParams) {
  const page = positiveInteger(searchParams.get("page"), 1, { name: "page", max: 10_000 });
  const limit = positiveInteger(searchParams.get("limit"), DEFAULT_PAGE_SIZE, {
    name: "limit",
    max: 100,
  });
  const minPrice = optionalNumber(searchParams.get("minPrice"), "minPrice");
  const maxPrice = optionalNumber(searchParams.get("maxPrice"), "maxPrice");
  if (minPrice !== null && maxPrice !== null && minPrice > maxPrice) {
    throw invalid("minPrice cannot be greater than maxPrice.");
  }

  const q = boundedLiteral(searchParams.get("q"), {
    name: "q",
    maxLength: MAX_QUERY_LENGTH,
  });
  const inStock = text(searchParams.get("inStock"));
  if (inStock && !["true", "false"].includes(inStock)) {
    throw invalid("inStock must be true or false.");
  }
  const sort = text(searchParams.get("sort")) || "newest";
  if (!VALID_SORTS.includes(sort)) throw invalid("sort is not supported.");

  return {
    page,
    limit,
    minPrice,
    maxPrice,
    q,
    genres: repeatedControlledValues(searchParams, "genre", PRODUCT_GENRES),
    artist: boundedLiteral(searchParams.get("artist"), {
      name: "artist",
      maxLength: MAX_QUERY_LENGTH,
    }).toLowerCase(),
    label: boundedLiteral(searchParams.get("label"), {
      name: "label",
      maxLength: MAX_QUERY_LENGTH,
    }).toLowerCase(),
    conditions: repeatedControlledValues(searchParams, "condition", PRODUCT_CONDITIONS),
    eras: repeatedControlledValues(searchParams, "era", VALID_ERAS),
    inStock,
    sort,
  };
}

export async function getProductRecord(value, { repository = getCatalogRepository() } = {}) {
  const id = productId(value);
  const product = await repository.findByPublicId(id);
  if (!product) throw notFound(`Product ${id} was not found.`);
  return product;
}

export async function getProduct(value, options) {
  return getProductRecord(value, options);
}

export async function listProducts(
  searchParams,
  { repository = getCatalogRepository() } = {},
) {
  const query = parseCatalogQuery(searchParams);
  const result = await repository.findProducts(query);
  return {
    items: result.items,
    meta: {
      page: query.page,
      limit: query.limit,
      total: result.total,
      totalPages: Math.ceil(result.total / query.limit),
      sort: query.sort,
      facets: result.facets,
    },
    query,
  };
}

export { toPublicProduct };
