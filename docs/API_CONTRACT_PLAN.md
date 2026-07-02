# Backend API Contract

This contract defines the read-only routes used by the integrated storefront.

## Envelopes

Success responses use `{ "data": {}, "meta": {} }`; `meta` is omitted when not needed. Errors use `{ "error": { "code": "...", "message": "..." } }`.

## Implemented Routes

All routes below are implemented and use the common envelopes.

### `GET /api/health`

Returns service status, catalog mode, and algorithm version.

### `GET /api/products`

Query parameters:

- `page` (default 1), `limit` (default 24, maximum 100).
- `q`, `genre`, `artist`, `label`, `condition`, `era`.
- `minPrice`, `maxPrice`, `inStock=true|false`.

Response: `{ data: { items }, meta: { page, limit, total } }`.

### `GET /api/products/:id`

Accepts a positive numeric product ID. Response: `{ data: { product } }`. Missing records return `404 NOT_FOUND`.

### `GET /api/search`

Accepts the product filters plus `q`. Response includes `{ page, limit, total, query }` metadata.

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
