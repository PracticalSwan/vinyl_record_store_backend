# Backend Project Context

This is the backend source of truth for the Vinyl Record Store Recommender System.

## Current State

The backend is a Next.js 16.2.12 integration service. Seed mode serves the 116-record curated catalog without a database. MongoDB mode currently serves immutable Amazon Reviews 2023 v3 research data from `datasetProducts` while retaining v1, v2, and all 116 legacy records for non-destructive rollback. The service imports controlled catalog data, exposes approved artwork mappings plus proxy and local delivery paths, produces explainable content-based recommendations, provides signed sessions and customer-state mutations, ingests interactions, records served recommendation lists, exposes a role-gated administrator catalog-management surface, and generates privacy-safe evaluation-readiness reports.

## Implemented Scope

- Health, product list/detail, literal search, product recommendation, restricted legacy user recommendation, and session-owned `/api/recommendations/me` routes.
- Customer registration, MongoDB-backed registered/showcase customer logins, the environment-backed administrator login, signed HttpOnly sessions, logout/restoration, role authorization, and registered-customer deletion.
- Protected profile/preferences, wishlist, cart, ratings, and idempotent guest-state merge routes.
- Idempotent anonymous/authenticated interaction ingestion with bounded schemas, per-identity cap, complete recommendation context, and 90-day eventual TTL.
- BFP-02 Part A request logging: server request/list IDs, exact ordered items/scores/ranks/reasons, algorithm version, mode, exclusions, surface, safe subject, and 90-day eventual TTL.
- Usage-data opt-out suppresses request logs; seed catalog mode returns attribution IDs but does not persist logs.
- PERS-00/01/02 identity boundary: safe subject descriptors, cross-user-safe legacy behavior, customer-only verified-session ownership, administrator rejection, anonymous fallback, auth-aware frontend consumption, and default-on rollback flags. Ranking remains `content-demo-v1` parity.
- PERS-03 through PERS-09: server-internal on-demand profiles, durable exact-item feedback, `preference-profile-v1`, `behavior-profile-v1`, `popularity-v1`, and `personalized-hybrid-v1` scoring, one candidate/exclusion pass, lifecycle-safe exact-list logging, and default-off fail-closed ranking flags. No public profile/source fields or quality claim was added; `content-demo-v1` remains the rollback path.
- NEXT-04/NEXT-05 closure: the final classroom environment is MongoDB/v3 Profile B, enabling only session-owned profile/preference ranking and exact feedback while behavior, popularity, and hybrid remain off. It passed the selected-profile multi-browser and failure/data-preservation gates; committed defaults remain unchanged. See `DEMO_PERSONALIZATION_RUNBOOK.md` and the root `FINAL_RELEASE_READINESS_REPORT.md`.
- Strict Mongoose models, repositories, conflict-safe seed migration, exactly three MongoDB showcase customers, one environment-backed administrator, and additive index verification.
- DATA-00 through DATA-15 v3 closure: pinned-source streaming transformation, controlled canonical taxonomy, conservative artist/year semantics, stable cross-version product IDs, exact immutable row digests, strict MusicBrainz/Cover Art Archive enrichment with verified local fallbacks, HMAC-pseudonymous historical identities, 2,305 source-derived catalog records, 20,288 isolated historical ratings from 2,387 subjects, transactional activation/rollback, and aggregate-only leakage-safe readiness checks. V3 adds authoritative MusicBrainz release-group first-release-date enrichment for the 208 strict-match accepted products (208 of 2,305 now have a non-null original-release year).
- Preview-first CSV/JSON catalog imports with validation, duplicate/conflict reports, atomic apply by default, source ownership, collision-free public IDs, optional controlled partial mode, and no implicit deletion.
- Rate-limited, cached MusicBrainz and Cover Art Archive enrichment with exact normalized titles, strong artist agreement, official vinyl search evidence, unique release groups, server-generated provenance, and placeholders on ambiguity or absence. MusicBrainz release-search omits release-group first-release-date, so the enrichment script hydrates original-release year from the release-group detail after a strict unique match. The CAA metadata path retries bounded transient failures (network errors, 429, 5xx) with exponential backoff. The 116-record legacy set and every accepted dataset match have separately verified content-addressed local JPEG fallbacks; Amazon product images are not used.
- Proxy-first artwork delivery with per-hop Cover Art Archive/Internet Archive validation, plus exactly 116 committed legacy JPEG fallbacks and a separate exact current-v3 set (208 files). V2 rollback evidence pins the same stable dataset assets independently. `GET /api/artwork/local/:publicId` maps canonical catalog IDs to immutable assets; the generated manifests record source/final URLs, MusicBrainz identity, retrieval time, MIME, size, dimensions, and SHA-256.
- BFP-02 Part B live dataset construction plus the separate NEXT-01 through NEXT-03 historical runner: pinned stored splits, stage-specific shared full-catalog cohorts, deterministic random/positive-popularity/content baselines, source-and-result-bound validation sealing, one frozen observed-only biased-MF experiment, a permanent one-time test claim, and aggregate-only reports. The final test is complete and cannot be rerun.
- Consistent safe envelopes, exact-origin credentialed mutations, server-derived ownership, and transaction-backed multi-document operations.
- BFP-07 administrator surface: role-gated `/api/admin/*` routes for summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, one-time preview-token catalog import apply, artwork refresh, and best-effort audit logging. Reads work in seed and mongodb mode; writes are mongodb-only (`PERSISTENCE_UNAVAILABLE` in seed mode).
- Automated catalog, persistence, migration, authentication, write, request-log, recommender behavior, metric-sanity, and administrator tests.

## Data And Privacy Boundary

`src/data/catalogRecords.js` combines approved store metadata with the reviewed artwork manifest for the seed/default catalog and migration. `src/data/localArtworkManifest.js` is generated only from that reviewed mapping and binds public IDs to verified files under `public/artwork/`. The active dataset pointer selects one MongoDB catalog version; no active pointer selects the preserved legacy records. MongoDB also stores registered/showcase users, lists, ratings, interactions, merge receipts, recommendation logs, versioned dataset imports, and isolated historical Amazon ratings. Public responses omit internal IDs, secrets, reviewer pseudonyms, raw historical rows, subjects, cookies, and raw events. Recommendation logs and interactions use eventual TTL deletion; historical evidence is versioned and has no TTL.

The historical adapter reported 1,708 final-test-ready subjects, while NEXT-01 train-to-validation evaluated a distinct 1,823-subject cohort. NEXT-03 used the frozen protocol and common 1,708-subject positive-target test cohort: NDCG@10 was `0.000910` random, `0.022427` positive-popularity, `0.043214` content, and `0.002301` biased MF. The cohort excludes 679 structurally eligible subjects without a relevant test target, so it is not an all-subject estimate. The deployed ranker and live-customer evaluator are unchanged.

The current live Part B report is `insufficient-evidence`: no live-customer ranking-quality metrics are emitted until at least 20 subjects have 5 final positive products each. Captured-field coverage and counts remain reportable below that boundary. This does not negate the separately sealed aggregate historical metrics above.

## Deferred Scope

- Demo orders, payments, deployment automation, ranking-flag production enablement, and live collaborative/matrix-factorization integration. PERS-09 integration closure and the administrator catalog APIs are implemented.
- PERS-00 through PERS-09 and NEXT-01 through NEXT-05 are complete and independently approved. PERS-04 through PERS-08 remain behind default-off flags. The bounded biased-MF experiment was negative and remains offline-only; Profile B is an explicit classroom environment, not a default; no historical evidence is a live hybrid quality claim.

BFP-01, BFP-03, BFP-04, BFP-06, BFP-07, BFP-08, BFP-09, both parts of BFP-02, and the shared FFP-01/02/03/05/06/07/08/09 contracts are complete. Behavior tests and insufficient interaction evidence do not establish recommendation quality.

## Update Rule

Update this file when routes, data ownership, logging/privacy behavior, scoring, persistence, or limitations change.
