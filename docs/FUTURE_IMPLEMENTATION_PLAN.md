# Backend Future Implementation Plan

Status: BFP-01/03/04/06/07/08/09, both parts of BFP-02, and the backend contracts for FFP-01/02/03/05/06/07/08/09 are complete. BFP-05 remains a historical on-hold placeholder whose open method decision was frozen by PERS-00; personalization from BFP-10 onward remains future work pending a separate explicit task.

Audience: the developers implementing the Next.js backend and the frontend developers consuming its contracts.

Source of truth: current backend source, `PROJECT_CONTEXT.md`, `API_CONTRACT_PLAN.md`, `DATA_MODEL_PLAN.md`, and the matching frontend future plan. Recheck package versions and external service terms when implementation begins.

## User Decisions Recorded On 2026-07-03

- Use a small custom authentication system with server-issued sessions.
- Add customer registration only after durable user persistence exists. This gate is complete and registration now uses the MongoDB user repository.
- Preserve the existing numeric product IDs in public APIs; MongoDB `_id` remains internal.
- Keep guest state session-only. Merge it only into a brand-new registration; existing-account login and ordinary restore discard it, while a keyed failed registration merge resumes after refresh.
- Collect anonymous interaction data by default with a visible opt-out, no direct personal information, and a 90-day retention target.
- Protect an integrated `/admin` mode with the backend `admin` role.
- Use MusicBrainz and Cover Art Archive as the primary metadata and artwork sources, with a verified bundled fallback for the reviewed catalog and placeholders for unresolved records.
- Do not add deployment work, a machine-readable API schema, or a real payment system.

## Plan Status Summary

| ID | Plan | Status | Main Gate |
| --- | --- | --- | --- |
| BFP-01 | MongoDB persistence, schemas, indexes, and seed migration | Completed 2026-07-03 | Seed remains the default; explicit MongoDB mode, models, repositories, migration, parity checks, and live indexes are verified. |
| BFP-02 | Recommendation logging and offline evaluation dataset | Completed 2026-07-06 | The pipeline is active and evidence-gated; the current report is `insufficient-evidence`. |
| BFP-03 | Write API contracts and implementation | Completed 2026-07-04 | Customer/event routes are implemented; administrator writes landed in BFP-07, while backend order APIs remain deferred. |
| BFP-04 | Simple authentication, registration, and authorization | Completed 2026-07-04 | Registered and seeded identities use signed server sessions and role checks. |
| BFP-05 | Recommender algorithm selection | On hold (superseded decision) | PERS-00 / BDEC-016 resolved the method direction under new IDs; this historical placeholder is not reused. |
| BFP-06 | Catalog ingestion and metadata quality | Completed; hardened 2026-07-21 | Preview/apply, source/conflict rules, enrichment, caching, provenance, reviewed mappings, redirect-safe proxying, and 116 verified local fallback JPEGs are complete. |
| BFP-07 | Admin mode backend | Completed 2026-07-09 | Administrator API is implemented: role-gated summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, preview-token import apply, artwork refresh, and best-effort audit logging. Catalog writes are mongodb-only (503 in seed mode). |

## Approved Cross-Repository Implementation Order

The first nine milestones are complete. Implement the remaining plans in this order so each later surface builds on verified contracts and regression coverage:

| Order | Plan | Dependency-safe outcome |
| --- | --- | --- |
| 1 | FFP-04: browser, integration, and accessibility testing | Completed 2026-07-03; regression coverage now protects the integrated contract. |
| 2 | BFP-01: MongoDB persistence | Completed 2026-07-03; seed remains the default and explicit MongoDB mode is verified. |
| 3 | FFP-05: server-side search and pagination | Completed 2026-07-03; repository-backed literal search, facets, sorting, and pagination are active. |
| 4 | BFP-04: simple authentication and authorization | Completed 2026-07-04; signed sessions, registration, seeded identities, role checks, and account cleanup are active. |
| 5 | BFP-03: write APIs | Completed 2026-07-04; protected preferences/state plus idempotent interaction and guest-merge contracts are active. |
| 6 | FFP-03: local-to-server state migration | Completed 2026-07-05 with session guests and sign-up-only keyed merge. |
| 7 | FFP-02: onboarding and preferences | Completed 2026-07-05. |
| 8 | BFP-02 Part A: recommendation-request logging | Completed 2026-07-05 with exact served-list persistence. |
| 9 | FFP-01: recommendation interaction analytics | Completed 2026-07-05 with privacy-controlled attributed events. |
| 10 | BFP-06: catalog ingestion and metadata quality | Completed 2026-07-06 with validated preview/apply imports and approved metadata enrichment. |
| 11 | FFP-06: artwork and image handling | Completed 2026-07-06; hardened 2026-07-21 with proxy-to-local-to-placeholder failover and an exact 116-file local bundle. |
| 12 | BFP-02 Part B: offline evaluation dataset and benchmark | Completed 2026-07-06; the pipeline correctly reports insufficient evidence without metrics. |
| 13 | BFP-07, then FFP-07: integrated admin mode | Implement protected backend administration before exposing its frontend workspace. |
| 14 | FFP-08: simulated checkout and order demonstration | Add the low-risk classroom flow last, after catalog, state, identity, and testing are stable. |

BFP-05 remains on hold and is excluded from this order until the user selects a recommender approach. Deployment, real payments, and a production order system remain out of scope.

### Completed FFP-05 Backend Read Contract

`/api/products` and `/api/search` now share one repository-backed query path. It supports bounded literal text search, repeated genre/condition/era facets, artist and label substrings, price and stock filters, four controlled sorts, deterministic public-ID tie-breakers, bounded pagination, and full active-catalog facet metadata. Seed and MongoDB adapters preserve the same public envelope and exclude soft-deleted records.

## BFP-01: MongoDB Persistence, Schemas, Indexes, And Migration

This plan defines the optional persistence layer while keeping seed mode working when Atlas is unavailable or MongoDB mode is not selected.

Status: completed and verified on 2026-07-03.

### Goal

Add durable data without breaking the current read-only demo. The approved seed remains the default, and MongoDB catalog reads activate only when `CATALOG_DATA_SOURCE=mongodb` is explicitly selected.

### Atlas Boundary

Completion update on 2026-07-03: Atlas authentication and network access, the ignored local environment, application models and collections, catalog migration, repository parity, and declared indexes were verified. The migrated seed remains idempotent on repeated dry-runs.

Before any future migration write or data-source switch, all of these must remain true:

- The Atlas project, cluster, database user, and network access rule remain valid.
- `MONGODB_URI` and `MONGODB_DB_NAME` remain in uncommitted `.env.local`.
- `npm run db:ping` succeeds without printing the URI or credentials.
- The seed migration passes in dry-run mode before any write is allowed.

The application must default to `CATALOG_DATA_SOURCE=seed`. Missing Atlas configuration must never stop the existing seed-backed catalog from running. `CATALOG_DATA_SOURCE=mongodb` must fail fast with a safe configuration error when required variables are absent.

### Data Model

| Collection | Purpose | Important fields and constraints |
| --- | --- | --- |
| `users` | Customer and administrator identity | `publicId`, normalized unique `username`, optional `displayName`, password hash and salt, `role`, embedded preferences, `active`, timestamps. No email is required. |
| `vinylRecords` | Durable catalog | Internal `_id`, unique numeric `publicId`, unique stable `slug`, catalog metadata, price, currency, stock, `musicBrainzReleaseId`, artwork metadata, source/provenance, `deletedAt`, timestamps. |
| `interactions` | Immutable user or anonymous events | Unique `eventId`, optional `userPublicId`, optional `anonymousId`, `sessionId`, type, product public ID, recommendation context, event time, received time, schema version. |
| `wishlists` | One wishlist per user | Unique `userPublicId`, embedded unique product public IDs, timestamps. |
| `carts` | One current cart per user | Unique `userPublicId`, item array containing product public ID and quantity, timestamps. |
| `ratings` | Current editable rating per user and product | Unique compound key on user and product, integer rating 1 through 5, timestamps. Rating changes also create interaction events. |
| `orders` | Optional demo order records | `publicId`, user, item snapshots, totals, `demo: true`, status, timestamps. No payment credentials or real transaction identifiers. |
| `recommendationLogs` | Reconstruct each served list | Unique `requestId`, subject, mode, algorithm version, candidate context, ordered product IDs and scores, surface, served time. |
| `auditLogs` | Administrator change history | Admin user, action, entity type/public ID, safe before/after summary, request ID, timestamp. Never store passwords or session values. |
| `counters` | Atomic numeric ID allocation | Unique counter name and current value for new product and demo-order public IDs. |

### Required Indexes

- Unique indexes: `users.publicId`, `users.normalizedUsername`, `vinylRecords.publicId`, `vinylRecords.slug`, `interactions.eventId`, `recommendationLogs.requestId`, and `orders.publicId`.
- Query indexes: catalog genre/artist/year/stock, user plus event time, product plus event time, algorithm version plus served time, and audit entity plus timestamp.
- Text search uses escaped, case-insensitive literal substring matching for the current catalog. A text index remains a future optimization only if measured catalog growth justifies a contract change.
- TTL indexes should remove `interactions` and `recommendationLogs` after 90 days. The plans and UI must describe TTL deletion as eventual rather than immediate.
- Soft-deleted products must be excluded by default from catalog, search, recommendations, cart additions, and new orders.

### Public ID Rule

Public contracts continue using numeric `product.id`. Repository code translates numeric public IDs to MongoDB documents. No route, URL, cart item, wishlist item, recommendation item, or frontend key exposes MongoDB ObjectIds.

### Implemented Files

- `src/lib/db/mongodb.js`: existing cached Mongoose connection, configuration validation, and safe connection errors.
- `src/lib/db/dataSource.js`: selects seed or MongoDB repositories.
- `src/models/*.js`: one model per collection, using existing model reuse for development reloads.
- `src/repositories/seedCatalogRepository.js` and `mongoCatalogRepository.js`: identical catalog interface.
- `src/repositories/*Repository.js`: persistence access for users, lists, ratings, events, orders, logs, and audit records.
- `scripts/seed-mongodb.mjs`: dry-run and confirmed idempotent seed migration.
- `scripts/verify-indexes.mjs`: compare required indexes with the connected database.
- `tests/db-*.test.mjs`: model, repository, migration, fallback, and failure-path tests.

### Completed Implementation Phases

1. Preserved the Mongoose dependency, environment validation, cached connection helper, and safe `db:ping` verification.
2. Defined repository interfaces while keeping the seed adapter as the default.
3. Added strict schemas, timestamps, validation, and declared indexes.
4. Implemented MongoDB repositories behind explicit `CATALOG_DATA_SOURCE` selection.
5. Added an idempotent numeric-public-ID migration whose dry-run reports creates, updates, unchanged records, and conflicts.
6. Exercised seed and MongoDB adapters through repository contract and parity checks.
7. Verified live MongoDB mode, then reverified seed mode and failure behavior.

### Failure And Recovery Rules

- Never silently fall back from an explicitly selected MongoDB source to seed data; return a safe unavailable state so database failures are visible.
- Default seed mode remains available when Atlas has never been configured.
- Migration must not delete records. Conflicts produce a report and require explicit resolution.
- Before a destructive migration, export the affected demo collections and record the restore command. Atlas-managed backup features may be added later if the selected Atlas tier supports them.
- Account deletion removes user state and identifiers from demo collections. Demo orders may also be deleted because this project has no legal accounting requirement.

### Validation And Definition Of Done

All BFP-01 checks below passed on 2026-07-03:

- Existing seed-backed tests, lint, and build still pass with no Atlas variables.
- Missing MongoDB variables fail safely only when MongoDB mode is selected.
- The migration is idempotent and preserves all current public product IDs.
- MongoDB and seed repositories return the same public product envelope for the approved seed.
- Required unique, compound, and TTL indexes are verified against the live Atlas database.
- No connection string, password, hash, private interaction row, or `.env.local` enters Git.

## BFP-02: Recommendation Logging And Offline Evaluation Dataset

This plan defines the evidence pipeline required before the project reports recommendation quality.

Status: Part A recommendation-request logging completed on 2026-07-05. Part B dataset construction, baselines, evidence gating, and aggregate reporting completed and verified on 2026-07-06. The current data remains below the quality-reporting threshold.

### Part A Completion

- Recommendation routes generate server request/list IDs and return `recommendationLogged`.
- MongoDB mode persists exact ordered products, scores, ranks, reasons, exclusions, mode, algorithm version, surface, safe subject, and 90-day expiry before returning the response.
- Seed mode and usage-data opt-out suppress persistence.
- Authenticated ownership comes from the verified session; stored subjects are not returned publicly.
- Frontend events require complete request/list/version/mode/rank attribution, and user lists are requested only on pages that render them.

### Goal

Create a leakage-safe dataset and repeatable evaluation command without choosing the future recommender algorithm. The current content-based method is evaluated only after sufficient real or controlled interaction evidence exists.

### Event And Log Inputs

- `interactions` stores impressions, clicks, product views, wishlist actions, cart actions, ratings, dismissals, searches, and demo checkout completion.
- `recommendationLogs` stores what was served: request ID, mode, algorithm version, ordered products, ranks, scores, reasons, surface, and timestamp.
- Frontend events reference the recommendation request ID when available. The backend attaches an authenticated user ID from the session rather than trusting a client-supplied user ID.
- Anonymous events use a pseudonymous browser ID. No name, email, address, raw cookie, IP address, or free-form text is part of the evaluation dataset.
- Both collections follow the selected 90-day retention policy.

### Relevance Definition

Use two clearly separated analyses:

1. Explicit relevance: a rating of 4 or 5 is relevant; a rating of 1 or 2 is negative; a rating of 3 is neutral.
2. Implicit relevance: wishlist add and cart add are positive signals. Recommendation click and product detail view are engagement signals but are not sufficient alone for the primary relevance label. Dismiss or not-interested is negative.

Demo checkout completion can be reported as a funnel event, but it must not be described as a real purchase.

### Minimum Evidence Boundary

- Do not publish ranking-quality claims with fewer than 20 eligible users or browser profiles and fewer than 5 positive events per eligible subject.
- Below that boundary, report only event counts, coverage of captured fields, and a statement that the dataset is insufficient for quality conclusions.
- Record the exact number of eligible users, interactions, products, and evaluation dates in every report.

### Evaluation Protocol

- Prefer a temporal split: train on each subject's earlier events and test on later positive events.
- Use leave-one-out per subject only when the dataset is too small for a useful temporal window.
- Never random-shuffle interaction rows across time.
- Exclude training positives from each subject's recommendation candidates.
- Rank the full demo catalog when practical. If negatives are sampled, store the seed and sampling method.
- Compare random, popularity, and the current content-based implementation under the same split, candidates, and `k`.
- Report NDCG@10, MAP@10, HitRate@10, catalog coverage, and novelty. Precision@10, Recall@10, MRR, diversity, and personalization may be added when their inputs are valid.
- The ideal-order NDCG sanity case must equal 1.0.

### Implemented Files And Outputs

- `src/lib/recommender/evaluate.js` contains pure ranking and beyond-accuracy metric helpers with bounded inputs.
- `src/lib/recommender/evaluationDataset.js` constructs final-state relevance, evidence counts, temporal splits, and leakage checks.
- `src/repositories/evaluationRepository.js` selects the bounded window and pseudonymizes subjects immediately with a per-run HMAC salt.
- `scripts/evaluate-recommender.mjs` is the only report-generating command and writes aggregate JSON/Markdown under `reports/recommender/<date>-<algorithm-version>/`.
- `tests/evaluation-dataset.test.mjs` and `tests/offline-evaluation.test.mjs` cover relevance, splitting, privacy, determinism, baselines, metrics, and refusal below the evidence boundary.
- Generated reports contain no username, anonymous browser ID, session ID, raw subject ID, or raw interaction row.

### Implementation Phases

1. Completed: finalized versioned event and recommendation-log schemas with frontend analytics.
2. Completed: persisted events/request logs idempotently and verified 90-day TTL indexes.
3. Part B: add a dataset-read layer that returns pseudonymized subjects and ordered events.
4. Implement relevance construction, eligibility filtering, temporal splitting, and leakage assertions.
5. Implement random and popularity baselines without changing the active recommender.
6. Generate the first report only after the minimum evidence boundary is satisfied.
7. Review results before the held recommender-algorithm decision is reopened.

### Validation And Definition Of Done

- Duplicate event IDs do not create duplicate rows.
- Held-out positives are absent from training data and candidate exclusions are verified.
- All compared methods use the same users, split, candidates, and value of `k`.
- Reports contain NDCG@10, MAP@10, HitRate@10, coverage, novelty, evaluated-user count, dataset window, and algorithm versions.
- Insufficient data produces an explicit non-conclusion rather than invented or unstable quality claims.

## BFP-03: Write API Contracts And Implementation

This plan defines the mutation boundary shared by customer state, interaction capture, and optional demo orders.

Status: completed and verified on 2026-07-04 for the required customer/event surface. Optional demo orders remain part of FFP-08, and administrator writes remain part of BFP-07.

### Goal

Add a small, consistent write surface for preferences, interactions, wishlist, cart, ratings, demo orders, and administrator catalog changes while preserving the existing response envelopes.

### Contract Rules

- Success remains `{ "data": ..., "meta"?: ... }`; failure remains `{ "error": { "code", "message" } }`.
- Route handlers validate and authorize, then call services. They do not contain persistence logic.
- Authenticated ownership comes from the verified session, never a request-body user ID.
- All mutating requests require the exact configured frontend origin and credentialed CORS.
- JSON body size and batch length are bounded.
- Resource creation and batched event ingestion accept an idempotency key or stable client event ID.

### Implemented Customer And Event Routes

| Method | Route | Authentication | Purpose |
| --- | --- | --- | --- |
| `GET` | `/api/me` | Required | Return safe profile, role, onboarding status, and preferences. |
| `DELETE` | `/api/me` | Required | Delete a registered customer and owned demo state, then clear the session. |
| `PATCH` | `/api/me/preferences` | Required | Validate and replace supported preference fields. |
| `POST` | `/api/interactions` | Optional | Accept a bounded batch of versioned anonymous or authenticated events. |
| `GET` | `/api/wishlist` | Required | Return the current user's product IDs and product summaries. |
| `PUT` | `/api/wishlist/:productId` | Required | Idempotently add a product. |
| `DELETE` | `/api/wishlist/:productId` | Required | Idempotently remove a product. |
| `GET` | `/api/cart` | Required | Return items, quantities, availability warnings, and calculated totals. |
| `PUT` | `/api/cart/:productId` | Required | Set an absolute validated quantity from 1 through 99. |
| `DELETE` | `/api/cart/:productId` | Required | Remove an item. |
| `POST` | `/api/me/merge-guest-state` | Required | Atomically and idempotently merge guest wishlist, cart, and ratings after login. |
| `GET` | `/api/ratings` | Required | Return the current user's ratings and update timestamps. |
| `PUT` | `/api/ratings/:productId` | Required | Create or replace a rating from 1 through 5. |
| `DELETE` | `/api/ratings/:productId` | Required | Remove the current rating while retaining a safe historical event. |
| `POST` | `/api/orders` | Required, optional phase | Create a clearly marked demo order with no payment. |
| `GET` | `/api/orders` | Required, optional phase | List the current user's demo orders only. |

Authentication routes are specified in BFP-04 and administrator routes in BFP-07.

### Merge Semantics

- Wishlist: set union of server and guest product IDs.
- Cart: add quantities for matching products, cap each item at 99, reject missing or soft-deleted products, and return warnings for out-of-stock products.
- Ratings: the newest timestamp wins when the client has a valid timestamp; otherwise preserve the server rating.
- The request includes a stable `mergeId`. Repeating the same merge returns the original result without applying quantities twice.
- The frontend does not erase guest state until the merge response succeeds.

### Error Codes

Use stable codes including `INVALID_INPUT`, `UNAUTHENTICATED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `RATE_LIMITED`, `PERSISTENCE_UNAVAILABLE`, and `INTERNAL_ERROR`. Error messages remain safe and must not expose database or validation internals.

### Completed Implementation Phases

1. Added reusable bounded JSON, exact-origin, session, ownership, and idempotency helpers.
2. Implemented optional-session interaction ingestion with unique event IDs and server-derived authenticated ownership.
3. Implemented preferences, wishlist, cart, merge, rating, profile, and account-deletion services behind authentication.
4. Added MongoDB transactions for cart consistency, rating history, guest merge, and account cleanup.
5. Updated CORS to explicit methods, headers, credentials, and origin without using `*`.
6. Deferred optional demo-order routes until FFP-08 and administrator product routes until BFP-07.
7. Updated both contract documents and added unit/integration/browser coverage.

### Validation And Definition Of Done

All required BFP-03 checks below passed on 2026-07-04:

- Every route has success, invalid-input, unauthenticated, forbidden, not-found, idempotency, and persistence-failure tests where applicable.
- A user cannot read or mutate another user's state by changing request values.
- Automatic merge cannot double cart quantities on retry.
- Anonymous interaction ingestion rejects PII fields and oversized batches.
- Existing GET routes retain their current contracts and tests.
- Frontend and backend contract documents match before implementation is called complete.

## BFP-04: Simple Authentication, Registration, And Authorization

This plan defines the deliberately small identity boundary selected for the classroom project.

Status: completed and verified on 2026-07-04.

### Goal

Provide real backend-enforced customer and administrator sessions without building a production identity platform.

### Deliberate Scope

Included:

- Username and password login.
- One environment-configured customer and one administrator for the initial demo session path.
- Signed, HttpOnly, time-limited session cookie.
- Customer registration after the user repository is available.
- `customer` and `admin` roles.
- Login, logout, session restoration, route authorization, and per-identity interaction-ingestion bounding.

Excluded:

- Email verification, password recovery, social login, MFA, account linking, organization support, and production deployment hardening.
- Any client-controlled role selection.
- Any public route that can create or promote an administrator.

### Environment-Backed Administrator

- BDEC-018 supersedes the earlier environment-customer design. Configure only the administrator username and scrypt password hash through uncommitted `AUTH_DEMO_ADMIN_*` values; never commit administrator credentials.
- The administrator uses the stable `demo-admin` public ID and fixed `admin` role. No environment-backed customer or promotion path remains.
- Administrator login is disabled with a safe configuration message if its account variables or `AUTH_SECRET` are missing. The backend never returns password material.

### MongoDB Showcase Demo Customers

- Three showcase demo customer accounts (`jazzlistener`, `rockcollector`, `soulseeker`) are seeded into MongoDB as real `users` documents by `scripts/seed-demo-users.mjs` (`npm run db:seed:users[:apply]`), driven by `src/data/demoUsers.js`. Their public classroom passwords are documented in the frontend README; only scrypt hashes are stored.
- The seed is idempotent: it classifies each account as create/update/skip by `publicId`, never overwrites a username held by a different account, and applies transactionally. The demo usernames are reserved in `register`, so visitors cannot claim them, and account deletion rejects all three immutable showcase public IDs before repository access.
- These accounts carry EMPTY preferences for now. Distinct per-account preference profiles (for example a jazz listener, a rock collector, and a soul seeker) are DEFERRED until recommender algorithm selection is finalized. At that point they will be added to `src/data/demoUsers.js`, re-seeded, and the offline recommender evaluation re-baselined against them. Tracking this here is the agreed placeholder; do not implement it until the recommender decision is made.
- These MongoDB customers have PERSISTENT preferences (they are real customer documents), so a tester's preference edits survive until the next `db:seed:users:apply` resets them to the canonical profile.

### Registration After User Persistence

- `POST /api/auth/register` accepts normalized username, password, and optional display name.
- Registration creates only `customer` accounts. The administrator role is environment-only (`AUTH_DEMO_ADMIN_*`); there is no creation or promotion path.
- Use scrypt with a unique random salt through Node's cryptographic APIs. Store the parameters needed for future verification and upgrade.
- No email is collected, reducing personal-data scope. Username uniqueness is case-insensitive.
- Registration is available in explicit MongoDB mode and fails safely when persistence is unavailable.

### Session Design

- `POST /api/auth/login`: verify credentials with a timing-safe comparison and issue the cookie.
- `POST /api/auth/logout`: expire the cookie.
- `GET /api/auth/session`: return `{ authenticated, user? }` with only public ID, username, display name, role, and onboarding status.
- The signed payload contains only public user ID, role, and issue/expiry times. It contains no password information, preferences, or session version.
- Cookie defaults: `HttpOnly`, `SameSite=Lax`, `Path=/`, eight-hour maximum age, and `Secure` when HTTPS is used.
- The frontend uses `credentials: "include"`. CORS allows credentials only for `FRONTEND_ORIGIN`.
- Mutating routes validate the request origin. Login uses a single generic failure message and runs a dummy hash for unknown usernames so response timing cannot enumerate accounts; no submitted password is logged.
- Protected writes resolve the session subject from the signed token on every request, so disabled accounts (`active=false`) and role mismatches take effect without a server-side revocation list. Logout clears the cookie; stolen tokens live out their TTL (accepted classroom-demo trade-off).

### Implemented Files

- `src/lib/auth/config.js`, `password.js`, `session.js`, `cookie.js`, and `requireSession.js`; `src/lib/interactionCap.js`; plus `src/lib/request.js`.
- `src/services/auth.js`, `userState.js`, and `account.js`.
- `src/validation/auth.js`.
- `src/app/api/auth/login/route.js`, `logout/route.js`, `session/route.js`, and `register/route.js`.
- `src/lib/auth/requireSession.js` exports optional/required session and role guards for route handlers.
- `scripts/create-password-hash.mjs`; scripts must never print secrets unnecessarily.
- `tests/auth.test.mjs` plus frontend provider/browser coverage for cookies, expiry, tampering, roles, registration, restoration races, and the interaction cap.

### Completed Implementation Phases

1. Added environment parsing and a hidden-input password-hash generation script.
2. Implemented seeded/registered login, signed cookies, session restoration, and logout.
3. Added exact-origin credentialed CORS and protected real customer-state routes.
4. Added customer/admin authorization helpers with server-side role/session-version checks.
5. Added customer-only registration through the MongoDB user repository.
6. Added registered-customer deletion; seeded and administrator deletion are blocked and password reset remains excluded.
7. Connected the frontend auth provider, registration/login/account pages, protected route, and navigation.

### Validation And Definition Of Done

All required BFP-04 checks below passed on 2026-07-04; the role helper is verified directly because BFP-07 administrator routes remain deferred:

- Correct seeded credentials create a session; incorrect credentials return the same generic failure.
- Tampered, expired, or missing cookies are rejected.
- Customers receive `403 FORBIDDEN` from administrator routes even if the frontend URL is entered directly.
- Registration cannot assign `admin`, duplicate usernames fail safely, and registration is unavailable before the user repository is active.
- Logout invalidates the browser session and user-specific frontend state is cleared.
- Passwords, password hashes, cookies, and auth secrets never appear in responses or logs.

## BFP-05: Recommender Algorithm Selection

Status: on hold by user decision.

The current deterministic `content-demo-v1` implementation remains active. Do not implement collaborative filtering, matrix factorization, hybrid ranking, learned weights, or an algorithm replacement until the user selects the method.

Work allowed while this plan is held:

- Capture versioned interactions and recommendation logs.
- Build the leakage-safe dataset and baseline evaluation pipeline.
- Store explicit user preferences without claiming the current algorithm uses them.
- Preserve the current content-based behavior and honest `demo-profile`, `content-similarity`, `cold-start`, and `anonymous-fallback` labels.

Decision package required to reopen the plan:

- Available user, item, and interaction counts and sparsity.
- Baseline results under one shared split.
- Candidate methods with implementation cost, explainability, cold-start behavior, and expected data requirements.
- User approval of the selected method and explanation strategy.

## BFP-06: Catalog Ingestion And Metadata Quality

This plan defines how catalog data enters the system and how source quality remains reviewable.

Status: completed and verified on 2026-07-06.

### Goal

Replace manual source edits with a controlled import pipeline while keeping store-specific data authoritative and respecting source licensing.

### Source Strategy

- CSV or JSON is the authoritative input for store fields: numeric public ID, price, currency, stock, condition, format, pressing, and description.
- MusicBrainz may enrich artist, title, label, year, genre candidates, and release identifiers. It must not overwrite store price, condition, or stock.
- Cover Art Archive provides approved artwork URLs through the artwork plan.
- Do not scrape websites. Do not use general image-search results.
- Record provenance and retrieval time for every externally enriched field.

### Import Format And Validation

Required fields: title, artist, price, stock, condition, format, and source. Public ID may be omitted only for new administrator-created records, where the atomic counter assigns it.

Validation includes:

- Normalized whitespace and case-insensitive comparison keys.
- Year range, non-negative price, supported currency, valid stock/condition/format enums, and bounded text lengths.
- Genre normalization through a controlled alias map without inventing genres silently.
- Duplicate checks by MusicBrainz release ID when available, otherwise normalized artist/title/year/format plus pressing review.
- URL allowlists for external artwork hosts.
- A row-level error report; one bad row does not partially import an otherwise atomic batch unless partial mode is explicitly selected.

### MusicBrainz And Cover Art Rules

- Backend enrichment uses a meaningful User-Agent and respects MusicBrainz's one-request-per-second limit.
- Cache lookup results locally so rerunning a preview does not repeatedly query the service.
- Require an explicit release or release-group match before accepting artwork. Ambiguous matches remain unresolved for administrator review.
- Store external URLs and source metadata, not image binaries in MongoDB. The fixed reviewed fallback bundle is committed under `public/artwork/`, outside MongoDB, and keyed by a generated provenance/hash manifest.
- Prefer the bounded remote proxy, then the canonical-ID local endpoint, then the placeholder. Imported or administrator-created records without a reviewed local file still use the placeholder after remote failure.
- The official API behavior and rate-limit guidance were reviewed during implementation; recheck them before future client changes.

### Implemented Files

- `src/lib/catalog/normalize.js`, `validateImport.js`, and `deduplicate.js`.
- `src/lib/external/musicBrainzClient.js` and `coverArtArchiveClient.js`.
- `src/services/catalogImport.js`.
- `scripts/import-catalog.mjs` supporting `--dry-run`, `--input`, and explicit `--apply`.
- `tests/catalog-import.test.mjs` with malformed, duplicate, ambiguous, atomic-rollback, and external-service-unavailable cases.

### Implementation Phases

1. Publish the CSV/JSON template and controlled value lists.
2. Implement pure normalization and validation with fixture tests.
3. Implement duplicate detection and a non-mutating preview report.
4. Add rate-limited MusicBrainz matching and Cover Art Archive lookup behind explicit enrichment flags.
5. Add transactional or compensating-write apply behavior for MongoDB.
6. Expose import preview/apply through administrator routes only after BFP-07.

### Validation And Definition Of Done

- Dry-run performs no writes and reports every proposed create, update, skip, warning, and error.
- Applying the same file twice is idempotent.
- Store-specific values are never replaced by external metadata.
- Ambiguous matches require an administrator decision.
- Source, retrieval time, and MusicBrainz identifiers are traceable.
- External API failure leaves the catalog usable; all 116 bundled records can decode their committed local artwork, while unresolved future records retain the placeholder.

## BFP-07: Admin Mode Backend

> Completed 2026-07-09. Implementation summary: every `/api/admin/*` route calls `requireRole("admin")` after session verification and `assertMutationOrigin` for writes. Routes: `GET /api/admin/summary`, `GET/POST /api/admin/products`, `GET/PATCH/DELETE /api/admin/products/[id]`, `POST /api/admin/products/[id]/restore`, `POST /api/admin/products/[id]/artwork/refresh`, `PATCH /api/admin/products/[id]/artwork`, `POST /api/admin/catalog/import/preview`, `POST /api/admin/catalog/import/apply`. Product create allocates a numeric public id via the `vinylRecords` counter (max(counter, max-existing)+1); edit/delete use compare-and-set on Mongoose-managed `updatedAt` for optimistic concurrency and return `CONFLICT` on stale state. Soft-delete sets `deletedAt`; restore clears it. Import preview is non-mutating and returns a one-time, expiring in-process preview token consumed by apply (which re-plans inside the existing transactional bulk-write). Artwork refresh reuses the MusicBrainz/Cover Art matching rules and only writes verified, approved-host artwork. Administrator actions append best-effort audit records (`AuditLog`, admin public id `select:false`, safe projection). Reads work in seed and mongodb mode; writes are mongodb-only and return `PERSISTENCE_UNAVAILABLE` (503) in seed mode. Verified: `node --test` 114/114, eslint clean, `next build` green, and a live seed-mode smoke (admin summary 116 active, list, customer=403, anonymous=401, seed write=503, artwork refresh 200/404).

This plan defines the protected administrator API needed by the integrated frontend admin workspace.

### Goal

Support a small integrated administrator mode for catalog maintenance without adding a separate application or broad user-management system.

### Authorization Boundary

- Every administrator endpoint calls `requireRole("admin")` after session verification.
- The frontend route guard improves navigation but is not a security control.
- Registration always creates customers. Administrator promotion uses a local script or direct controlled database action.
- Administrator actions create audit logs. Audit records exclude secrets and full sensitive request bodies.

### Planned Routes

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/admin/summary` | Counts for active products, low/out-of-stock items, unresolved images, and recent safe audit actions. |
| `GET` | `/api/admin/products` | Paginated catalog management list including soft-deleted records when requested. |
| `POST` | `/api/admin/products` | Create a validated record and allocate a numeric public ID. |
| `GET` | `/api/admin/products/:id` | Return the editable record plus provenance. |
| `PATCH` | `/api/admin/products/:id` | Update allowed fields with optimistic concurrency. |
| `DELETE` | `/api/admin/products/:id` | Soft-delete a product. |
| `POST` | `/api/admin/products/:id/restore` | Restore a soft-deleted product. |
| `POST` | `/api/admin/catalog/import/preview` | Validate and preview CSV/JSON without writes. |
| `POST` | `/api/admin/catalog/import/apply` | Apply an approved preview token once. |
| `POST` | `/api/admin/products/:id/artwork/refresh` | Refresh MusicBrainz/Cover Art metadata under rate limits. |

### Consistency Rules

- Product updates use `updatedAt` or a version key to reject stale edits with `409 CONFLICT`.
- Soft-deleted products remain in historical logs but disappear from active reads and recommendations.
- Stock changes affect new cart calculations immediately; existing carts return warnings rather than silently deleting items.
- Catalog mutations invalidate any in-process catalog/facet cache.
- Recommendation logs keep their historical item IDs and algorithm context.

### Implementation Phases

1. Add role enforcement and audit logging tests before product writes.
2. Implement read-only admin summary and list routes.
3. Add create/edit validation and optimistic concurrency.
4. Add soft delete and restore.
5. Add import preview/apply with one-time preview tokens.
6. Add artwork refresh with external-service failure handling.
7. Connect the integrated frontend `/admin` routes.

### Validation And Definition Of Done

- Anonymous and customer sessions cannot reach any administrator data or mutation.
- Create, edit, soft delete, restore, stock changes, conflicts, and audit entries are tested.
- No administrator action can modify a product's numeric public ID.
- Import apply cannot be replayed or used after its preview expires.
- Public catalog and recommendation routes remain backward compatible.

## Backend-Wide Validation Gate

After each implemented backend plan or phase, run:

```powershell
npm test
npm run lint
npm run build
```

Database phases additionally require the relevant smoke, migration dry-run, parity, index, and failure-path checks described above. Passing seed-mode tests does not prove Atlas behavior, and an Atlas connection does not prove the frontend integration.

## Personalization Roadmap (PERS-00 - PERS-09)

This section records the dependency-safe personalization roadmap. PERS-00 through PERS-02 were completed on 2026-07-10 after BFP-07, FFP-07, and FFP-08; PERS-03 through PERS-09 remain planned. The sequence does not reorder, replace, remove, or silently redefine any existing plan. Full detail lives in `PERSONALIZATION_IMPLEMENTATION_PLAN.md`.

BFP-05 remains its own on-hold placeholder; completed PERS-00 records the method decision that resolves its open question under new IDs and does not reuse the BFP-05 ID.

Collaborative filtering and matrix factorization are explicitly excluded; the project is not collecting sufficient real-user evidence. The existing offline evaluator, interaction logging, recommendation logging, algorithm versioning, and privacy boundaries are preserved; "evaluation with sufficient evidence" is not part of this roadmap, and the `insufficient-evidence` status is unchanged.

### Plan Status Summary (Personalization)

| ID | Plan | Status | Main Gate |
| --- | --- | --- | --- |
| PERS-00 / BDEC-016 | Audit and decision freeze | Completed 2026-07-10 | Architecture, privacy, modes, rollback, and no-quality-claim decisions are frozen. |
| PERS-01 / BFP-08 | Proper identity enforcement | Completed 2026-07-10 | Safe subject descriptors restrict the arbitrary-user route; cross-user and product-route guards pass. |
| PERS-02 / BFP-09 | Session-owned signed-in-user endpoint | Completed 2026-07-10 | `GET /api/recommendations/me` serves verified-customer cold-start or anonymous fallback with parity ranking. |
| PERS-03 / BFP-10 | Unified profile and feedback domain | Planned | One backend-owned profile service; durable feedback collection. |
| PERS-04 / BFP-11 | Preference-aware ranking | Planned | Hard constraints and soft scores; truthful explanations. |
| PERS-05 / BFP-12 | Negative feedback | Planned | Not-interested, already-own, undo, optional show-fewer-like-this. |
| PERS-06 / BFP-13 | Behavioral-signal personalization | Planned | Differentiated strength; opt-out boundary fix. |
| PERS-07 / BFP-14 | Popularity baseline and fallback | Planned | Aggregate-evidence popularity; fallback ladder. |
| PERS-08 / BFP-15 | Hybrid recommendation orchestration | Planned | Normalized components; diversity reranking; `personalized-hybrid-v1`. |
| PERS-09 / BFP-16 | Integration, hardening, documentation closure | Planned | End-to-end integration; regression protection; documentation closure. |

### Dependency-Safe Personalization Order (Appended After FFP-08)

| Order | Plan | Dependency-safe outcome |
| --- | --- | --- |
| 15 | PERS-00: audit and decision freeze | Decisions recorded; no-regression checklist defined. |
| 16 | PERS-01 / BFP-08: identity enforcement | Recommendation subject derived only from the verified session. |
| 17 | PERS-02 / BFP-09 + FFP-09: session-owned endpoint | Authenticated users get their own recommendations; anonymous fallback works. |
| 18 | PERS-03 / BFP-10: unified profile and feedback domain | One profile service; durable feedback; opt-out split. |
| 19 | PERS-04 / BFP-11 + FFP-10: preference-aware ranking | Stored preferences drive ranking without silent constraint relaxation. |
| 20 | PERS-05 / BFP-12 + FFP-11: negative feedback | Durable suppression and controlled negative evidence. |
| 21 | PERS-06 / BFP-13 + FFP-12: behavioral signals | Differentiated behavioral personalization; opt-out fully honored. |
| 22 | PERS-07 / BFP-14: popularity baseline and fallback | Real aggregate-evidence popularity; feedback-loop safeguards. |
| 23 | PERS-08 / BFP-15 + FFP-13: hybrid orchestration | Preference, content, behavioral, and popularity combined truthfully. |
| 24 | PERS-09 / BFP-16 + FFP-14: integration and hardening | End-to-end personalization; regression protection; documentation closed. |

Each milestone ships behind a feature flag, preserves `content-demo-v1` for regression, and is independently reversible. Implementation requires a separate explicit task and must not begin before FFP-08 is complete and the user opens personalization work.
