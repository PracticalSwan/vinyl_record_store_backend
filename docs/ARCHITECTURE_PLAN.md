# Backend Architecture

This document describes the implemented read-only service structure.

## Request Flow

1. A Next.js route handler receives the request.
2. `src/validation/catalog.js` validates IDs, bounded literal search, repeated facets, pagination, limits, prices, booleans, sorts, and user ID format.
3. Catalog routes call `src/services/catalog.js`, which selects the seed or MongoDB repository through `src/lib/db/dataSource.js`; recommendation routes use the selected repository through `src/lib/recommender/contentBased.js`.
4. Repositories normalize documents to the stable public product shape and exclude soft-deleted records.
5. `src/lib/http.js` produces the common success or error envelope.
6. `next.config.mjs` adds CORS headers for the configured frontend origin.

## Modules

- API layer: `src/app/api/`.
- Service layer: `src/services/catalog.js`.
- Repository layer: `src/repositories/`.
- Persistence models: `src/models/`.
- Validation layer: `src/validation/catalog.js`.
- Recommender layer: `src/lib/recommender/`.
- Error/response helpers: `src/lib/errors.js` and `src/lib/http.js`.
- Default data source: `src/data/records.js` through `seedCatalogRepository.js`.
- Optional data source: Atlas through `mongoCatalogRepository.js` and `src/lib/db/mongodb.js`.
- Data-source selection and migration support: `src/lib/db/dataSource.js` and `src/lib/db/seedMigration.js`.

## Runtime Properties

- Read-only routes are dynamic Next.js route handlers.
- Seed mode filters the small demo catalog in memory; explicit MongoDB mode executes equivalent repository queries and aggregation-based catalog facets.
- Search is a case-insensitive literal substring. Repeated values are ORed within genre, condition, and era facets and ANDed across facets. Sort tie-breakers use stable public IDs.
- The approved seed remains the default. Explicit MongoDB mode requires valid Atlas configuration and never silently falls back.
- The default allowed frontend origin is `http://localhost:5173`.
- Persistence schemas and repositories exist, but no authentication or customer write-side API exists yet.

## Security

Inputs are bounded before repository work, regex metacharacters are escaped for MongoDB substring matching, public product responses omit seed-only reasons and internal ObjectIds, and unexpected failures return safe errors. Credentials stay in ignored local environment files; private identity fields use non-selecting model fields.
