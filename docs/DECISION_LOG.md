# Backend Decision Log

These decisions define the consolidated backend baseline.

## BDEC-001: Keep Next.js And JavaScript

Date: 2026-07-02

Decision: Keep the current Next.js 16.2.12 App Router and JavaScript modules.

Rationale: The read API is small, validated, testable, and builds cleanly. A TypeScript migration would expand scope without changing the requested integration outcome.

Status update, 2026-08-02: advanced within the existing Next.js 16.2 line to 16.2.12 and aligned `eslint-config-next`; dependency overrides pin patched PostCSS 8.5.18 and Sharp 0.35.0. Tests, lint, the production build, and the complete npm audit all pass.

## BDEC-002: Use An Approved Demo Seed Before MongoDB

Date: 2026-07-02

Decision: Serve `src/data/records.js` through the repository/API boundary as the default catalog while MongoDB is not explicitly selected.

Rationale: The frontend can integrate now without fake credentials or an undocumented external dependency. Public product normalization removes legacy seed-only reasons.

Status update, 2026-07-03: BFP-01 added strict models, repositories, a conflict-safe seed migration, and index verification. The seed remains the default; explicit `CATALOG_DATA_SOURCE=mongodb` selection uses Atlas without silent fallback.

## BDEC-003: Start With Deterministic Content Ranking

Date: 2026-07-02

Decision: Score artist, genre, decade, label, and availability with documented fixed weights.

Rationale: The logic is explainable and testable without interaction data. Collaborative methods would be unsupported.

## BDEC-004: Separate Demo Profile And Cold Start

Date: 2026-07-02

Decision: Only `demo-user` receives the synthetic profile; all other valid IDs receive clearly labeled cold-start results.

Rationale: This prevents false personalization claims.

## BDEC-005: Keep Write Features Deferred

Date: 2026-07-02

Decision: Do not expose interaction, wishlist, cart, order, or recommendation-log writes until identity and the corresponding write contracts are implemented.

Rationale: Persistence models alone do not provide authorization, idempotency, privacy controls, or complete write-side consistency.

Status update, 2026-07-06: BFP-04/BFP-03 satisfied the customer/event gate, and both BFP-02 logging and evidence-gated offline evaluation are implemented. Demo orders and administrator catalog writes remain deferred.

## BDEC-006: Distinguish Behavior Tests From Quality Metrics

Date: 2026-07-02

Decision: Test deterministic rules and metric sanity, but report no offline quality score until a leakage-safe dataset and baselines exist.

Rationale: A top-k metric without held-out relevance and fair baselines is not valid evaluation evidence.

## BDEC-007: Make Catalog Persistence Explicit

Date: 2026-07-03

Decision: Default `CATALOG_DATA_SOURCE` to `seed` and require explicit `mongodb` selection with valid Atlas configuration. Never silently fall back after MongoDB has been selected.

Rationale: The local academic demo remains deterministic and available without credentials, while database failures stay visible instead of producing ambiguous mixed-source responses.

## BDEC-008: Keep Search Literal And Repository-Equivalent

Date: 2026-07-03

Decision: Use case-insensitive literal substring search, controlled repeated facets, and stable public-ID tie-breakers in both catalog repositories.

Rationale: Literal behavior is predictable for the small catalog, prevents regex input from changing query meaning, and keeps seed and MongoDB results contract-equivalent.

## BDEC-009: Seed Migration Preserves Soft-Delete Tombstones

Date: 2026-07-03

Decision: The seed migration reconciles catalog content only. `deletedAt` is not a managed field and is never written in an update payload, so an operator's soft-deleted demo-seed record survives any seed re-run.

Rationale: A re-run that wrote `deletedAt: null` over a tombstone would silently resurrect records the operator intentionally hid, contradicting the documented "soft-deleted products must be excluded by default" rule with no log, conflict, or exit-code signal. Creates still seed `deletedAt: null`; updates leave tombstone state untouched.

## BDEC-010: Use Small Server-Enforced Sessions And Idempotent Customer Writes

Date: 2026-07-04

Decision: Use scrypt username/password authentication, signed eight-hour HttpOnly cookies, registered customer accounts plus environment-backed demo identities, and session-derived ownership for profile, wishlist, cart, rating, interaction, merge, and account-deletion routes.

Rationale: This supplies a real authorization boundary without introducing email recovery, third-party identity, or production payment scope. Exact-origin checks, bounded bodies, generic login failures, stable event IDs, merge receipts, and MongoDB transactions address the principal risks for the classroom write surface.

## BDEC-011: Simplified Auth To Two Roles With Env-Only Admin

Date: 2026-07-04

Decision: The authentication surface keeps only two roles (`customer`, `admin`). The administrator account is environment-only (`AUTH_DEMO_ADMIN_*`). The shared classroom demo customer is environment-only (`AUTH_DEMO_CUSTOMER_*`) with ephemeral preferences. Registered customers persist in MongoDB and require MongoDB mode. Login rate limiting, server-side session-version revocation, the seeded-profile upsert/merge path, and the administrator-promotion script were removed. A per-identity interaction-ingestion cap (`src/lib/interactionCap.js`) replaces login rate limiting as the write-amplification control.

Rationale: This is a classroom recommender-systems demo, not a production identity provider. Keeping scrypt hashing, signed HttpOnly sessions, exact-origin checks, server-derived ownership, bounded write validation, and guest-merge idempotency preserves the real authorization boundary. Removing the demo-account persistence shadowing (which silently reverted role changes) and the unused revocation machinery reduces the surface to what the course exercises.

Accepted trade-off: logout clears the cookie but does not invalidate a stolen token server-side; such a token is valid until its eight-hour TTL. This is documented as a classroom-demo limitation.

## BDEC-012: MongoDB Showcase Demo Customers And Session-Only Guest State

Date: 2026-07-04

Decision: Showcase demo customer accounts are real `users` documents seeded into MongoDB (`scripts/seed-demo-users.mjs` driven by `src/data/demoUsers.js`), not environment-backed. Three accounts (`jazzlistener`, `rockcollector`, `soulseeker`) start with empty preferences; their public classroom passwords are documented in the frontend README and stored only as scrypt hashes. The demo usernames are reserved in `register`. Guest wishlist/cart/ratings are session-only: they live in `sessionStorage`, clear when the tab closes, merge into a brand-new account on sign-up only, and are discarded when signing in to an existing account or ordinarily restoring a session. A persisted keyed registration failure is the only restore exception. A one-time cleanup removes any legacy `localStorage` guest data.

Rationale: The showcase needs several named demo accounts that a reviewer can sign into directly, and that the recommender can later personalize. MongoDB-seeded customers (rather than more env-backed accounts) keep distinct preference profiles a single forward step away while reusing the real `users` model and auth path. Session-only guest storage plus merge-on-register-only preserves the safety property that a visitor's guest cart is never copied onto an existing account (for example on a shared device), and gives every visitor a clean guest state instead of a stale cart.

Accepted trade-offs: demo customer logins require the backend to reach MongoDB (the env-backed accounts remain as a seed-catalog fallback); MongoDB demo customers have persistent rather than ephemeral preferences, so a tester's edits survive until `db:seed:users:apply` resets them; distinct per-account preference profiles are deferred until recommender algorithm selection is finalized (tracked in `docs/FUTURE_IMPLEMENTATION_PLAN.md`).

## BDEC-013: Log Exact Served Lists Before Analytics

Date: 2026-07-05

Decision: Generate request/list IDs on the server and, in MongoDB mode, persist the exact ordered recommendation output before returning it. Store scores, ranks, reasons, exclusions, mode, algorithm version, surface, safe subject, and 90-day expiry. Suppress persistence in seed mode or when the usage-data header opts out.

Rationale: Interaction events are meaningful only when they can join the list actually served. Server-generated IDs and session-derived ownership prevent client forgery, while opt-out and TTL preserve the selected privacy boundary.

## BDEC-014: Keep Catalog Import Preview-First And Source-Owned

Date: 2026-07-06

Decision: Accept bounded CSV/JSON through a no-write preview by default. Apply batches transactionally and atomically unless the operator explicitly selects partial mode. Treat source ownership, tombstones, ambiguous pressings, multiple matches, and supplied public-ID disagreement as conflicts. Status update, 2026-07-12: seed migration now manages the separately reviewed artwork manifest for seed-owned records; immutable slugs and tombstones remain protected.

Rationale: Catalog maintenance must not silently overwrite another source, resurrect deleted products, erase enrichment, or turn a mistaken identity match into a destructive update. A reviewed action list and stable counter allocation make retries understandable and safe.

## BDEC-015: Bind Artwork To Releases And Gate Offline Metrics

Date: 2026-07-06

Decision: Accept structured artwork only from approved hosts when its paths match a supplied or verified MusicBrainz release/release group, and generate retrieval/provenance metadata on the server. Build evaluation subjects under per-run pseudonyms and publish ranking metrics only with at least 20 eligible subjects and 5 final positive products per subject; otherwise publish aggregate completeness and an explicit non-conclusion.

Rationale: Host allowlists alone cannot prove that a cover belongs to the imported record, and sparse behavioral data cannot support a defensible recommendation-quality claim. These boundaries make both provenance and evaluation claims auditable.

## BDEC-016: Personalization Architecture Freeze

Date: 2026-07-07

Decision: Plan, without implementing, a personalization roadmap (PERS-00 through PERS-09) scheduled after BFP-07, FFP-07, and FFP-08. Freeze the architecture the later milestones depend on: a canonical session-owned endpoint `GET /api/recommendations/me`; a restricted (not removed) arbitrary-user route that keeps `demo-user` as the only profile trigger and never reads private data for other ids; durable account state for preferences, ratings, wishlist, cart, and explicit feedback versus 90-day TTL analytics for impressions, views, clicks, and searches; explicit functional actions persist and feed the profile regardless of tracking opt-out while passive analytics honor opt-out (this closes the current gap where opt-out suppresses only request logging); a recommendation profile recomputed on demand rather than stored; component scores normalized to `[0,1]` per request with weight renormalization when a component is unavailable; new algorithm versions `preference-profile-v1`, `behavior-profile-v1`, `popularity-v1`, and `personalized-hybrid-v1` alongside the preserved `content-demo-v1`; deterministic labelled showcase preference profiles; and account-deletion cleanup of all personalization state. Collaborative filtering and matrix factorization are excluded. BFP-05 remains its own on-hold placeholder; its open method decision is resolved by PERS-00 under new IDs and is not reused.

Rationale: Identity, data, and contract foundations must be fixed before any ranking milestone so later plans do not rediscover dependencies or produce contradictory contracts. The opt-out split preserves user control over passive tracking while keeping user-authored features functional. No quality claim is made or implied; the existing `insufficient-evidence` evaluator status and its evidence threshold are unchanged.

Status: Frozen and completed 2026-07-10. The user opened personalization after FFP-08 and approved the planned defaults by requesting PERS-00 through PERS-02: `/api/recommendations/me`, explicit functional actions surviving passive-tracking opt-out, customer-only personalization access with administrator rejection, limit 12, and auth-state gating/provider reorder. PERS-01/02 implement only the identity/session seam; ranking remains `content-demo-v1` and the evaluator remains `insufficient-evidence`.

## BDEC-017: Administrator Mode Is Role-Gated, Optimistic-Concurrent, And Mongodb-Only For Writes

Date: 2026-07-09

Decision: BFP-07 administrator catalog management reuses the existing session/role machinery (`requireRole("admin")` on every `/api/admin/*` route; the admin account is env-only with no promotion path). Product create allocates a numeric public id as `max(counter, max-existing)+1` so a re-seeded catalog that did not advance the counter cannot collide. Edit and soft-delete use compare-and-set on Mongoose-managed `updatedAt` (the schema keeps `versionKey:false`) and return `CONFLICT` on stale state. Soft-delete sets `deletedAt`; restore clears it. Catalog import reuses the transactional bulk-write behind a one-time, expiring, in-process preview token so apply cannot be replayed. Artwork refresh reuses the MusicBrainz/Cover Art matching rules and only writes verified, approved-host artwork. Administrator actions append best-effort audit records (admin public id is `select:false` and projected out). Reads work in seed and mongodb mode; writes are mongodb-only and return `PERSISTENCE_UNAVAILABLE` (503) in seed mode.

Rationale: Reusing the role/session/import machinery avoids a parallel admin system and keeps the security boundary server-owned. `updatedAt` compare-and-set gives optimistic concurrency without a schema migration. Best-effort audit prevents a flaky audit store from rolling back a successful catalog mutation. Seed-mode write blocking keeps the safe read-only default while letting the dashboard/list render in every environment.

Status: Implemented and verified (node --test 114/114, eslint clean, build green; live seed-mode smoke). The frontend `RequireRole` guard is navigation only and is not a security control.

## BDEC-018: Keep Exactly Three Showcase Customers And One Environment Administrator

Date: 2026-07-12

Decision: Remove the legacy environment-backed customer login. Keep exactly three MongoDB showcase customers (`jazzlistener`, `rockcollector`, and `soulseeker`) plus one environment-backed administrator. The showcase usernames remain reserved, and registration still creates only ordinary customers.

Rationale: One account source per role boundary removes a fourth customer path with ephemeral state, keeps the classroom identities inspectable, and preserves the administrator as an explicit environment-only security boundary.

## BDEC-019: Treat The Reviewed Artwork Manifest As Seed-Owned Catalog Data

Date: 2026-07-12

Decision: Generate `src/data/artworkManifest.js` only from a complete visual-review report. Prefer exact official album-vinyl MusicBrainz releases; permit the six documented manual-review bindings where MusicBrainz lacks the cataloged vinyl edition or uses a materially different title. Use exact-release Cover Art Archive images first and stable same-release-group hotlinks only when the exact release has no approved front image. The seed and Atlas migration both manage the reviewed external IDs, artwork, and provenance while preserving immutable slugs and soft-delete tombstones.

Rationale: A committed review boundary makes all 116 images reproducible in both catalog modes, prevents single/album and edition drift, keeps external storage low, and retains local fallbacks for network or coverage failures.

## BDEC-020: Commit A Verified Local Fallback For Every Reviewed Cover

Date: 2026-07-21

Decision: Keep the reviewed Cover Art Archive URL as the preferred display source through the backend proxy, but commit one validated 500-pixel JPEG for each of the exact 116 bundled public IDs. Derive downloads only from `src/data/artworkManifest.js`; require HTTPS, approved source and redirect hosts, bounded redirects/time/bytes/pixels, JPEG MIME and byte completeness, content-addressed filenames, full provenance, manifest-last publication, and an orphan-free exact-set verifier. Expose stable canonical IDs through `GET /api/artwork/local/:publicId`, which redirects to the immutable asset.

Rationale: The proxy fixed browser-to-Cover-Art-Archive reachability but still depended on a successful backend upstream request or a warm cache. A committed, hash-verified bundle makes the fixed classroom catalog deterministic offline while preserving reviewed source attribution and avoiding mutable public URLs. Content-addressed assets may be cached for one year; the stable ID redirect remains briefly revalidated so a future reviewed replacement does not strand clients on an obsolete filename.

Status: Implemented and independently reviewed `SHIP_AS_IS` on 2026-07-21. Verification covered 116 files / 7,562,124 bytes, every hash/dimension/endpoint/header, malformed and unknown IDs, remote-to-local browser failover, desktop/mobile rendering, 154 backend tests, 87 frontend tests, and clean Atlas E2E teardown.

## BDEC-021: Pin The External Research Source And Commit No Raw Data

Date: 2026-08-02

Decision: Bind Amazon Reviews 2023 `CDs_and_Vinyl` inputs to revision `2b6d039ed471f2ba5fd2acb718bf33b0a7e5598e`, exact byte counts, SHA-256 hashes, deterministic transformation configuration, and an aggregate quality summary. Keep raw files and staging ignored. Exclude review text, source reviewer IDs, profiles, and downloaded Amazon images. Record that the publisher grants no dataset license and make no permissive reuse claim.

Rationale: Reproducibility requires immutable input identity, while privacy and unclear redistribution rights require a strict local research-data boundary.

Status: Implemented in DATA-01 through DATA-03 and verified before import.

## BDEC-022: Activate Dataset Versions Without Deleting Legacy Data

Date: 2026-08-02

Decision: Store dataset-owned records additively, permit exactly one active `DatasetImport`, and make catalog reads filter by that pointer. When no dataset is active, use the preserved 116-record legacy catalog. Import completion and activation are separate; activation/rollback use a transaction and never delete either catalog version or customer state. Dataset-managed Admin rows are read-only and direct operators to rebuild/reactivate through the CLI.

Rationale: A reversible pointer gives the classroom deployment a fast recovery path, preserves stable legacy assets, and prevents one-off browser edits from breaking dataset reproducibility.

Status: Immutable `amazon-reviews-2023-cds-vinyl-5core-v2` is active with 2,305 products; v1 and 116 legacy products remain preserved.

## BDEC-023: Isolate Historical Evidence From Customer Identity And Live Signals

Date: 2026-08-02

Decision: Represent source reviewers only as keyed HMAC-SHA-256 values in `historicalAmazonRatings`, never as `User` records. Keep source-derived timestamps and explicit train/validation/test splits, no TTL, and aggregate-only readiness reporting. Nullable store fields remain unknown rather than simulated. Historical readiness does not modify `content-demo-v1`, the live evidence gate, or the exact three showcase customers.

Rationale: Historical research evidence has different provenance, retention, consent, and evaluation semantics from live Groovehaus activity. Isolation prevents identity conflation and leakage while leaving a separately approvable future evaluation path.

Status: Implemented in DATA-05 through DATA-13. PERS-03 through PERS-08 were subsequently implemented as separate default-off batches, and PERS-09 completed without changing this isolation boundary.

## BDEC-024: Seal V2 Rows And Enrich Artwork Conservatively

Date: 2026-08-02

Decision: Preserve v1 public IDs through a committed opaque identity registry, store v2 products in the separate `datasetProducts` collection, attach exact record digests, and seal a dataset key after exact-set verification. Never rewrite a sealed version. Search MusicBrainz at its published rate limit and accept artwork only for an official vinyl result with an exact normalized title, strong artist agreement, score at least 95, and one unique release group. Download every accepted Cover Art Archive 500-pixel JPEG into a separately verified content-addressed fallback set. Ambiguous, unresolved, and failed decisions never receive borrowed artwork.

Rationale: A separate immutable collection prevents same-key upserts from silently changing an active research dataset. The identity registry preserves deep links and saved state across versions. Conservative artwork acceptance and exact local coverage improve availability without treating Amazon images or uncertain MusicBrainz candidates as verified facts.

Status: Implemented and verified in the corrected v2 dataset closure. The storefront remains research-only; this decision does not authorize a recommender change.

## BDEC-025: Require A Rehearsed V2 Lifecycle Before Publication

Date: 2026-08-08

Decision: Treat the corrected v2 dataset as publishable only after normal enriched preparation is deterministic, the sealed inactive import is verified while v1 remains active, activation and exact repeated import are safe, rollback to v1 preserves v2 evidence/legacy IDs/customer state without deletion, reactivation restores v2, and post-E2E cleanup leaves protected collections unchanged. Keep historical readiness aggregate-only; the separately implemented PERS-03 through PERS-09 work does not alter this dataset.

Rationale: A final active pointer and green unit tests do not prove the transition path or customer-state boundary. The bounded rehearsal records the operational evidence required for the classroom database without introducing event sourcing, state migration, or recommendation work.

Status: Verified. V2 is active with 2,305 products, 20,288 ratings, 2,387 historical subjects, 208 accepted local artwork files, exactly three showcase customers, and all dataset/index/privacy checks passing. The live rollback snapshot preserved v2 evidence, legacy IDs, showcase state, and customer collections; cleanup ended with zero `e2e_` residue.

## BDEC-027: Recompute The Recommendation Profile On Demand

Date: 2026-08-10

Decision: Build the session-owned recommendation profile on demand from the verified customer's preferences, ratings, wishlist, cart, exact feedback, and at most 500 recent interactions. Keep the profile server-internal and do not add public source flags, completeness fields, raw interaction rows, or a profile cache. Durable functional state remains available regardless of passive tracking opt-out; passive interactions are read only when tracking is enabled, and feedback is read only when its effective feature gate is enabled.

Rationale: A single bounded orchestrator prevents each ranking component from reading different snapshots or leaking private source state. Recompute-on-demand keeps the first batch small and avoids a derived collection that would need invalidation and account-deletion handling.

Status: Implemented behind default-off `PERS_PROFILE_DOMAIN`; PERS-04 and PERS-05 remain independently fail-closed until their flags are enabled.

## BDEC-028: Durable Exact-Item Feedback Is Authoritative

Date: 2026-08-10

Decision: Store only `not-interested` and `already-own` as the current durable feedback intent per customer/product. A `PUT` is pessimistic, idempotent, and replaces the other allowed kind; `DELETE` is an idempotent undo. Enabled recommendation requests exclude only the exact product IDs present in the active feedback rows. No artist/genre propagation, show-fewer control, free-text reason, public feedback-list route, or analytics event is authoritative for suppression.

Rationale: Exact suppression is predictable and reversible for a classroom storefront, while broad similarity propagation would require a separate policy decision. Keeping feedback separate from the 90-day interaction collection preserves account ownership, durable intent, and deletion guarantees.

Status: Implemented behind default-off `PERS_PROFILE_DOMAIN && PERS_NEGATIVE_FEEDBACK`; account deletion removes feedback transactionally and disabled rows remain inert.

## BDEC-026: Hydrate Original-Release Year From Release-Group Detail (V3)

Date: 2026-08-08

Decision: The MusicBrainz release search endpoint omits release-group.first-release-date, so the v2 enrichment produced zero original-release years despite 208 strict matches. Add a release-group detail lookup that hydrates the authoritative first-release-date only after the strict unique release-group match is established. Because this changes staged immutable product content, create a new immutable v3 dataset rather than rewriting v2. V1, v2, and the 116-record legacy catalog remain stored rollback targets.

Rationale: The original-release year powers decade filtering and the content-based era feature. The search endpoint field is structurally absent, not merely sparse, so a release-group detail fetch is the minimal reliable correction. Creating v3 preserves the published v2 evidence and follows the immutable-version rule.

Status: Implemented and verified. V3 is active with 2,305 products, 20,288 ratings, 2,387 historical subjects, 208 original-release years (versus zero in v2), 208 accepted local artwork files, exactly three showcase customers, and all dataset/index/privacy checks passing. Rollback to v2 and reactivation were rehearsed successfully.

## BDEC-029: Bound Behavioral Affinity To Current Account State And Opt-In Passive Evidence

Date: 2026-08-10

Decision: Implement `behavior-profile-v1` as a pure artist/primary-genre/format affinity scorer over current ratings, wishlist, cart, feedback, and optional recent click/view/search-result-click events. Durable state does not decay; passive evidence uses UTC-day deduplication, 0-7/8-30/31-90-day bands, per-product/per-attribute caps, and positive reasons only. Exact feedback remains an item exclusion before scoring. An exact `X-Tracking-Enabled: false` interaction batch is accepted with zero writes after origin validation; direct account actions remain independent.

Rationale: This keeps stronger account-authored signals separate from weaker opt-in analytics, makes removals absence rather than negative taste, and closes the server-side privacy backstop without requiring a new data collection or profile cache.

Status: Implemented behind default-off `PERS_BEHAVIORAL_RANKING`; no quality claim or historical-user join was added.

## BDEC-030: Scope Production Popularity To The Loaded Candidate Dataset

Date: 2026-08-10

Decision: Implement `popularity-v1` with one historical aggregate read keyed by the uniform `datasetKey` already present on the loaded recommendation candidates. Return only public product aggregates (`ratingCount`, `meanRating`), order count/mean/id/title, and keep the offline evaluator's popularity baseline training-only. Null/seed/zero-evidence sets remain deterministic fallback.

Rationale: Candidate-owned dataset scoping prevents activation races and v2/v3 mixing while preserving the immutable research-data boundary and avoiding a cache/index/schema migration.

Status: Implemented behind default-off `PERS_POPULARITY`; historical identities never reach the service or public response.

## BDEC-031: Use A Versioned True Hybrid And Keep Lower Modes Pure

Date: 2026-08-10

Decision: Implement `personalized-hybrid-v1` with fixed classroom assumptions preference `0.45`, behavior `0.35`, and popularity `0.20`. Form a true hybrid only when preference and behavior are available; popularity joins when available and weights renormalize once per request. Preference-only, behavior-only, and popularity-only responses retain their pure component versions. Apply exact exclusions once, use complete pre-diversity maps, derive at most two contribution reasons, and keep product similarity separate.

Rationale: A single candidate/exclusion pass prevents score drift and double-counting while truthful mode/version labels make rollback and frontend attribution auditable. The weights are assumptions, not learned quality parameters.

Status: Implemented behind default-off `PERS_HYBRID`; PERS-09 integration closure is complete, while production enablement remains deferred.

## BDEC-032: Close Recommendation Reads, Scoring, Logging, And Deletion As One Auditable Boundary

Date: 2026-08-13

Decision: Keep routes thin and the recommender pure: the recommendation service selects repositories, loads one candidate set and one profile, applies exact feedback exclusions once, and requests candidate-scoped popularity only when it can affect the selected mode. Require an explicit `CATALOG_DATA_SOURCE=mongodb`; otherwise use the seed source. For authenticated delivery, persist the exact ordered public result only after revalidating and write-fencing the active customer in the same transaction as log creation. Reuse the shared tracking opt-out parser at every recommendation route.

Rationale: Explicit persistence selection prevents configured credentials from silently changing runtime mode. A service-owned I/O boundary keeps scoring deterministic and independently testable. Transactional active-customer fencing orders recommendation logging against account deletion, preventing an in-flight request from recreating subject-linked analytics after deletion commits.

Status: Implemented and verified in PERS-09 with default-off ranking flags, deterministic service/repository/failure/lifecycle regressions, full route and browser contracts, live MongoDB checks, and no dataset or quality-evaluation change.
