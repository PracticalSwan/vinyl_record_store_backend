# Vinyl Record Store Backend

This Next.js service provides the demo catalog and explainable recommendation APIs consumed by the separate Groovehaus React frontend.

## Implemented Features

- Health endpoint.
- Product listing with pagination and validated filters.
- Product detail and text search endpoints.
- Product-to-product content similarity.
- Synthetic demo-profile and explicit cold-start user recommendations.
- Predictable success/error envelopes, input validation, stock preference, exclusions, diversity limits, and algorithm versioning.
- Unit tests for catalog behavior, recommender behavior, and an NDCG sanity check.

The current service uses approved local demo seed data. MongoDB, authentication, interaction writes, wishlist/cart persistence, orders, payments, admin writes, and real user profiles are not implemented.

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

## Environment

```text
FRONTEND_ORIGIN=http://localhost:5173
RECOMMENDER_ALGORITHM_VERSION=content-demo-v1
MONGODB_URI=
MONGODB_DB_NAME=
```

The MongoDB variables are reserved placeholders. Do not add real credentials until persistence is explicitly implemented.

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
- `src/data/records.js`: approved demo catalog seed.
- `tests/`: Node test runner suites.
- `docs/`: current contracts, architecture, decisions, evaluation boundaries, and limitations.

## License

MIT, copyright Sithu Win San.
