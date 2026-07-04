# Backend API Contract

This contract defines the read and authenticated mutation routes available to the integrated storefront.

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

## Authentication Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `POST` | `/api/auth/register` | Create a case-insensitively unique customer account and issue a session. |
| `POST` | `/api/auth/login` | Verify a registered or configured seeded identity and issue a session. |
| `POST` | `/api/auth/logout` | Expire the session cookie. |
| `GET` | `/api/auth/session` | Return `{ authenticated, user? }` without secret fields. |

Passwords are 10 to 128 characters and use scrypt with a random salt. Login failures use one generic message and unknown usernames run a dummy hash to flatten response timing. Sessions are signed, HttpOnly, `SameSite=Lax`, eight hours long, and secure when configured for HTTPS. Registration always creates a `customer`; the administrator role is environment-only (`AUTH_DEMO_ADMIN_*`) and never selectable at registration. Interaction ingestion is bounded to 1 through 50 events per batch and capped per identity (120 events per minute) to prevent write amplification.

## Customer And Interaction Routes

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/me` | Required | Return the safe current profile and preferences. |
| `DELETE` | `/api/me` | Required | Delete a registered customer and owned demo state, then clear the session. Seeded/admin identities are blocked. |
| `PATCH` | `/api/me/preferences` | Required | Replace supported onboarding preferences. |
| `POST` | `/api/interactions` | Optional | Idempotently ingest 1 through 50 version-1 events. |
| `GET` | `/api/wishlist` | Required | Return product IDs and current product summaries. |
| `PUT`, `DELETE` | `/api/wishlist/:productId` | Required | Idempotently add or remove a product. |
| `GET` | `/api/cart` | Required | Return current items, calculated USD subtotal, and availability warnings. |
| `PUT`, `DELETE` | `/api/cart/:productId` | Required | Set an absolute quantity from 1 through 99 or remove an item. |
| `GET` | `/api/ratings` | Required | Return current ratings and timestamps. |
| `PUT`, `DELETE` | `/api/ratings/:productId` | Required | Set 1 through 5 or remove a rating while retaining a safe event. |
| `POST` | `/api/me/merge-guest-state` | Required | Idempotently merge bounded guest wishlist, cart, and rating state by `mergeId`. |

Ownership comes only from the verified session; client-supplied user IDs are rejected as unknown fields. Interactions require stable unique event IDs, a controlled source/surface/type, a valid retention-window timestamp, and an anonymous ID only when no session exists. Merge retries return the original receipt, cart quantities are capped at 99, unavailable products produce warnings, and the newest rating timestamp wins.

## Deferred Routes

Demo-order, recommendation-request-log, and administrator catalog routes are not implemented.

## CORS

API responses allow credentials only for the single origin configured by `FRONTEND_ORIGIN`, defaulting to `http://localhost:5173`. Mutations reject missing or different origins, bound JSON bodies to 64 KB, and advertise only the implemented methods and `Content-Type`/`Idempotency-Key` headers.

## Change Rule

Update this contract, the frontend contract, tests, and the frontend API client together for breaking changes.
