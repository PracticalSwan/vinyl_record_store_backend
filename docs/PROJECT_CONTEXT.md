# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 read-only integration service. It serves the approved demo catalog, validates listing/search queries, and produces explainable content-based recommendations for the separate React frontend.

## Implemented Scope

- Health, product list/detail, search, product recommendation, and user recommendation routes.
- Consistent JSON success/error envelopes.
- Catalog filter and identifier validation.
- Content scoring by artist, genre, decade, label, and availability.
- Exclusion of source/known-profile records, artist diversity cap, explanation generation, and algorithm version label.
- Synthetic `demo-user` profile and explicit cold-start behavior.
- Cached server-only Mongoose connection helper and a live Atlas ping command.
- Node tests plus lint and production build validation.

## Current Data Boundary

`src/data/records.js` remains the current approved demo catalog. Product responses remove seed-only display reasons. The backend can connect to Atlas through ignored local credentials and `src/lib/db/mongodb.js`, but no MongoDB model, collection, migration, or catalog persistence is active. No real user or private interaction history exists.

## Deferred Scope

- MongoDB persistence and indexes.
- Authentication and real user profiles.
- Interaction, wishlist, cart, order, rating, and recommendation-log writes.
- Admin APIs, payments, scraping, collaborative filtering, and deployment automation.

Deferred work is not in progress and requires a separate explicit task.

## Academic Focus

The backend makes recommendation decisions inspectable through deterministic weights and reasons. Offline quality claims require held-out interaction data and fair baselines; current tests cover behavior only.

## Update Rule

Update this file when implemented routes, data ownership, scoring behavior, persistence, or limitations change.
