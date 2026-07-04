# Backend Requirements

Requirement status reflects the integrated academic demo as of 2026-07-04.

## Requirement Status

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| BR-001 | Product listing data. | Implemented | `/api/products`. |
| BR-002 | Product detail data. | Implemented | `/api/products/:id`. |
| BR-003 | Search and filters. | Implemented | Literal search, repeated facets, deterministic sorts, pagination, and catalog-wide facet metadata. |
| BR-004 | Interaction ingestion. | Implemented | Anonymous/authenticated bounded event batches with idempotent event IDs. |
| BR-005 | Wishlist and cart writes. | Implemented | Session-owned wishlist, absolute cart quantities, totals, warnings, and guest merge. Demo orders remain deferred. |
| BR-006 | Product-based recommendations. | Implemented | Content similarity endpoint. |
| BR-007 | User-based recommendations. | Demo only | Synthetic profile or cold-start result. |
| BR-008 | Recommendation explanations. | Implemented | Generated from matched metadata. |
| BR-009 | Recommendation output logging. | Implemented | Exact MongoDB-mode served-list logs with request/list IDs, attribution, opt-out, and TTL. |
| BR-010 | Admin product management. | Deferred | Outside current demo scope. |
| BR-011 | Optional MongoDB catalog persistence. | Implemented | Explicit data-source selection, strict models, repository parity, conflict-safe seed migration, and index verification. |
| BR-012 | Authentication and authorization. | Implemented | Registration, seeded/registered login, signed HttpOnly sessions, logout, restoration, role checks, and account deletion. |
| BR-013 | Preferences and ratings. | Implemented | Validated preference replacement and current rating/history mutation routes. |

## Non-Functional Requirements

- Validate public inputs and return predictable safe errors.
- Keep route handlers thin and scoring pure/testable.
- Keep secrets server-only and private user data out of public responses.
- Label algorithms and recommendation modes.
- Pass tests, lint, and production build.

## Success Boundary

The frontend consumes stable repository-backed reads, signed sessions, protected customer-state mutations, recommendation attribution, and interaction ingestion. Guest state is session-only and authenticated state is account-backed. The project does not claim order commerce or measured recommendation quality.
