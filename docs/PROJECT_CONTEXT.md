# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 integration service. It serves the approved catalog from the default seed adapter or explicitly selected MongoDB adapter, imports controlled catalog data, exposes approved artwork mappings, produces explainable content-based recommendations, provides signed sessions and customer-state mutations, ingests interactions, records served recommendation lists, exposes a role-gated administrator catalog-management surface, and generates privacy-safe offline evaluation reports.

## Implemented Scope

- Health, product list/detail, literal search, product recommendation, and user recommendation routes.
- Customer registration, environment-backed and MongoDB showcase logins, signed HttpOnly sessions, logout/restoration, role authorization, and registered-customer deletion.
- Protected profile/preferences, wishlist, cart, ratings, and idempotent guest-state merge routes.
- Idempotent anonymous/authenticated interaction ingestion with bounded schemas, per-identity cap, complete recommendation context, and 90-day eventual TTL.
- BFP-02 Part A request logging: server request/list IDs, exact ordered items/scores/ranks/reasons, algorithm version, mode, exclusions, surface, safe subject, and 90-day eventual TTL.
- Usage-data opt-out suppresses request logs; seed catalog mode returns attribution IDs but does not persist logs.
- Strict Mongoose models, repositories, conflict-safe seed migration, showcase-account seed workflow, and additive index verification.
- Preview-first CSV/JSON catalog imports with validation, duplicate/conflict reports, atomic apply by default, source ownership, collision-free public IDs, optional controlled partial mode, and no implicit deletion.
- Rate-limited, cached MusicBrainz and Cover Art Archive enrichment with exact-match review, release-bound artwork, server-generated provenance, and placeholders on absence or failure.
- BFP-02 Part B dataset construction, final-state relevance, temporal leave-last-positive-out split, leakage checks, shared full-catalog candidate policy, random/popularity/content-based comparison, and aggregate-only reports.
- Consistent safe envelopes, exact-origin credentialed mutations, server-derived ownership, and transaction-backed multi-document operations.
- BFP-07 administrator surface: role-gated `/api/admin/*` routes for summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, one-time preview-token catalog import apply, artwork refresh, and best-effort audit logging. Reads work in seed and mongodb mode; writes are mongodb-only (`PERSISTENCE_UNAVAILABLE` in seed mode).
- Automated catalog, persistence, migration, authentication, write, request-log, recommender behavior, metric-sanity, and administrator tests.

## Data And Privacy Boundary

`src/data/records.js` remains the approved seed/default catalog. Explicit MongoDB mode never silently falls back. MongoDB stores registered/showcase users, lists, ratings, interactions, merge receipts, and recommendation logs. Public responses omit internal IDs, secrets, subjects, cookies, and raw events. Recommendation logs and interactions use eventual TTL deletion, and account deletion removes owned demo data.

The current report is `insufficient-evidence`: no ranking-quality metrics are emitted until at least 20 subjects have 5 final positive products each. Captured-field coverage and counts remain reportable below that boundary.

## Deferred Scope

- Demo orders, payments, collaborative/hybrid ranking, and deployment automation. (Administrator catalog APIs are implemented in BFP-07; only demo orders/payments remain deferred.)
- Genuine personalization (PERS-00 through PERS-09), scheduled after BFP-07, FFP-07, and FFP-08. See `PERSONALIZATION_IMPLEMENTATION_PLAN.md`. No milestone is in progress; no quality claim is made; collaborative filtering and matrix factorization are excluded.

BFP-01, BFP-03, BFP-04, BFP-06, BFP-07, both parts of BFP-02, and the shared FFP-01/02/03/05/06/07/08 contracts are complete. Behavior tests and insufficient interaction evidence do not establish recommendation quality.

## Update Rule

Update this file when routes, data ownership, logging/privacy behavior, scoring, persistence, or limitations change.
