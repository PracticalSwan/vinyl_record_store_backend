# Backend Architecture

This document describes the implemented read-only service structure.

## Request Flow

1. A Next.js route handler receives the request.
2. `src/validation/catalog.js` validates IDs, pagination, limits, prices, booleans, and user ID format.
3. Catalog routes call `src/services/catalog.js`; recommendation routes call `src/lib/recommender/contentBased.js`.
4. `src/lib/http.js` produces the common success or error envelope.
5. `next.config.mjs` adds CORS headers for the configured frontend origin.

## Modules

- API layer: `src/app/api/`.
- Service layer: `src/services/catalog.js`.
- Validation layer: `src/validation/catalog.js`.
- Recommender layer: `src/lib/recommender/`.
- Error/response helpers: `src/lib/errors.js` and `src/lib/http.js`.
- Current data source: `src/data/records.js`.
- Connected but unused database boundary: `src/lib/db/mongodb.js`.

## Runtime Properties

- Read-only routes are dynamic Next.js route handlers.
- Catalog filtering and recommendation scoring are in memory over a small demo seed.
- A cached Mongoose helper can connect to Atlas and perform a ping, but application routes do not query MongoDB.
- The default allowed frontend origin is `http://localhost:5173`.
- No authentication, persistence, or write-side consistency exists yet.

## Security

Inputs are bounded before service work, public product responses omit seed-only reasons, and unexpected errors return a generic message. Real credentials and private interactions are not present.
