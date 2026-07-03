# Vinyl Record Store Backend

This Next.js service provides the demo catalog and explainable recommendation APIs consumed by the separate Groovehaus React frontend.

## Implemented Features

- Health endpoint.
- Product listing and search with literal text matching, repeated facets, deterministic sorting, pagination, and catalog-wide facet metadata.
- Product detail endpoint with stable numeric public IDs.
- Product-to-product content similarity.
- Synthetic demo-profile and explicit cold-start user recommendations.
- Predictable success/error envelopes, input validation, stock preference, exclusions, diversity limits, and algorithm versioning.
- Optional MongoDB Atlas catalog persistence with strict models, repository adapters, conflict-safe seed migration, and index verification.
- Automated tests for catalog, persistence, migration, recommender behavior, and metric sanity.

The approved local seed remains the default data source. Set `CATALOG_DATA_SOURCE=mongodb` explicitly to use a migrated Atlas catalog; explicit MongoDB failures return a safe unavailable response and never silently fall back to seed data. Authentication, interaction writes, wishlist/cart APIs, order APIs, payments, admin writes, and real user profiles remain unimplemented.

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

`/api/products` and `/api/search` accept `page`, `limit`, bounded `q`, repeated `genre`, repeated `condition`, repeated `era`, bounded `artist`, bounded `label`, `minPrice`, `maxPrice`, `inStock`, and `sort`. Supported sorts are `newest`, `price-asc`, `price-desc`, and `artist-asc`. Repeated values are ORed within their facet and different facets are ANDed. Search text is a case-insensitive literal substring, so regular-expression characters have no special meaning.

List metadata includes `page`, `limit`, `total`, `totalPages`, `sort`, and full active-catalog `facets`. The search alias also includes its normalized `query`.

## Environment

```text
FRONTEND_ORIGIN=http://localhost:5173
RECOMMENDER_ALGORITHM_VERSION=content-demo-v1
MONGODB_URI=
MONGODB_DB_NAME=vinyl_record_store
CATALOG_DATA_SOURCE=seed
```

Keep the real connection string only in ignored `.env.local`. Seed mode does not require Atlas configuration. MongoDB mode requires both MongoDB variables and a migrated catalog.

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
- `src/services/catalog.js`: catalog query parsing and pagination metadata.
- `src/repositories/`: seed and MongoDB data access plus persistence repositories.
- `src/models/`: strict Mongoose schemas and declared indexes.
- `src/validation/catalog.js`: path and query validation.
- `src/lib/recommender/`: scoring and evaluation helpers.
- `src/lib/db/`: cached Atlas connection, data-source selection, and seed-migration planning.
- `src/data/records.js`: approved demo catalog seed.
- `scripts/`: MongoDB ping, seed migration, and index verification commands.
- `tests/`: Node test runner suites.
- `docs/`: current contracts, architecture, decisions, evaluation boundaries, and limitations.

## License

MIT, copyright Sithu Win San.
