# Backend Consolidation Status

This file records current completion and deferred scope. It does not authorize continued development.

## Completed

- Next.js catalog/search/recommendation API with seed default and explicit MongoDB adapter.
- Strict models/repositories, conflict-safe catalog migration, showcase-customer seeding, and live index verification.
- Deterministic product, demo-profile, and cold-start recommendations with explanations, exclusions, diversity, and versioning.
- PERS-00/01/02 architecture freeze, identity-safe legacy behavior, session-owned customer endpoint, administrator denial, anonymous fallback, and cross-repository switch-over with stale-response protection.
- Signed sessions, customer registration, one environment-backed administrator, three deletion-protected MongoDB showcase customers, protected state writes, ordinary-customer account deletion, and idempotent guest merge.
- Bounded anonymous/authenticated interaction ingestion with server-derived ownership and 90-day eventual TTL.
- BFP-02 Part A exact recommendation request/list logging with privacy opt-out, seed-mode suppression, safe subjects, reasons, exclusions, and TTL.
- BFP-06 validated CSV/JSON preview/apply ingestion, source/conflict safeguards, MusicBrainz/Cover Art enrichment, structured artwork, caching, and provenance. The 2026-07-12 curation pass added a reviewed mapping and live hotlink for every bundled record; the 2026-07-21 hardening pass added per-hop proxy validation and exactly 116 verified local JPEG fallbacks.
- BFP-02 Part B pseudonymized dataset construction, evidence gating, leakage-safe split, matched baselines, aggregate coverage reporting, and reproducible report generation.
- FFP-03/02/01 cross-repository contracts for state migration, onboarding, and attributed analytics.
- Exact-origin credentialed CORS, bounded inputs, safe errors, per-identity event cap, and transaction-backed consistency.
- Backend tests, lint, production build, Atlas connectivity, and all declared index groups verified.
- BFP-07 administrator catalog APIs and the matching FFP-07 administrator workspace; FFP-08 client-only simulated checkout.
- DATA-00 through DATA-15 corrected v3 external-dataset integration: pinned Amazon source, controlled taxonomy/year semantics, authoritative original-year hydration for 208 accepted matches, stable cross-version identities, immutable sealed storage, exact local fallbacks, 2,305 active research products, 20,288 isolated ratings, v2 immediate rollback, v1/legacy preservation, exact-three-user verification, separate seed/dataset browser coverage, and a readiness-only evaluation adapter. The 2026-08-08 v2 migration record remains historical evidence.
- PERS-03 through PERS-09 / BFP-10 through BFP-16: on-demand account profile, default-off preference/behavior/popularity/hybrid ranking, exact feedback, pure scoring below service-owned reads, lifecycle-safe exact-list logging, failure/privacy/data regression coverage, and documentation closure.

## Deferred And Not Started

- A ranking-quality conclusion: live evidence remains `insufficient-evidence`, while historical Amazon evidence is data-ready but has not been used to run an approved recommender experiment.
- Backend order APIs, real payments, scraping, and deployment automation.
- Ranking-flag production enablement, collaborative filtering, matrix factorization/SVD, and learned ranking remain separate decisions. BFP-05 is only a historical placeholder whose open method question was resolved by PERS-00.

Detailed plans and the cross-repository order are in `FUTURE_IMPLEMENTATION_PLAN.md`. Deferred items require a separate explicit task.
