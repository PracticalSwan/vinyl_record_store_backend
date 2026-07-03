# Backend API Contract

This contract defines the read-only routes used by the integrated storefront.

## Envelopes

Success responses use `{ "data": {}, "meta": {} }`; `meta` is omitted when not needed. Errors use `{ "error": { "code": "...", "message": "..." } }`.

## Implemented Routes

All routes below are implemented and use the common envelopes.

### `GET /api/health`

Returns `{ status, service, catalogMode, database, algorithmVersion }`. Seed mode reports `database.status: "not-required"`; MongoDB mode pings the selected application database and fails safely when persistence is unavailable.

### `GET /api/products`

Query parameters:

- `page` (default 1, maximum 10,000), `limit` (default 24, maximum 100).
- `q`, `artist`, and `label` (maximum 100 characters each), repeated `genre`, repeated `condition`, and repeated `era`.
- `minPrice`, `maxPrice`, `inStock=true|false`.
- `sort=newest|price-asc|price-desc|artist-asc` (default `newest`).

`q`, `artist`, and `label` use case-insensitive literal substring matching. Repeated values use OR semantics within a facet and different facets use AND semantics. Repeated controlled facets accept at most 20 values and reject unsupported values. Sorts use the stable numeric product ID as their final tie-breaker.

Response: `{ data: { items }, meta: { page, limit, total, totalPages, sort, facets } }`. Facets describe the full active catalog and include genre, era, condition, stock counts, and the catalog price range.

### `GET /api/products/:id`

Accepts a positive numeric product ID. Response: `{ data: { product } }`. Missing records return `404 NOT_FOUND`.

### `GET /api/search`

Uses the same filters, sorts, products, and metadata as `/api/products`, plus normalized `query` metadata. It is a compatibility alias over the same catalog service rather than a separate search implementation.

### `GET /api/recommendations/product/:id`

Optional `limit` defaults to 6 and is capped at 20.

Response data: `{ sourceProductId, mode, recommendations, algorithmVersion }`, where each item contains `{ product, score, reasons, algorithmVersion, rank }`.

### `GET /api/recommendations/user/:userId`

User IDs allow letters, numbers, underscores, and hyphens. Optional `limit` defaults to 8 and is capped at 20.

- `demo-user` returns `mode: "demo-profile"` and a synthetic profile summary.
- Other valid IDs return `mode: "cold-start"` without claiming user history.

## Deferred Routes

Interaction, wishlist, cart, order, authentication, recommendation-log, and admin write routes are not implemented.

## CORS

API responses allow the single origin configured by `FRONTEND_ORIGIN`, defaulting to `http://localhost:5173`.

## Change Rule

Update this contract, the frontend contract, tests, and the frontend API client together for breaking changes.
