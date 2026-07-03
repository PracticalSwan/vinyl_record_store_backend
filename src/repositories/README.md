# Backend Repositories

Repositories isolate data access from services and route handlers.

- `seedCatalogRepository.js` implements the safe default catalog over the approved seed.
- `mongoCatalogRepository.js` implements the same read contract for explicit MongoDB mode.
- `catalogMapping.js` preserves numeric public product IDs and the public response shape.
- User, state, event, and order repositories define persistence boundaries for future authenticated write APIs; those routes are not implemented yet.

Catalog adapters must preserve literal search, repeated-facet semantics, deterministic sorting and pagination, full active-catalog facets, soft-delete exclusion, and safe persistence errors.
