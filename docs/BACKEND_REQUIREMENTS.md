# Backend Requirements

Requirement status reflects the integrated academic demo as of 2026-07-03.

## Requirement Status

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| BR-001 | Product listing data. | Implemented | `/api/products`. |
| BR-002 | Product detail data. | Implemented | `/api/products/:id`. |
| BR-003 | Search and filters. | Implemented | Literal search, repeated facets, deterministic sorts, pagination, and catalog-wide facet metadata. |
| BR-004 | Interaction logging. | Deferred | Requires identity and persistence. |
| BR-005 | Wishlist, cart, and order writes. | Deferred | Frontend remains local demo state. |
| BR-006 | Product-based recommendations. | Implemented | Content similarity endpoint. |
| BR-007 | User-based recommendations. | Demo only | Synthetic profile or cold-start result. |
| BR-008 | Recommendation explanations. | Implemented | Generated from matched metadata. |
| BR-009 | Recommendation output logging. | Deferred | Requires persistent evaluation store. |
| BR-010 | Admin product management. | Deferred | Outside current demo scope. |
| BR-011 | Optional MongoDB catalog persistence. | Implemented | Explicit data-source selection, strict models, repository parity, conflict-safe seed migration, and index verification. |

## Non-Functional Requirements

- Validate public inputs and return predictable safe errors.
- Keep route handlers thin and scoring pure/testable.
- Keep secrets server-only and private user data out of public responses.
- Label algorithms and recommendation modes.
- Pass tests, lint, and production build.

## Success Boundary

The frontend can consume stable repository-backed read routes and understand why items were ranked. MongoDB catalog reads are implemented, but the project does not claim persistent customer commerce or measured recommendation quality.
