# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 integration service. It serves the approved catalog from the default seed adapter or explicitly selected MongoDB adapter, produces explainable content-based recommendations, provides signed sessions and customer-state mutations, ingests interactions, and records served recommendation lists in MongoDB mode.

## Implemented Scope

- Health, product list/detail, literal search, product recommendation, and user recommendation routes.
- Customer registration, environment-backed and MongoDB showcase logins, signed HttpOnly sessions, logout/restoration, role authorization, and registered-customer deletion.
- Protected profile/preferences, wishlist, cart, ratings, and idempotent guest-state merge routes.
- Idempotent anonymous/authenticated interaction ingestion with bounded schemas, per-identity cap, complete recommendation context, and 90-day eventual TTL.
- BFP-02 Part A request logging: server request/list IDs, exact ordered items/scores/ranks/reasons, algorithm version, mode, exclusions, surface, safe subject, and 90-day eventual TTL.
- Usage-data opt-out suppresses request logs; seed catalog mode returns attribution IDs but does not persist logs.
- Strict Mongoose models, repositories, conflict-safe seed migration, showcase-account seed workflow, and additive index verification.
- Consistent safe envelopes, exact-origin credentialed mutations, server-derived ownership, and transaction-backed multi-document operations.
- Automated catalog, persistence, migration, authentication, write, request-log, recommender behavior, and metric-sanity tests.

## Data And Privacy Boundary

`src/data/records.js` remains the approved seed/default catalog. Explicit MongoDB mode never silently falls back. MongoDB stores registered/showcase users, lists, ratings, interactions, merge receipts, and recommendation logs. Public responses omit internal IDs, secrets, subjects, cookies, and raw events. Recommendation logs and interactions use eventual TTL deletion, and account deletion removes owned demo data.

## Deferred Scope

- BFP-02 Part B dataset construction, minimum-evidence check, leakage-safe split, baselines, and offline report.
- Demo orders, administrator catalog APIs, artwork/ingestion work, payments, collaborative/hybrid ranking, and deployment automation.

BFP-01, BFP-03, BFP-04, BFP-02 Part A, and the shared FFP-01/02/03/05 contracts are complete. Behavior tests and stored events do not establish recommendation quality.

## Update Rule

Update this file when routes, data ownership, logging/privacy behavior, scoring, persistence, or limitations change.
