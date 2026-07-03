# Vinyl Record Store Backend

This Next.js service provides the demo catalog, explainable recommendations, signed sessions, and authenticated customer-state APIs consumed by the separate Groovehaus React frontend.

## Implemented Features

- Health endpoint.
- Product listing and search with literal text matching, repeated facets, deterministic sorting, pagination, and catalog-wide facet metadata.
- Product detail endpoint with stable numeric public IDs.
- Product-to-product content similarity.
- Synthetic demo-profile and explicit cold-start user recommendations.
- Predictable success/error envelopes, input validation, stock preference, exclusions, diversity limits, and algorithm versioning.
- Optional MongoDB Atlas catalog persistence with strict models, repository adapters, conflict-safe seed migration, and index verification.
- Username/password registration and login, seeded demo identities, signed HttpOnly session cookies, logout, session restoration, role checks, and account deletion.
- Protected profile/preferences, wishlist, cart, rating, and idempotent guest-state merge APIs plus anonymous or authenticated interaction ingestion.
- Exact-origin credentialed mutations, bounded JSON/validation, server-derived ownership, rate limiting, safe errors, and transaction-backed state changes.
- Automated tests for catalog, persistence, migration, authentication, write validation/state, recommender behavior, and metric sanity.

When `MONGODB_URI` and `MONGODB_DB_NAME` are configured, the backend uses the Atlas catalog by default. Keep `CATALOG_DATA_SOURCE=mongodb` in the local environment to make that explicit; explicit MongoDB failures return a safe unavailable response instead of silently falling back to seed data. Demo orders, payments, public administrator writes, and measured real-user personalization remain unimplemented.

## Run Locally

```bash
npm install
npm run dev
```

The service defaults to `http://localhost:3000`. The frontend defaults to `http://localhost:5173`.

## Available Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and algorithm status. |
| `GET` | `/api/products` | Paginated/filterable product list. |
| `GET` | `/api/products/:id` | Product detail. |
| `GET` | `/api/search?q=` | Text search with catalog filters. |
| `GET` | `/api/recommendations/product/:id` | Similar in-stock records with reasons. |
| `GET` | `/api/recommendations/user/:userId` | `demo-profile` or `cold-start` list. |
| `POST` | `/api/auth/register` | Create a customer account and session. |
| `POST` | `/api/auth/login` | Verify a registered or seeded identity and create a session. |
| `POST` | `/api/auth/logout` | Expire the session cookie. |
| `GET` | `/api/auth/session` | Restore safe public session state. |
| `GET`, `DELETE` | `/api/me` | Read the current profile or delete a registered customer account. |
| `PATCH` | `/api/me/preferences` | Replace validated onboarding preferences. |
| `POST` | `/api/interactions` | Idempotently ingest a bounded event batch. |
| `GET`, `PUT`, `DELETE` | `/api/wishlist`, `/api/wishlist/:productId` | Read or mutate the current user's wishlist. |
| `GET`, `PUT`, `DELETE` | `/api/cart`, `/api/cart/:productId` | Read or mutate absolute cart quantities. |
| `GET`, `PUT`, `DELETE` | `/api/ratings`, `/api/ratings/:productId` | Read or mutate current ratings. |
| `POST` | `/api/me/merge-guest-state` | Idempotently merge guest wishlist, cart, and ratings. |

`/api/products` and `/api/search` accept `page`, `limit`, bounded `q`, repeated `genre`, repeated `condition`, repeated `era`, bounded `artist`, bounded `label`, `minPrice`, `maxPrice`, `inStock`, and `sort`. Supported sorts are `newest`, `price-asc`, `price-desc`, and `artist-asc`. Repeated values are ORed within their facet and different facets are ANDed. Search text is a case-insensitive literal substring, so regular-expression characters have no special meaning.

List metadata includes `page`, `limit`, `total`, `totalPages`, `sort`, and full active-catalog `facets`. The search alias also includes its normalized `query`.

## Environment

```text
FRONTEND_ORIGIN=http://localhost:5173
RECOMMENDER_ALGORITHM_VERSION=content-demo-v1
MONGODB_URI=
MONGODB_DB_NAME=vinyl_record_store
CATALOG_DATA_SOURCE=seed
AUTH_SECRET=
AUTH_COOKIE_SECURE=false
AUTH_DEMO_CUSTOMER_USERNAME=
AUTH_DEMO_CUSTOMER_DISPLAY_NAME=
AUTH_DEMO_CUSTOMER_PASSWORD_HASH=
AUTH_DEMO_CUSTOMER_PASSWORD_SALT=
AUTH_DEMO_ADMIN_USERNAME=
AUTH_DEMO_ADMIN_DISPLAY_NAME=
AUTH_DEMO_ADMIN_PASSWORD_HASH=
AUTH_DEMO_ADMIN_PASSWORD_SALT=
```

For local Atlas testing, set `CATALOG_DATA_SOURCE=mongodb` and fill the `AUTH_DEMO_*` variables in `.env.local`. The demo customer and admin accounts are environment-backed; the repo does not commit their hashes or salts.
When you paste scrypt hashes into `.env.local`, escape each literal `$` as `\$` so Next.js reads the full hash value correctly.

Keep the real connection string only in ignored `.env.local`. Seed mode does not require Atlas configuration. MongoDB mode requires both MongoDB variables and a migrated catalog.

Use `npm run auth:hash` to generate a scrypt hash/salt pair without echoing the password. Use `npm run auth:promote -- <username>` for a dry-run role preview and add `--apply` only for an intentional administrator promotion. Never commit plaintext passwords, hashes, salts, cookies, or `AUTH_SECRET`.

Use this guarded database workflow:

```bash
npm run db:ping
npm run db:seed
npm run db:seed:apply
npm run db:indexes:ensure
npm run db:indexes
```

`db:seed` is dry-run only. Apply refuses duplicate public IDs, duplicate slugs, ownership conflicts, and slug conflicts; it never deletes records. `db:indexes` reports missing indexes, while `db:indexes:ensure` creates declared collections and indexes before verifying them.

## Validation

Run all three checks before committing backend behavior or contract changes.

```bash
npm test
npm run lint
npm run build
```

## Source Layout

- `src/app/api/`: thin Next.js route handlers.
- `src/services/`: catalog, authentication, customer-state, and account-lifecycle logic.
- `src/repositories/`: seed and MongoDB data access plus persistence repositories.
- `src/models/`: strict Mongoose schemas and declared indexes.
- `src/validation/`: catalog, authentication, and write-body validation.
- `src/lib/recommender/`: scoring and evaluation helpers.
- `src/lib/db/`: cached Atlas connection, data-source selection, and seed-migration planning.
- `src/data/records.js`: approved demo catalog seed.
- `scripts/`: MongoDB maintenance plus guarded password-hash and administrator-promotion commands.
- `tests/`: Node test runner suites.
- `docs/`: current contracts, architecture, decisions, evaluation boundaries, and limitations.

## License

MIT, copyright Sithu Win San.
