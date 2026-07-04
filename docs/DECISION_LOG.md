# Backend Decision Log

These decisions define the consolidated backend baseline.

## BDEC-001: Keep Next.js And JavaScript

Date: 2026-07-02

Decision: Keep the current Next.js 16.2.9 App Router and JavaScript modules.

Rationale: The read API is small, validated, testable, and builds cleanly. A TypeScript migration would expand scope without changing the requested integration outcome.

## BDEC-002: Use An Approved Demo Seed Before MongoDB

Date: 2026-07-02

Decision: Serve `src/data/records.js` through the repository/API boundary as the default catalog while MongoDB is not explicitly selected.

Rationale: The frontend can integrate now without fake credentials or an undocumented external dependency. Public product normalization removes legacy seed-only reasons.

Status update, 2026-07-03: BFP-01 added strict models, repositories, a conflict-safe seed migration, and index verification. The seed remains the default; explicit `CATALOG_DATA_SOURCE=mongodb` selection uses Atlas without silent fallback.

## BDEC-003: Start With Deterministic Content Ranking

Date: 2026-07-02

Decision: Score artist, genre, decade, label, and availability with documented fixed weights.

Rationale: The logic is explainable and testable without interaction data. Collaborative methods would be unsupported.

## BDEC-004: Separate Demo Profile And Cold Start

Date: 2026-07-02

Decision: Only `demo-user` receives the synthetic profile; all other valid IDs receive clearly labeled cold-start results.

Rationale: This prevents false personalization claims.

## BDEC-005: Keep Write Features Deferred

Date: 2026-07-02

Decision: Do not expose interaction, wishlist, cart, order, or recommendation-log writes until identity and the corresponding write contracts are implemented.

Rationale: Persistence models alone do not provide authorization, idempotency, privacy controls, or complete write-side consistency.

Status update, 2026-07-04: BFP-04 and BFP-03 satisfied this gate. The implemented write surface uses signed sessions, exact-origin checks, bounded schemas, server-derived ownership, idempotency, and transaction-backed consistency. Demo orders, recommendation-request logging, and administrator catalog writes remain deferred.

## BDEC-006: Distinguish Behavior Tests From Quality Metrics

Date: 2026-07-02

Decision: Test deterministic rules and metric sanity, but report no offline quality score until a leakage-safe dataset and baselines exist.

Rationale: A top-k metric without held-out relevance and fair baselines is not valid evaluation evidence.

## BDEC-007: Make Catalog Persistence Explicit

Date: 2026-07-03

Decision: Default `CATALOG_DATA_SOURCE` to `seed` and require explicit `mongodb` selection with valid Atlas configuration. Never silently fall back after MongoDB has been selected.

Rationale: The local academic demo remains deterministic and available without credentials, while database failures stay visible instead of producing ambiguous mixed-source responses.

## BDEC-008: Keep Search Literal And Repository-Equivalent

Date: 2026-07-03

Decision: Use case-insensitive literal substring search, controlled repeated facets, and stable public-ID tie-breakers in both catalog repositories.

Rationale: Literal behavior is predictable for the small catalog, prevents regex input from changing query meaning, and keeps seed and MongoDB results contract-equivalent.

## BDEC-009: Seed Migration Preserves Soft-Delete Tombstones

Date: 2026-07-03

Decision: The seed migration reconciles catalog content only. `deletedAt` is not a managed field and is never written in an update payload, so an operator's soft-deleted demo-seed record survives any seed re-run.

Rationale: A re-run that wrote `deletedAt: null` over a tombstone would silently resurrect records the operator intentionally hid, contradicting the documented "soft-deleted products must be excluded by default" rule with no log, conflict, or exit-code signal. Creates still seed `deletedAt: null`; updates leave tombstone state untouched.

## BDEC-010: Use Small Server-Enforced Sessions And Idempotent Customer Writes

Date: 2026-07-04

Decision: Use scrypt username/password authentication, signed eight-hour HttpOnly cookies, registered customer accounts plus environment-backed demo identities, and session-derived ownership for profile, wishlist, cart, rating, interaction, merge, and account-deletion routes.

Rationale: This supplies a real authorization boundary without introducing email recovery, third-party identity, or production payment scope. Exact-origin checks, bounded bodies, generic login failures, stable event IDs, merge receipts, and MongoDB transactions address the principal risks for the classroom write surface.

## BDEC-011: Simplified Auth To Two Roles With Env-Only Admin

Date: 2026-07-04

Decision: The authentication surface keeps only two roles (`customer`, `admin`). The administrator account is environment-only (`AUTH_DEMO_ADMIN_*`). The shared classroom demo customer is environment-only (`AUTH_DEMO_CUSTOMER_*`) with ephemeral preferences. Registered customers persist in MongoDB and require MongoDB mode. Login rate limiting, server-side session-version revocation, the seeded-profile upsert/merge path, and the administrator-promotion script were removed. A per-identity interaction-ingestion cap (`src/lib/interactionCap.js`) replaces login rate limiting as the write-amplification control.

Rationale: This is a classroom recommender-systems demo, not a production identity provider. Keeping scrypt hashing, signed HttpOnly sessions, exact-origin checks, server-derived ownership, bounded write validation, and guest-merge idempotency preserves the real authorization boundary. Removing the demo-account persistence shadowing (which silently reverted role changes) and the unused revocation machinery reduces the surface to what the course exercises.

Accepted trade-off: logout clears the cookie but does not invalidate a stolen token server-side; such a token is valid until its eight-hour TTL. This is documented as a classroom-demo limitation.
