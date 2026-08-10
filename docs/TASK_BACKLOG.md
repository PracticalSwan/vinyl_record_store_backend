# Backend Task Status

Statuses are `done` or `deferred`. Deferred items are not active work.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| B-001 | Establish backend repository and instructions. | done | Agent, lesson, license, and GitHub-facing files exist. |
| B-002 | Confirm Next.js JavaScript base. | done | Next.js 16.2.12 App Router. |
| B-003 | Implement catalog list/detail/search. | done | Repository-backed literal search, repeated facets, deterministic sorts, pagination, and facet metadata. |
| B-004 | Implement content-based recommendations. | done | Product, demo-profile, and cold-start modes. |
| B-005 | Add explanations, exclusions, diversity, and version. | done | `content-demo-v1`. |
| B-006 | Connect frontend origin with CORS. | done | `FRONTEND_ORIGIN`. |
| B-007 | Add automated validation. | done | Catalog, persistence, migration, recommender, and metric tests plus lint and build. |
| B-008 | Align backend documentation. | done | Updated through the 2026-08-08 DATA-00 through DATA-15 closure and live migration evidence. |
| B-009 | Add MongoDB persistence. | done | BFP-01 models, repositories, explicit source selection, seed migration, parity checks, and live index verification are complete. |
| B-010 | Add identity and write APIs. | done | BFP-04 and BFP-03 completed 2026-07-04 with auth, profile/preferences, interactions, wishlist, cart, ratings, merge, and account deletion. |
| B-011 | Build the evaluation dataset and run an offline benchmark. | done | BFP-02 Part B is implemented; the current aggregate report is `insufficient-evidence`, so no quality metrics are published. |
| B-012 | Add controlled catalog ingestion and metadata enrichment. | done | BFP-06 preview/apply, conflict handling, enrichment, caching, artwork, and provenance are implemented. |
| B-013 | Add protected admin catalog management. | done | Completed 2026-07-09 in BFP-07: role-gated admin routes, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, preview-token import apply, artwork refresh, and best-effort audit logging. Writes are mongodb-only. |
| B-014 | Historical future-recommender placeholder. | deferred | BFP-05 stays on hold and must not be implemented separately; its method-selection question is resolved by the approved PERS roadmap (preference, behavior, popularity, true hybrid). |
| B-015 | Persist exact recommendation request/list output. | done | BFP-02 Part A completed with attribution, privacy opt-out, ordered reasons, and TTL. |
| B-016 | Enforce recommendation identity from the verified session. | done | PERS-01 / BFP-08 completed 2026-07-10 with safe subject descriptors, restricted legacy behavior, admin denial, and cross-user contract tests. |
| B-017 | Add the session-owned recommendation endpoint. | done | PERS-02 / BFP-09 completed 2026-07-10 with `GET /api/recommendations/me`, customer-session ownership, anonymous fallback, parity ranking, logging ownership, and rollback flag. |
| B-018 | Build the unified recommendation profile and feedback domain. | done | PERS-03 / BFP-10; recompute-on-demand server-internal profile, durable feedback collection, bounded interaction read, and transactional cleanup. Default-off `PERS_PROFILE_DOMAIN`. |
| B-019 | Add preference-aware ranking. | done | PERS-04 / BFP-11; knowledge-based soft scores over actual stored preferences, research-null fields neutral, `preference-profile-v1`. Default-off `PERS_PREFERENCE_RANKING`. |
| B-020 | Add first-class negative feedback. | done | PERS-05 / BFP-12; exact-item not-interested/already-own plus idempotent undo and frontend controls; show-fewer deferred. Default-off `PERS_NEGATIVE_FEEDBACK`. |
| B-021 | Add behavioral-signal personalization. | done | PERS-06 / BFP-13 completed 2026-08-10; current durable state + bounded opt-in passive content affinity; removals not negative taste; default-off `PERS_BEHAVIORAL_RANKING`. |
| B-022 | Add the popularity baseline and fallback ladder. | done | PERS-07 / BFP-14 completed 2026-08-10; active-dataset historical rating-count popularity; offline train-only baseline remains separate; default-off `PERS_POPULARITY`. |
| B-023 | Add hybrid recommendation orchestration. | done | PERS-08 / BFP-15 completed 2026-08-10; blend only when preference + behavior both exist, add popularity if available, keep lower modes pure, version `personalized-hybrid-v1`; default-off `PERS_HYBRID`. |
| B-024 | Integrate, harden, and close personalization documentation. | deferred | PERS-09 / BFP-16; existing `/me` integration, read-only DATA-15 regression protection, documentation closure; new ranking flags remain off. |
| B-025 | Add deterministic local artwork availability. | done | Completed 2026-07-21 with 116 reviewed content-addressed JPEGs, a canonical-ID endpoint, strict acquisition/verifier tooling, proxy redirect hardening, full tests, browser screenshots, and independent review. |
| B-026 | Integrate the current Amazon Reviews 2023 dataset. | done | Immutable v3 is active with authoritative original years for 208 accepted matches, 2,305 research products, 20,288 isolated ratings, v2 as the immediate rollback release, v1 as the identity base, exact three-showcase-user preservation, exact local coverage, and readiness-only evaluation. The 2026-08-08 v2 migration/rollback record remains historical evidence. |
