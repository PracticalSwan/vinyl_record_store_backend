# CLAUDE.md

Backend instructions for the Vinyl Record Store Recommender System.

This is a subtree instruction file. Read the global instructions and the project-root `../AGENTS.md` and `../CLAUDE.md` first. Root rules take precedence.

## Current State

The backend is an implemented integration and authenticated customer-state service, not a planning-only Next.js starter.

- Next.js 16.2.9, React 19.2.4, Tailwind 4, and JavaScript modules.
- Routes for health, product listing/detail, search, product similarity, user recommendations, authentication, profile/preferences, interactions, wishlist, cart, ratings, guest merge, and account deletion.
- The reviewed local seed remains the default catalog. Explicit `CATALOG_DATA_SOURCE=mongodb` selection reads the same 116-record catalog from Atlas through the MongoDB repository.
- Mongoose models, persistence repositories, signed sessions, authenticated customer writes, an idempotent seed migration, and live index verification are implemented.
- Deterministic content-based recommendations with explanations, stock preference, exclusions, diversity limits, and an algorithm version.
- PERS-00 through PERS-02 are implemented: identity-safe subject descriptors restrict the legacy arbitrary-user route, and `GET /api/recommendations/me` derives a customer only from the verified session, rejects administrators, and otherwise returns an anonymous fallback. Ranking remains `content-demo-v1`; preferences and behavior do not affect it yet.
- MongoDB-mode recommendation request logging records exact ordered lists, reasons, surfaces, modes, versions, exclusions, and 90-day expiry; seed mode and usage opt-out suppress it.
- Preview-first CSV/JSON catalog ingestion supports atomic apply, source ownership, duplicate/conflict detection, optional MusicBrainz/Cover Art Archive enrichment, release-bound artwork, release-group fallback, local cache, and field provenance. The bundled catalog has one human-reviewed manifest entry and approved hotlink for every record.
- The offline evaluator builds pseudonymized leakage-safe datasets, compares random/popularity/content-based rankings only above the evidence threshold, and otherwise writes aggregate counts and captured-field coverage without quality claims.
- Administrator mode (BFP-07) exposes role-gated `/api/admin/*` routes (summary, product CRUD with `updatedAt` optimistic concurrency, soft-delete/restore, preview-token catalog import apply, artwork refresh) with best-effort audit logging. Reads work in seed and mongodb mode; writes are mongodb-only and return `PERSISTENCE_UNAVAILABLE` (503) in seed mode.
- Automated catalog, import, artwork, persistence, migration, authentication, write-state, recommender-behavior, evaluation, metric, and administrator sanity tests.

## Folder Boundary

- `src/app/api/` owns route handlers, including the `admin/` administrator surface.
- `src/services/adminCatalog.js` and `src/services/artworkRefresh.js` own administrator catalog and artwork business logic; `src/lib/admin/previewTokens.js` owns the one-time import preview-token store; `src/validation/admin.js` owns administrator input validation.
- `src/services/` owns catalog, import, authentication, customer-state, and account-lifecycle business logic.
- `src/repositories/` owns seed and MongoDB data access.
- `src/models/` owns strict Mongoose schemas and indexes.
- `src/validation/` owns catalog, authentication, and mutation validation.
- `src/lib/auth/` owns password, signed-session, cookie, and authorization helpers; `src/lib/interactionCap.js` bounds interaction ingestion per identity.
- `src/lib/catalog/` and `src/lib/external/` own import parsing/validation and rate-limited metadata clients.
- `src/lib/recommender/` owns scoring, explanations, diversity, dataset construction, and evaluation helpers.
- `src/data/records.js` owns store metadata; `src/data/artworkManifest.js` owns reviewed external identities; `src/data/catalogRecords.js` combines them for seed mode and migration.
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
- Label user results as `demo-profile`, `cold-start`, or `anonymous-fallback` as returned. Session ownership is implemented, but preference/behavior personalization is not; never imply measured quality or ranking behavior that is not active.
- Do not report recommendation quality metrics without leakage-safe held-out interactions and baselines. Behavior tests are not offline quality findings.
- Below 20 eligible subjects with 5 final positive products each, the evaluator must emit an explicit non-conclusion with aggregate captured-field coverage only.
- Use the project `recommender-evaluation` skill whenever computing or reporting ranking or beyond-accuracy metrics.

## Integration And Environment

- `FRONTEND_ORIGIN` controls API CORS and defaults to `http://localhost:5173`.
- `RECOMMENDER_ALGORITHM_VERSION` overrides the default `content-demo-v1` label.
- `MUSICBRAINZ_USER_AGENT` identifies catalog enrichment requests. It must contain an application name, version, and contact.
- `CATALOG_DATA_SOURCE` defaults to `seed`; set it to `mongodb` only when Atlas configuration and migrated data are ready.
- `MONGODB_URI` and `MONGODB_DB_NAME` configure the server-only Atlas connection through an ignored `.env.local`. Explicit MongoDB mode never silently falls back to seed data.
- `AUTH_SECRET` signs eight-hour HttpOnly sessions. Exactly three showcase customers are seeded into MongoDB by `db:seed:users` (`src/data/demoUsers.js`); their usernames are reserved and their immutable public IDs are protected from account deletion. The single administrator account is environment-backed through `AUTH_DEMO_ADMIN_*`; there is no environment-backed customer or admin-promotion path. Registered customers persist in MongoDB and require MongoDB mode.
- `PERS_IDENTITY_STRICT` and `PERS_ME_ENDPOINT` default on and provide explicit rollback switches for the completed identity and session-owned endpoint milestones.
- Credentialed mutations require the exact `FRONTEND_ORIGIN`; ownership always comes from the verified session, never from a client user ID.
- API contract changes require matching updates in both repositories.

## Validation

For backend changes, run:

```bash
npm test
npm run lint
npm run build
```

Use live endpoint and cross-origin checks when the environment permits them.

After any E2E or auth-write run that exercised MongoDB mode, remove the test-generated documents from Atlas with `npm run db:clean:test:apply` (dry-run: `npm run db:clean:test`). This is the standalone form of the root `CLAUDE.md`/`AGENTS.md` "Post-test Atlas cleanup" rule; the frontend Playwright suite also runs it automatically via its global teardown. The tool deletes only `e2e_`-prefixed users and the test-residue collections (`interactions`, `recommendationLogs`, `carts`, `wishlists`, `ratings`, `guestMerges`), never `vinylRecords`, the demo users, `counters`, `orders`, or `auditLogs`.

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
