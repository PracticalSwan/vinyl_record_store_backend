# Backend Consolidation Status

This file records current completion and deferred scope. It does not authorize continued development.

## Completed

- Next.js catalog/search/recommendation API with seed default and explicit MongoDB adapter.
- Strict models/repositories, conflict-safe catalog migration, showcase-customer seeding, and live index verification.
- Deterministic product, demo-profile, and cold-start recommendations with explanations, exclusions, diversity, and versioning.
- Signed sessions, customer registration, environment/showcase demo identities, protected state writes, account deletion, and idempotent guest merge.
- Bounded anonymous/authenticated interaction ingestion with server-derived ownership and 90-day eventual TTL.
- BFP-02 Part A exact recommendation request/list logging with privacy opt-out, seed-mode suppression, safe subjects, reasons, exclusions, and TTL.
- FFP-03/02/01 cross-repository contracts for state migration, onboarding, and attributed analytics.
- Exact-origin credentialed CORS, bounded inputs, safe errors, per-identity event cap, and transaction-backed consistency.
- Backend tests, lint, production build, Atlas connectivity, and all declared index groups verified.

## Deferred And Not Started

- BFP-02 Part B offline dataset, minimum-evidence check, baselines, and quality report.
- Demo orders, administrator catalog APIs, ingestion/artwork pipeline, payments, scraping, and deployment automation.
- Collaborative or hybrid recommendation; BFP-05 remains on hold pending the user's algorithm decision.

Detailed plans and the cross-repository order are in `FUTURE_IMPLEMENTATION_PLAN.md`. Deferred items require a separate explicit task.
