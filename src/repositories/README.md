# Backend Repositories

Repositories isolate data access from services and route handlers.

- `seedCatalogRepository.js` implements the safe default catalog over the approved seed.
- `mongoCatalogRepository.js` implements the same read contract for explicit MongoDB mode.
- `catalogMapping.js` preserves numeric public product IDs and the public response shape.
- `evaluationRepository.js` reads the bounded evaluation window, pseudonymizes subjects before returning data, and reports aggregate captured-field coverage.
- User, customer-state, event, and account repositories back active authentication and protected write APIs. The order repository remains a deferred demo-order boundary.

Catalog adapters must preserve literal search, repeated-facet semantics, deterministic sorting and pagination, full active-catalog facets, soft-delete exclusion, structured artwork validation, and safe persistence errors. Customer repositories must preserve session-owned access, transaction safety, event/merge idempotency, and safe service errors.
