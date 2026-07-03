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
