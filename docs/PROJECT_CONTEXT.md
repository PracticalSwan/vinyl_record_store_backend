# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 integration service. It serves the approved demo catalog from the default seed adapter or an explicitly selected MongoDB adapter, produces explainable content-based recommendations, and provides signed sessions plus MongoDB-backed customer-state mutations for the separate React frontend.

## Implemented Scope

- Health, product list/detail, search, product recommendation, and user recommendation routes.
- Customer registration, registered/seeded login, signed HttpOnly sessions, logout, session restoration, role authorization, and registered-customer deletion.
- Protected profile/preferences, wishlist, cart, ratings, and idempotent guest-state merge routes.
- Idempotent anonymous or authenticated interaction ingestion with a 90-day retention target.
- Consistent JSON success/error envelopes.
- Literal search, repeated controlled facets, deterministic sorting and pagination, catalog-wide facets, and bounded identifier/query validation.
- Content scoring by artist, genre, decade, label, and availability.
- Exclusion of source/known-profile records, artist diversity cap, explanation generation, and algorithm version label.
- Synthetic `demo-user` profile and explicit cold-start behavior.
- Strict Mongoose models, seed and MongoDB catalog repositories, active customer-state repositories, an idempotent seed migration, and index verification.
- Cached server-only Mongoose connection helper and explicit `CATALOG_DATA_SOURCE` selection.
- Node tests covering catalog, persistence, migration, authentication, write validation/state, recommender behavior, and metric sanity, plus lint and production build validation.

## Current Data Boundary

`src/data/records.js` remains the approved seed and default catalog. Product responses remove seed-only display reasons. `CATALOG_DATA_SOURCE=mongodb` explicitly selects the MongoDB catalog repository; missing configuration or connection failures return `503 PERSISTENCE_UNAVAILABLE` rather than silently falling back. The conflict-safe migration preserves numeric public IDs, and declared unique, compound, and 90-day TTL indexes can be created and verified against Atlas.

MongoDB mode stores registered/seed-profile users, wishlists, carts, ratings, interactions, and idempotent merge receipts behind session-derived ownership. Password fields are non-selecting, public responses omit internal ObjectIds and secrets, event/log TTL deletion is eventual, and account deletion transactionally removes the registered customer's owned demo data. The repository also defines deferred order, recommendation-log, audit-log, and counter boundaries.

## Deferred Scope

- Frontend migration of local wishlist/cart/rating state to the implemented write routes.
- Recommendation-request logging, offline evaluation, and demo-order writes.
- Admin APIs, payments, scraping, collaborative filtering, and deployment automation.

BFP-01 persistence, BFP-04 authentication, BFP-03 customer writes, and the FFP-05 read-query contract are complete. Deferred surfaces require separate explicit tasks.

## Academic Focus

The backend makes recommendation decisions inspectable through deterministic weights and reasons. Offline quality claims require held-out interaction data and fair baselines; current tests cover behavior only.

## Update Rule

Update this file when implemented routes, data ownership, scoring behavior, persistence, or limitations change.
