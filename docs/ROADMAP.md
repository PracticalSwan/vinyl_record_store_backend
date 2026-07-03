# Backend Consolidation Status

This file records current completion and deferred scope. It does not authorize continued development.

## Completed

- Next.js read-only API foundation.
- Approved demo catalog and public product normalization.
- Product listing/detail and search routes with validation.
- Product similarity, synthetic demo-profile, and cold-start recommendations.
- Explanations, exclusions, stock preference, artist diversity cap, and algorithm versioning.
- CORS configuration for the separate Vite frontend.
- Catalog/recommender behavior tests, metric sanity test, lint, and production build.
- Current instructions, README, contracts, architecture, data, evaluation, risk, decision, and setup docs.

## Deferred And Not Started

- MongoDB models, repositories, collections, indexes, seed migration, and data-source switching.
- Authentication and real user profiles.
- Interaction, wishlist, cart, order, rating, and recommendation-log writes.
- Admin product management, payments, scraping, and deployment automation.
- Collaborative or hybrid recommendation.
- Offline benchmark with random and popularity baselines.

Detailed plans and the approved cross-repository implementation order are in `FUTURE_IMPLEMENTATION_PLAN.md`. Atlas connectivity is verified, but models, collections, migration, and persistence remain deferred. Recommender algorithm selection remains on hold, and deployment, scraping, real payments, and production commerce remain out of scope.

Deferred items require a separate explicit implementation task.
