# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 read-only integration service. It serves the approved demo catalog from the default seed adapter or an explicitly selected MongoDB adapter, validates listing/search queries, and produces explainable content-based recommendations for the separate React frontend.

## Implemented Scope

- Health, product list/detail, search, product recommendation, and user recommendation routes.
- Consistent JSON success/error envelopes.
- Literal search, repeated controlled facets, deterministic sorting and pagination, catalog-wide facets, and bounded identifier/query validation.
- Content scoring by artist, genre, decade, label, and availability.
- Exclusion of source/known-profile records, artist diversity cap, explanation generation, and algorithm version label.
- Synthetic `demo-user` profile and explicit cold-start behavior.
- Strict Mongoose models, seed and MongoDB catalog repositories, persistence repository foundations, an idempotent seed migration, and index verification.
- Cached server-only Mongoose connection helper and explicit `CATALOG_DATA_SOURCE` selection.
- Node tests covering catalog, persistence, migration, recommender behavior, and metric sanity, plus lint and production build validation.

## Current Data Boundary

`src/data/records.js` remains the approved seed and default catalog. Product responses remove seed-only display reasons. `CATALOG_DATA_SOURCE=mongodb` explicitly selects the MongoDB catalog repository; missing configuration or connection failures return `503 PERSISTENCE_UNAVAILABLE` rather than silently falling back. The conflict-safe migration preserves numeric public IDs, and declared unique, compound, and 90-day TTL indexes can be created and verified against Atlas.

Models and repositories also define the future user, wishlist, cart, rating, interaction, order, recommendation-log, audit-log, and counter boundaries. They are not exposed through authentication or customer write routes. No real user or private interaction history exists.

## Deferred Scope

- Authentication and real user profiles.
- Interaction, wishlist, cart, order, rating, and recommendation-log writes.
- Admin APIs, payments, scraping, collaborative filtering, and deployment automation.

BFP-01 persistence and the FFP-05 read-query contract are complete. Deferred write-side work requires a separate explicit task.

## Academic Focus

The backend makes recommendation decisions inspectable through deterministic weights and reasons. Offline quality claims require held-out interaction data and fair baselines; current tests cover behavior only.

## Update Rule

Update this file when implemented routes, data ownership, scoring behavior, persistence, or limitations change.
