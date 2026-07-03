# Backend Consolidation Status

This file records current completion and deferred scope. It does not authorize continued development.

## Completed

- Next.js read-only API foundation.
- Approved demo catalog and public product normalization.
- Product listing/detail and search routes with literal search, repeated facets, deterministic sorting, pagination, and catalog-wide facets.
- Optional MongoDB catalog reads behind explicit data-source selection, with seed mode remaining the default.
- Strict Mongoose models and persistence repositories for the planned data boundaries.
- Conflict-safe, idempotent seed migration and live index verification.
- Product similarity, synthetic demo-profile, and cold-start recommendations.
- Explanations, exclusions, stock preference, artist diversity cap, and algorithm versioning.
- CORS configuration for the separate Vite frontend.
- Catalog/recommender behavior tests, metric sanity test, lint, and production build.
- Current instructions, README, contracts, architecture, data, evaluation, risk, decision, and setup docs.

## Deferred And Not Started

- Authentication and real user profiles.
- Interaction, wishlist, cart, order, rating, and recommendation-log writes.
- Admin product management, payments, scraping, and deployment automation.
- Collaborative or hybrid recommendation.
- Offline benchmark with random and popularity baselines.

Detailed plans and the approved cross-repository implementation order are in `FUTURE_IMPLEMENTATION_PLAN.md`. BFP-01 persistence and the backend FFP-05 read-query work are complete. Recommender algorithm selection remains on hold, and authentication, customer writes, deployment, scraping, real payments, and production commerce remain out of scope.

Deferred items require a separate explicit implementation task.
