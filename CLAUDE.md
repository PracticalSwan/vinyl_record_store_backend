# CLAUDE.md

Backend instructions for the Vinyl Record Store Recommender System.

This is a subtree instruction file. Read the global instructions and the project-root `../AGENTS.md` and `../CLAUDE.md` first. Root rules take precedence.

## Current State

The backend is an implemented integration and authenticated customer-state service, not a planning-only Next.js starter.

- Next.js 16.3.1, React 19.2.4, Tailwind 4, and JavaScript modules.
- Routes for health, product listing/detail, search, product similarity, user recommendations, authentication, profile/preferences, interactions, wishlist, cart, ratings, guest merge, and account deletion.
- The reviewed 116-record local seed remains the no-database default and legacy fallback. Explicit `CATALOG_DATA_SOURCE=mongodb` follows immutable active `amazon-reviews-2023-cds-vinyl-5core-v3` in `datasetProducts`; v2 is the immediate rollback release, while v1 and the legacy catalog remain the identity/legacy base.
- Mongoose models, persistence repositories, signed sessions, authenticated customer writes, an idempotent seed migration, and live index verification are implemented.
- Deterministic content-based recommendations with explanations, stock preference, exclusions, diversity limits, and an algorithm version.
- PERS-00 through PERS-09 are implemented. PERS-04 through PERS-08 remain behind default-off flags: the session-owned `/api/recommendations/me` path supports exact-item feedback and the `preference-profile-v1`, `behavior-profile-v1`, `popularity-v1`, and `personalized-hybrid-v1` branches. `content-demo-v1` remains the default and rollback path; PERS-09 adds integration, privacy/failure regression, and documentation closure without enabling ranking flags.
- MongoDB-mode recommendation request logging records exact ordered lists, reasons, surfaces, modes, versions, exclusions, and 90-day expiry; seed mode and usage opt-out suppress it.
- Preview-first CSV/JSON catalog ingestion supports atomic apply, source ownership, duplicate/conflict detection, optional MusicBrainz/Cover Art Archive enrichment, release-bound artwork, release-group fallback, local cache, and field provenance. The bundled catalog has one human-reviewed manifest entry and approved hotlink for every record.
- The offline evaluator builds pseudonymized leakage-safe datasets, compares random/popularity/content-based rankings only above the evidence threshold, and otherwise writes aggregate counts and captured-field coverage without quality claims.
- Corrected DATA-00 through DATA-15 v3 adds controlled metadata/year semantics, authoritative release-group original years for 208 strict matches, stable v1 IDs, immutable sealed rows and exact digests, strict MusicBrainz/CAA artwork with an exact local fallback set, 20,288 isolated historical ratings from 2,387 HMAC-pseudonymous subjects, transactional activation with v2 as the immediate rollback release, and aggregate-only readiness. Readiness alone is not a model result. The later NEXT-01/NEXT-03 aggregate benchmark evaluated random, positive-popularity, content, and one offline-only biased-MF candidate; it did not mutate DATA-15, validate live PERS modes, or authorize live integration.
- Production is GitHub-linked Netlify at `https://groovehaus-api.netlify.app/`; `master` is the only branch and triggers production builds. The Vite storefront uses a same-origin `/api/*` proxy from `https://groovehaus-store.netlify.app/`. Production environment overrides select MongoDB/v3 Profile B; source defaults remain unchanged.
- The sealed v3 source remains 2,305 rows. `src/data/catalogPresentationOverlay.json` suppresses 46 high-confidence duplicate display rows without deleting source/history, leaving 2,259 customer-visible records; presentation-only supplemental artwork raises visible artwork to 1,300/2,259 while never overriding sealed structured artwork.
- Administrator mode (BFP-07) exposes role-gated `/api/admin/*` routes (summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, preview-token catalog import apply, artwork refresh) with best-effort audit logging. Reads work in seed and mongodb mode; writes are mongodb-only and return `PERSISTENCE_UNAVAILABLE` (503) in seed mode.
- Artwork uses two backend-owned delivery paths. `GET /api/artwork?u=<approved URL>` is the bounded proxy, varies the Netlify cache key by `u`, and validates every Cover Art Archive/Internet Archive redirect hop. `GET /api/artwork/local/:publicId` resolves the 116-record legacy manifest or 208-file strict-v3 manifest. Dataset rows with verified local art render local-first in the client; supplemental presentation art uses the proxy without claiming an exact pressing. Each local JPEG retains generated provenance, size, dimensions, and SHA-256 evidence.
- Automated catalog, import, artwork proxy/local-bundle, persistence, migration, authentication, write-state, recommender-behavior, evaluation, metric, and administrator sanity tests.

## Folder Boundary

- `src/app/api/` owns route handlers, including the `admin/` administrator surface.
- `src/services/adminCatalog.js` and `src/services/artworkRefresh.js` own administrator catalog and artwork business logic; `src/lib/admin/previewTokens.js` owns the one-time import preview-token store; `src/validation/admin.js` owns administrator input validation.
- `src/services/artworkImage.js` and `src/lib/external/artworkImageProxy.js` own the remote proxy. `src/services/localArtwork.js`, `src/lib/external/localArtworkAssets.js`, `src/data/localArtworkManifest.js`, and `public/artwork/` own the canonical-ID local fallback boundary.
- `src/services/` owns catalog, import, authentication, customer-state, and account-lifecycle business logic.
- `src/repositories/` owns seed and MongoDB data access.
- `src/models/` owns strict Mongoose schemas and indexes.
- `src/validation/` owns catalog, authentication, and mutation validation.
- `src/lib/auth/` owns password, signed-session, cookie, and authorization helpers; `src/lib/interactionCap.js` bounds interaction ingestion per identity.
- `src/lib/catalog/` and `src/lib/external/` own import parsing/validation and rate-limited metadata clients.
- `src/lib/dataset/`, `DatasetProduct`, `DatasetImport`, `HistoricalAmazonRating`, and `data/amazon-reviews-2023/` own the external research-data boundary, transformation, immutable catalog, version pointer, artwork decisions, and historical readiness adapter.
- `src/lib/recommender/` owns scoring, explanations, diversity, dataset construction, and evaluation helpers.
- `src/data/records.js` owns store metadata; `src/data/artworkManifest.js` owns reviewed external identities; `src/data/localArtworkManifest.js` owns generated local-file provenance; `src/data/catalogRecords.js` combines catalog metadata for seed mode and migration.
- `src/lib/db/` owns connection, data-source selection, and migration support.
- `../vinyl_record_store_frontend/` owns all customer-facing UI and client state.

## Required Startup Reads

Read `../AGENT_MEMORY.md` at session start and append a dated entry at session end if anything changed (cross-agent shared memory — see root `CLAUDE.md`/`AGENTS.md`).

1. Global and project-root instructions.
2. `LESSONS.md`.
3. `AGENTS.md` and `CLAUDE.md`.
4. `README.md` and relevant files under `docs/`.
5. `package.json`, `.env.example`, and lockfiles for setup or dependency changes.

## API And Recommender Rules

- Preserve `{ data, meta? }` success and `{ error: { code, message } }` error envelopes.
- Validate route parameters and query values before service calls.
- Keep route handlers thin and errors safe; never expose stack traces or secrets.
- Product responses must not expose seed-only recommendation reasons.
- Exclude source and known-profile records from recommendations, prefer available records, and keep explanations tied to actual matching fields.
- Label user results as `demo-profile`, `cold-start`, `preference-profile`, `behavior-profile`, `popularity`, `personalized-hybrid`, or `anonymous-fallback` as returned. Exact feedback remains a server-owned exclusion; never imply measured recommendation quality or enablement when the new flags are off.
- Do not report recommendation quality metrics without leakage-safe held-out interactions and baselines. Behavior tests are not offline quality findings.
- Below 20 eligible subjects with 5 final positive products each, the evaluator must emit an explicit non-conclusion with aggregate captured-field coverage only.
- Use the project `recommender-evaluation` skill whenever computing or reporting ranking or beyond-accuracy metrics.

## Integration And Environment

- `FRONTEND_ORIGIN` controls API CORS and defaults to `http://localhost:5173`.
- `RECOMMENDER_ALGORITHM_VERSION` overrides the default `content-demo-v1` label.
- `MUSICBRAINZ_USER_AGENT` identifies catalog enrichment requests. It must contain an application name, version, and contact. The artwork image proxy (`GET /api/artwork`) reuses it as the `User-Agent` for upstream Cover Art Archive image requests.
- `CATALOG_DATA_SOURCE` defaults to `seed`; set it to `mongodb` only when Atlas configuration and migrated data are ready.
- `MONGODB_URI` and `MONGODB_DB_NAME` configure the server-only Atlas connection through an ignored `.env.local`. Explicit MongoDB mode never silently falls back to seed data.
- `AUTH_SECRET` signs eight-hour HttpOnly sessions. Exactly three showcase customers are seeded into MongoDB by `db:seed:users` (`src/data/demoUsers.js`); their usernames are reserved and their immutable public IDs are protected from account deletion. The single administrator account is environment-backed through `AUTH_DEMO_ADMIN_*`; there is no environment-backed customer or admin-promotion path. Registered customers persist in MongoDB and require MongoDB mode.
- `PERS_IDENTITY_STRICT` and `PERS_ME_ENDPOINT` default on and provide explicit rollback switches for the completed identity and session-owned endpoint milestones.
- Credentialed mutations require the exact `FRONTEND_ORIGIN`; ownership always comes from the verified session, never from a client user ID.
- API contract changes require matching updates in both repositories.

## Validation

For backend changes, run:

```bash
npm run catalog:artwork:verify
npm test
npm run lint
npm run build
```

Use live endpoint and cross-origin checks when the environment permits them.

After any E2E or auth-write run that exercised MongoDB mode, remove the test-generated documents from Atlas with `npm run db:clean:test:apply` (dry-run: `npm run db:clean:test`). This is the standalone form of the root `CLAUDE.md`/`AGENTS.md` "Post-test Atlas cleanup" rule; the frontend Playwright suite also runs it automatically via its global teardown. The tool deletes only `e2e_`-prefixed users, the existing full-wipe test-residue collections (`interactions`, `recommendationLogs`, `carts`, `wishlists`, `ratings`, `guestMerges`), and `feedback` rows owned by those matched `e2e_` users. It never collection-wipes durable feedback and never touches `vinylRecords`, the demo users, `counters`, `orders`, or `auditLogs`.

## Documentation Synchronization

Use `docs/PROJECT_CONTEXT.md` as the backend source of truth. Update only affected files, including API, architecture, data, recommender, evaluation, risk, roadmap, backlog, decision, setup, README, lessons, and environment docs. Keep `AGENTS.md` and `CLAUDE.md` aligned.

## Safety

- Never commit real secrets, MongoDB credentials, private interaction logs, emails, orders, ratings, or `.env` files.
- Do not add scraping, payments, public admin APIs, collaborative filtering, demo orders, or new identity features without explicit scope.
- Do not use destructive Git commands or overwrite user work.
- Cleanup must use verified exact paths inside this repository. Never delete source, docs, assets, config, or `node_modules` without explicit scope.
- Do not commit or push unless the user explicitly asks.
- Do not use emojis in responses, docs, code comments, UI copy, commits, or project files.

## Completion Report

Report changed behavior, files, validation actually run, supported routes, data limitations, and deferred work. Do not present deferred work as started.
