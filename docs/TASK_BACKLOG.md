# Backend Task Status

Statuses are `done` or `deferred`. Deferred items are not active work.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| B-001 | Establish backend repository and instructions. | done | Agent, lesson, license, and GitHub-facing files exist. |
| B-002 | Confirm Next.js JavaScript base. | done | Next.js 16.2.9 App Router. |
| B-003 | Implement catalog list/detail/search. | done | Repository-backed literal search, repeated facets, deterministic sorts, pagination, and facet metadata. |
| B-004 | Implement content-based recommendations. | done | Product, demo-profile, and cold-start modes. |
| B-005 | Add explanations, exclusions, diversity, and version. | done | `content-demo-v1`. |
| B-006 | Connect frontend origin with CORS. | done | `FRONTEND_ORIGIN`. |
| B-007 | Add automated validation. | done | Catalog, persistence, migration, recommender, and metric tests plus lint and build. |
| B-008 | Align backend documentation. | done | Updated through the 2026-07-21 local-artwork availability pass. |
| B-009 | Add MongoDB persistence. | done | BFP-01 models, repositories, explicit source selection, seed migration, parity checks, and live index verification are complete. |
| B-010 | Add identity and write APIs. | done | BFP-04 and BFP-03 completed 2026-07-04 with auth, profile/preferences, interactions, wishlist, cart, ratings, merge, and account deletion. |
| B-011 | Build the evaluation dataset and run an offline benchmark. | done | BFP-02 Part B is implemented; the current aggregate report is `insufficient-evidence`, so no quality metrics are published. |
| B-012 | Add controlled catalog ingestion and metadata enrichment. | done | BFP-06 preview/apply, conflict handling, enrichment, caching, artwork, and provenance are implemented. |
| B-013 | Add protected admin catalog management. | done | Completed 2026-07-09 in BFP-07: role-gated admin routes, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, preview-token import apply, artwork refresh, and best-effort audit logging. Writes are mongodb-only. |
| B-014 | Select and implement a future recommender method. | deferred | BFP-05 is explicitly on hold pending the user's algorithm decision. |
| B-015 | Persist exact recommendation request/list output. | done | BFP-02 Part A completed with attribution, privacy opt-out, ordered reasons, and TTL. |
| B-016 | Enforce recommendation identity from the verified session. | done | PERS-01 / BFP-08 completed 2026-07-10 with safe subject descriptors, restricted legacy behavior, admin denial, and cross-user contract tests. |
| B-017 | Add the session-owned recommendation endpoint. | done | PERS-02 / BFP-09 completed 2026-07-10 with `GET /api/recommendations/me`, customer-session ownership, anonymous fallback, parity ranking, logging ownership, and rollback flag. |
| B-018 | Build the unified recommendation profile and feedback domain. | deferred | PERS-03 / BFP-10; recompute-on-demand profile, durable feedback collection. |
| B-019 | Add preference-aware ranking. | deferred | PERS-04 / BFP-11; hard constraints, soft scores, truthful explanations. |
| B-020 | Add first-class negative feedback. | deferred | PERS-05 / BFP-12; not-interested, already-own, undo, optional show-fewer-like-this. |
| B-021 | Add behavioral-signal personalization. | deferred | PERS-06 / BFP-13; differentiated signal strength, opt-out boundary fix. |
| B-022 | Add the popularity baseline and fallback ladder. | deferred | PERS-07 / BFP-14; aggregate-evidence popularity with feedback-loop safeguards. |
| B-023 | Add hybrid recommendation orchestration. | deferred | PERS-08 / BFP-15; normalized component scores, diversity reranking, version `personalized-hybrid-v1`. |
| B-024 | Integrate, harden, and close personalization documentation. | deferred | PERS-09 / BFP-16; end-to-end integration, regression protection, documentation closure. |
| B-025 | Add deterministic local artwork availability. | done | Completed 2026-07-21 with 116 reviewed content-addressed JPEGs, a canonical-ID endpoint, strict acquisition/verifier tooling, proxy redirect hardening, full tests, browser screenshots, and independent review. |
