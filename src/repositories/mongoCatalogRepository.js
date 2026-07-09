import { connectMongoDB } from "../lib/db/mongodb.js";
import { persistenceUnavailable } from "../lib/errors.js";
import {
  PRODUCT_CONDITIONS,
  PRODUCT_GENRES,
  PRODUCT_STOCK_LEVELS,
} from "../models/constants.js";
import { Counter } from "../models/Counter.js";
import { VinylRecord } from "../models/VinylRecord.js";
import { slugifyProduct, toAdminProduct, toPublicProduct } from "./catalogMapping.js";

const ERAS = ["1950s", "1960s", "1970s", "1980s", "1990s", "2000s+"];
const MAX_RECOMMENDATION_CANDIDATES = 1_000;
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const contains = (value) => new RegExp(escapeRegex(value), "i");

function eraRange(era) {
  if (era === "2000s+") return { year: { $gte: 2000 } };
  const decade = Number.parseInt(era, 10);
  return { year: { $gte: decade, $lt: decade + 10 } };
}

export function buildMongoCatalogFilter(query) {
  const filter = { deletedAt: null };
  const clauses = [];
  if (query.q) {
    const pattern = contains(query.q);
    clauses.push({
      $or: ["title", "artist", "genre", "label"].map((field) => ({ [field]: pattern })),
    });
  }
  if (query.eras.length) clauses.push({ $or: query.eras.map(eraRange) });
  if (clauses.length) filter.$and = clauses;
  if (query.genres.length) filter.genre = { $in: query.genres };
  if (query.artist) filter.artist = contains(query.artist);
  if (query.label) filter.label = contains(query.label);
  if (query.conditions.length) filter.condition = { $in: query.conditions };
  if (query.minPrice !== null || query.maxPrice !== null) {
    filter.price = {};
    if (query.minPrice !== null) filter.price.$gte = query.minPrice;
    if (query.maxPrice !== null) filter.price.$lte = query.maxPrice;
  }
  if (query.inStock === "true") filter.stock = { $ne: "out" };
  if (query.inStock === "false") filter.stock = "out";
  return filter;
}

function mongoSort(sort) {
  if (sort === "price-asc") return { price: 1, publicId: 1 };
  if (sort === "price-desc") return { price: -1, publicId: 1 };
  if (sort === "artist-asc") return { artist: 1, publicId: 1 };
  return { year: -1, publicId: 1 };
}

const counts = (values, source) => {
  const map = new Map(source.map(({ _id, count }) => [_id, count]));
  return values.map((value) => ({ value, count: map.get(value) || 0 }));
};

async function readFacets(model) {
  const [facets = {}] = await model.aggregate([
    { $match: { deletedAt: null } },
    {
      $facet: {
        genres: [{ $group: { _id: "$genre", count: { $sum: 1 } } }],
        conditions: [{ $group: { _id: "$condition", count: { $sum: 1 } } }],
        stock: [{ $group: { _id: "$stock", count: { $sum: 1 } } }],
        prices: [{ $group: { _id: null, min: { $min: "$price" }, max: { $max: "$price" } } }],
        years: [{ $group: { _id: "$year", count: { $sum: 1 } } }],
      },
    },
  ]).exec();
  const eraCounts = ERAS.map((value) => ({ value, count: 0 }));
  for (const { _id: year, count } of facets.years || []) {
    const era = year >= 2000 ? "2000s+" : `${Math.floor(year / 10) * 10}s`;
    const target = eraCounts.find((entry) => entry.value === era);
    if (target) target.count += count;
  }
  return {
    genres: counts(PRODUCT_GENRES, facets.genres || []),
    eras: eraCounts,
    conditions: counts(PRODUCT_CONDITIONS, facets.conditions || []),
    price: {
      min: facets.prices?.[0]?.min ?? null,
      max: facets.prices?.[0]?.max ?? null,
    },
    stock: counts(PRODUCT_STOCK_LEVELS, facets.stock || []),
  };
}

export function createMongoCatalogRepository(
  model = VinylRecord,
  connect = connectMongoDB,
) {
  const runMongo = async (operation) => {
    try {
      await connect();
      return await operation();
    } catch (error) {
      if (error?.code === "PERSISTENCE_UNAVAILABLE") throw error;
      throw persistenceUnavailable();
    }
  };

  return {
    source: "mongodb",

    findByPublicId: (publicId) => runMongo(async () => toPublicProduct(
      await model.findOne({ publicId, deletedAt: null }).lean().exec(),
    )),

    findProducts: (query) => runMongo(async () => {
      const filter = buildMongoCatalogFilter(query);
      const [items, total, facets] = await Promise.all([
        model.find(filter)
          .sort(mongoSort(query.sort))
          .skip((query.page - 1) * query.limit)
          .limit(query.limit)
          .lean()
          .exec(),
        model.countDocuments(filter).exec(),
        readFacets(model),
      ]);
      return { items: items.map(toPublicProduct), total, facets };
    }),

    listRecommendationCandidates: () => runMongo(async () => (
      await model.find({ deletedAt: null })
        .sort({ publicId: 1 })
        .limit(MAX_RECOMMENDATION_CANDIDATES)
        .lean()
        .exec()
    ).map(toPublicProduct)),

    // --- Administrator surface (BFP-07). Reads include soft-deleted rows when
    // asked; writes use compare-and-set on Mongoose-managed updatedAt. ---

    listProductsForAdmin: ({ page = 1, limit = 20, includeDeleted = false } = {}) => runMongo(async () => {
      const filter = includeDeleted ? {} : { deletedAt: null };
      const [items, total] = await Promise.all([
        model.find(filter)
          .sort({ publicId: 1 })
          .skip((page - 1) * limit)
          .limit(limit)
          .lean(),
        model.countDocuments(filter),
      ]);
      return {
        items: items.map(toAdminProduct),
        total,
        page,
        limit,
      };
    }),

    findProductForAdmin: (publicId) => runMongo(async () => toAdminProduct(
      await model.findOne({ publicId }).lean(),
    )),

    // Raw full-doc read for catalog import planning (duplicate/conflict
    // detection needs provenance, artwork, and soft-delete state).
    listAllRawForImport: () => runMongo(async () => await model.find({}).lean()),

    adminSummary: () => runMongo(async () => {
      const [active, lowStock, outOfStock, softDeleted, withArtwork] = await Promise.all([
        model.countDocuments({ deletedAt: null }),
        model.countDocuments({ deletedAt: null, stock: "low" }),
        model.countDocuments({ deletedAt: null, stock: "out" }),
        model.countDocuments({ deletedAt: { $ne: null } }),
        model.countDocuments({
          deletedAt: null,
          "artwork.thumbnailUrl": { $in: [null, ""] },
        }),
      ]);
      return {
        activeProducts: active,
        lowStock,
        outOfStock,
        // "unresolved artwork" = active products whose thumbnail is missing,
        // which `withArtwork` already counted directly.
        unresolvedArtwork: withArtwork,
        softDeleted,
      };
    }),

    createProduct: (desired, { counterModel = Counter } = {}) => runMongo(async () => {
      // Allocate a publicId that is strictly greater than both the counter and
      // the max existing publicId, mirroring reservePublicIds so a re-seeded
      // catalog that did not advance the counter cannot cause a collision.
      const maxExisting = await model.findOne({})
        .sort({ publicId: -1 })
        .limit(1)
        .lean();
      const maxExistingId = maxExisting?.publicId || 0;
      const counter = await counterModel.findOneAndUpdate(
        { _id: "vinylRecords" },
        [{
          $set: {
            value: { $add: [{ $max: [{ $ifNull: ["$value", 0] }, maxExistingId] }, 1] },
            updatedAt: "$$NOW",
            createdAt: { $ifNull: ["$createdAt", "$$NOW"] },
          },
        }],
        { upsert: true, returnDocument: "after" },
      ).lean();
      const publicId = counter.value;
      const slug = slugifyProduct({ ...desired, id: publicId });
      const created = await model.create({ ...desired, publicId, slug, deletedAt: null });
      return toAdminProduct(created);
    }),

    updateProduct: (publicId, patch, expectedUpdatedAt) => runMongo(async () => {
      const current = await model.findOne({ publicId }).lean();
      if (!current || current.deletedAt) return { status: "not_found" };
      const expected = expectedUpdatedAt ? new Date(expectedUpdatedAt).toISOString() : null;
      const actual = current.updatedAt ? new Date(current.updatedAt).toISOString() : null;
      if (expected && expected !== actual) {
        return { status: "conflict", current: toAdminProduct(current) };
      }
      // Compare-and-set on the read updatedAt closes the race between the
      // existence check above and the write below.
      const updated = await model.findOneAndUpdate(
        { publicId, updatedAt: current.updatedAt },
        { $set: patch },
        { new: true },
      ).lean();
      if (!updated) {
        const refreshed = await model.findOne({ publicId }).lean();
        return { status: "conflict", current: refreshed ? toAdminProduct(refreshed) : null };
      }
      return { status: "ok", product: toAdminProduct(updated) };
    }),

    softDeleteProduct: (publicId, expectedUpdatedAt) => runMongo(async () => {
      const now = new Date();
      const current = await model.findOne({ publicId }).lean();
      if (!current) return { status: "not_found" };
      if (current.deletedAt) return { status: "not_found" };
      const expected = expectedUpdatedAt ? new Date(expectedUpdatedAt).toISOString() : null;
      const actual = current.updatedAt ? new Date(current.updatedAt).toISOString() : null;
      if (expected && expected !== actual) {
        return { status: "conflict", current: toAdminProduct(current) };
      }
      const updated = await model.findOneAndUpdate(
        { publicId, deletedAt: null, updatedAt: current.updatedAt },
        { $set: { deletedAt: now } },
        { new: true },
      ).lean();
      if (!updated) {
        const refreshed = await model.findOne({ publicId }).lean();
        return { status: "conflict", current: refreshed ? toAdminProduct(refreshed) : null };
      }
      return { status: "ok", product: toAdminProduct(updated) };
    }),

    restoreProduct: (publicId) => runMongo(async () => {
      const updated = await model.findOneAndUpdate(
        { publicId, deletedAt: { $ne: null } },
        { $set: { deletedAt: null } },
        { new: true },
      ).lean();
      if (!updated) return { status: "not_found" };
      return { status: "ok", product: toAdminProduct(updated) };
    }),

    applyImport: (preparedRows, { allowPartial = false, connection } = {}) => runMongo(async () => {
      // applyCatalogImport requires a live connection; the repository reuses
      // the transactional bulk-write path owned by the import service.
      const { applyCatalogImport } = await import("../services/catalogImport.js");
      return applyCatalogImport(preparedRows, {
        connection: connection || await connect(),
        model,
        counterModel: Counter,
        allowPartial,
      });
    }),
  };
}

export const mongoCatalogRepository = createMongoCatalogRepository();
