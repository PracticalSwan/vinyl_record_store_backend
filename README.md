# Vinyl Record Store Backend

This Next.js service provides the demo catalog and explainable recommendation APIs consumed by the separate Groovehaus React frontend.

## Implemented Features

- Health endpoint.
- Product listing with pagination and validated filters.
- Product detail and text search endpoints.
- Product-to-product content similarity.
- Synthetic demo-profile and explicit cold-start user recommendations.
- Predictable success/error envelopes, input validation, stock preference, exclusions, diversity limits, and algorithm versioning.
- Server-only MongoDB Atlas connection helper with a safe ping command.
- Unit tests for catalog behavior, recommender behavior, and an NDCG sanity check.

The current service still uses approved local demo seed data. Atlas connectivity is configured locally, but no MongoDB collection, model, catalog query, or persistence behavior is implemented. Authentication, interaction writes, wishlist/cart persistence, orders, payments, admin writes, and real user profiles also remain unimplemented.

## Run Locally

```bash
npm install
npm run db:ping
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

## Environment

```text
FRONTEND_ORIGIN=http://localhost:5173
RECOMMENDER_ALGORITHM_VERSION=content-demo-v1
MONGODB_URI=
MONGODB_DB_NAME=vinyl_record_store
```

Keep the real connection string only in ignored `.env.local`. `npm run db:ping` loads that file, connects through `src/lib/db/mongodb.js`, performs an administrative ping against the selected application database, prints only safe status fields, and disconnects. It does not create a database or collection.

## Validation

Run all three checks before committing backend behavior or contract changes.

```bash
npm test
npm run lint
npm run build
```

## Source Layout

- `src/app/api/`: thin Next.js route handlers.
- `src/services/catalog.js`: catalog querying and public product shape.
- `src/validation/catalog.js`: path and query validation.
- `src/lib/recommender/`: scoring and evaluation helpers.
- `src/lib/db/mongodb.js`: cached server-only Atlas connection and ping helper.
- `src/data/records.js`: approved demo catalog seed.
- `scripts/ping-mongodb.mjs`: local connection verification command.
- `tests/`: Node test runner suites.
- `docs/`: current contracts, architecture, decisions, evaluation boundaries, and limitations.

## License

MIT, copyright Sithu Win San.
