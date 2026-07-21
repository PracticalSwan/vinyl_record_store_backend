# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.9 integration service. It serves the approved catalog from the default seed adapter or explicitly selected MongoDB adapter, imports controlled catalog data, exposes approved artwork mappings plus proxy and local delivery paths, produces explainable content-based recommendations, provides signed sessions and customer-state mutations, ingests interactions, records served recommendation lists, exposes a role-gated administrator catalog-management surface, and generates privacy-safe offline evaluation reports.

## Implemented Scope

- Health, product list/detail, literal search, product recommendation, restricted legacy user recommendation, and session-owned `/api/recommendations/me` routes.
- Customer registration, environment-backed and MongoDB showcase logins, signed HttpOnly sessions, logout/restoration, role authorization, and registered-customer deletion.
- Protected profile/preferences, wishlist, cart, ratings, and idempotent guest-state merge routes.
- Idempotent anonymous/authenticated interaction ingestion with bounded schemas, per-identity cap, complete recommendation context, and 90-day eventual TTL.
- BFP-02 Part A request logging: server request/list IDs, exact ordered items/scores/ranks/reasons, algorithm version, mode, exclusions, surface, safe subject, and 90-day eventual TTL.
- Usage-data opt-out suppresses request logs; seed catalog mode returns attribution IDs but does not persist logs.
- PERS-00/01/02 identity boundary: safe subject descriptors, cross-user-safe legacy behavior, customer-only verified-session ownership, administrator rejection, anonymous fallback, auth-aware frontend consumption, and default-on rollback flags. Ranking remains `content-demo-v1` parity.
- Strict Mongoose models, repositories, conflict-safe seed migration, exactly three MongoDB showcase customers, one environment-backed administrator, and additive index verification.
- Preview-first CSV/JSON catalog imports with validation, duplicate/conflict reports, atomic apply by default, source ownership, collision-free public IDs, optional controlled partial mode, and no implicit deletion.
- Rate-limited, cached MusicBrainz and Cover Art Archive enrichment with exact-match review, same-release-group fallback, server-generated provenance, and placeholders on absence or failure. The bundled 116-record catalog is fully covered by a generated human-reviewed manifest (110 exact album-vinyl matches and 6 documented manual-review bindings), and both seed and Atlas modes expose the same hotlinks.
- Proxy-first artwork delivery with per-hop Cover Art Archive/Internet Archive validation, plus exactly 116 committed content-addressed JPEG fallbacks. `GET /api/artwork/local/:publicId` maps canonical catalog IDs to immutable assets; the generated local manifest records source/final URLs, MusicBrainz identity, retrieval time, MIME, size, dimensions, and SHA-256.
- BFP-02 Part B dataset construction, final-state relevance, temporal leave-last-positive-out split, leakage checks, shared full-catalog candidate policy, random/popularity/content-based comparison, and aggregate-only reports.
- Consistent safe envelopes, exact-origin credentialed mutations, server-derived ownership, and transaction-backed multi-document operations.
- BFP-07 administrator surface: role-gated `/api/admin/*` routes for summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, one-time preview-token catalog import apply, artwork refresh, and best-effort audit logging. Reads work in seed and mongodb mode; writes are mongodb-only (`PERSISTENCE_UNAVAILABLE` in seed mode).
- Automated catalog, persistence, migration, authentication, write, request-log, recommender behavior, metric-sanity, and administrator tests.

## Data And Privacy Boundary

`src/data/catalogRecords.js` combines approved store metadata with the reviewed artwork manifest for the seed/default catalog and migration. `src/data/localArtworkManifest.js` is generated only from that reviewed mapping and binds public IDs to verified files under `public/artwork/`. Explicit MongoDB mode never silently falls back. MongoDB stores registered/showcase users, lists, ratings, interactions, merge receipts, and recommendation logs. Public responses omit internal IDs, secrets, subjects, cookies, and raw events. Recommendation logs and interactions use eventual TTL deletion, and account deletion removes owned customer data.

The current report is `insufficient-evidence`: no ranking-quality metrics are emitted until at least 20 subjects have 5 final positive products each. Captured-field coverage and counts remain reportable below that boundary.

## Deferred Scope

- Demo orders, payments, collaborative/hybrid ranking, and deployment automation. (Administrator catalog APIs are implemented in BFP-07; only demo orders/payments remain deferred.)
- Preference, feedback, behavioral, popularity, and hybrid personalization (PERS-03 through PERS-09) remains planned. PERS-00 through PERS-02 are complete; no ranking-quality claim is made, and collaborative filtering and matrix factorization remain excluded.

BFP-01, BFP-03, BFP-04, BFP-06, BFP-07, BFP-08, BFP-09, both parts of BFP-02, and the shared FFP-01/02/03/05/06/07/08/09 contracts are complete. Behavior tests and insufficient interaction evidence do not establish recommendation quality.

## Update Rule

Update this file when routes, data ownership, logging/privacy behavior, scoring, persistence, or limitations change.
