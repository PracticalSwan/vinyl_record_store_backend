# Backend Requirements

Requirement status reflects the integrated academic demo as of 2026-08-08.

## Requirement Status

| ID | Requirement | Status | Evidence |
| --- | --- | --- | --- |
| BR-001 | Product listing data. | Implemented | `/api/products`. |
| BR-002 | Product detail data. | Implemented | `/api/products/:id`. |
| BR-003 | Search and filters. | Implemented | Literal search, repeated facets, deterministic sorts, pagination, and catalog-wide facet metadata. |
| BR-004 | Interaction ingestion. | Implemented | Anonymous/authenticated bounded event batches with idempotent event IDs. |
| BR-005 | Wishlist and cart writes. | Implemented | Session-owned wishlist, absolute cart quantities, totals, warnings, and guest merge. Demo orders remain deferred. |
| BR-006 | Product-based recommendations. | Implemented | Content similarity endpoint. |
| BR-007 | User-based recommendations. | Implemented identity boundary | Restricted synthetic showcase, session-owned customer cold-start, or anonymous fallback; preference/behavior ranking remains deferred. |
| BR-008 | Recommendation explanations. | Implemented | Generated from matched metadata. |
| BR-009 | Recommendation output logging. | Implemented | Exact MongoDB-mode served-list logs with request/list IDs, attribution, opt-out, and TTL. |
| BR-010 | Admin product management. | Implemented | Role-gated summary, product CRUD, soft-delete/restore, import apply, artwork refresh, optimistic concurrency, and audit summaries; writes require MongoDB mode. |
| BR-011 | Optional MongoDB catalog persistence. | Implemented | Explicit data-source selection, strict models, repository parity, conflict-safe seed migration, and index verification. |
| BR-012 | Authentication and authorization. | Implemented | Registration, seeded/registered login, signed HttpOnly sessions, logout, restoration, role checks, and account deletion. |
| BR-013 | Preferences and ratings. | Implemented | Validated preference replacement and current rating/history mutation routes. |
| BR-014 | Controlled catalog ingestion and artwork. | Implemented | Preview/apply CSV/JSON import, source/conflict safeguards, verified enrichment/provenance, structured public artwork, a bounded remote proxy, a hash-verified local JPEG fallback for all 116 legacy records, an exact current-v3 fallback set, and independently pinned v2 rollback evidence. |
| BR-015 | Offline recommender evaluation. | Implemented | Pseudonymized dataset, evidence gate, leakage-safe split, matched baselines, and aggregate-only reporting. |
| BR-016 | Versioned external research dataset. | Implemented | DATA-00 through DATA-15: pinned provenance/hashes, ignored raw boundary, streaming deterministic subset, stable cross-version IDs, exact sealed records, conservative metadata, strict reviewed artwork with complete accepted local coverage, 2,305 active v3 products, 20,288 isolated ratings, v2 immediate rollback and v1 identity-base preservation, exact-three-user verification, and readiness-only reporting. |

## Non-Functional Requirements

- Validate public inputs and return predictable safe errors.
- Keep route handlers thin and scoring pure/testable.
- Keep secrets server-only and private user data out of public responses.
- Label algorithms and recommendation modes.
- Pass tests, lint, and production build.

## Success Boundary

The frontend consumes stable repository-backed reads, dynamic facets, nullable source-aware products, signed sessions, protected customer-state mutations, recommendation attribution, interaction ingestion, and backend-approved artwork. Guest state is session-only and authenticated state is account-backed. Historical Amazon evidence is versioned and isolated from live customer data. Its adapter is `ready`, while the deployed live evaluator remains `insufficient-evidence`; neither status is a quality score. The project does not claim order commerce or measured recommendation quality.
