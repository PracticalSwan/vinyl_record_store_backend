# Backend Architecture

This document describes the implemented read and authenticated mutation service structure.

## Request Flow

1. A Next.js route handler receives the request.
2. Catalog/auth/write validation bounds route parameters, query strings, JSON size, allowed body keys, arrays, timestamps, and controlled values.
3. Authentication verifies scrypt credentials and a signed session cookie; protected routes reload the subject and derive ownership from that session. Recommendation identity is reduced to a safe descriptor before ranking or logging.
4. Catalog, import, recommendation-serving/logging, evaluation, auth, state, or account services apply business rules and call the appropriate repository.
5. Repositories normalize catalog documents, execute state mutations, preserve idempotency receipts, and use transactions for multi-document consistency.
6. `src/lib/http.js` produces the common success or error envelope.
7. `next.config.mjs` adds exact-origin credentialed CORS; mutation handlers also verify the request origin.

## Modules

- API layer: `src/app/api/`.
- Service layer: `src/services/` for catalog, recommendation serving/logging, authentication, customer state, and account lifecycle.
- Repository layer: `src/repositories/`.
- Persistence models: `src/models/`.
- Validation layer: `src/validation/` plus bounded JSON/origin checks in `src/lib/request.js`.
- Authentication layer: `src/lib/auth/` for scrypt, signed cookies, sessions, roles, and recommendation-subject derivation; `src/lib/interactionCap.js` bounds interaction ingestion per identity.
- Recommender layer: `src/lib/recommender/`.
- Catalog ingestion layer: `src/lib/catalog/`, `src/lib/external/`, `src/services/catalogImport.js`, and the preview/apply command.
- Error/response helpers: `src/lib/errors.js` and `src/lib/http.js`.
- Default data source: `src/data/records.js` through `seedCatalogRepository.js`.
- Optional data source: Atlas through `mongoCatalogRepository.js` and `src/lib/db/mongodb.js`.
- Data-source selection and migration support: `src/lib/db/dataSource.js` and `src/lib/db/seedMigration.js`.

## Runtime Properties

- Read and mutation routes are dynamic Next.js route handlers.
- Seed mode filters the small demo catalog in memory; explicit MongoDB mode executes equivalent repository queries and aggregation-based catalog facets.
- Search is a case-insensitive literal substring. Repeated values are ORed within genre, condition, and era facets and ANDed across facets. Sort tie-breakers use stable public IDs.
- The approved seed remains the default. Explicit MongoDB mode requires valid Atlas configuration and never silently falls back.
- The default allowed frontend origin is `http://localhost:5173`; mutations require that exact origin and use credentialed requests.
- Registered customer state requires MongoDB mode. Seeded identities can authenticate from environment configuration and store preferences/state when persistence is available.
- Recommendation responses always receive request/list IDs. `GET /api/recommendations/me` uses a verified customer descriptor or anonymous fallback; administrators are rejected. MongoDB mode logs a tracking-enabled served list before response; seed mode and usage opt-out skip persistence.
- Offline evaluation is a command path, not a request route. It pseudonymizes subjects before dataset construction and emits only aggregate reports after enforcing the evidence gate.

## Security

Inputs are bounded before repository work, regex metacharacters are escaped for MongoDB substring matching, ownership is server-derived, login failures are generic with dummy-hash timing, interaction ingestion is per-identity capped, and sessions are signed/HttpOnly. Public responses omit seed-only reasons, internal ObjectIds, password fields, and raw events. Unexpected failures return safe errors; credentials stay in ignored local environment files.
