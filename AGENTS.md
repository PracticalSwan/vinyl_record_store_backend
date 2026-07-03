# AGENTS.md

Backend instructions for the Vinyl Record Store Recommender System.

This is a subtree instruction file. Read the global instructions and the project-root `../AGENTS.md` and `../CLAUDE.md` first. Root rules take precedence.

## Current State

The backend is an implemented read-only integration service, not a planning-only Next.js starter.

- Next.js 16.2.9, React 19.2.4, Tailwind 4, and JavaScript modules.
- Routes for health, product listing/detail, search, product similarity, and user recommendations.
- Approved local demo seed remains the default catalog. Explicit `CATALOG_DATA_SOURCE=mongodb` selection reads the migrated catalog from Atlas through the MongoDB repository.
- Mongoose models, persistence repositories, an idempotent seed migration, and live index verification are implemented; customer write APIs are not.
- Deterministic content-based recommendations with explanations, stock preference, exclusions, diversity limits, and an algorithm version.
- Automated catalog, persistence, migration, recommender-behavior, and metric sanity tests.

## Folder Boundary

- `src/app/api/` owns route handlers.
- `src/services/` owns catalog business logic.
- `src/repositories/` owns seed and MongoDB data access.
- `src/models/` owns strict Mongoose schemas and indexes.
- `src/validation/` owns request validation.
- `src/lib/recommender/` owns scoring, explanations, diversity, and evaluation helpers.
- `src/data/records.js` is the approved catalog seed and seed-mode data source.
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
- Label user results as `demo-profile` or `cold-start`; never imply real personalization.
- Do not report recommendation quality metrics without leakage-safe held-out interactions and baselines. Behavior tests are not offline quality findings.
- Use the project `recommender-evaluation` skill whenever computing or reporting ranking or beyond-accuracy metrics.

## Integration And Environment

- `FRONTEND_ORIGIN` controls API CORS and defaults to `http://localhost:5173`.
- `RECOMMENDER_ALGORITHM_VERSION` overrides the default `content-demo-v1` label.
- `CATALOG_DATA_SOURCE` defaults to `seed`; set it to `mongodb` only when Atlas configuration and migrated data are ready.
- `MONGODB_URI` and `MONGODB_DB_NAME` configure the server-only Atlas connection through an ignored `.env.local`. Explicit MongoDB mode never silently falls back to seed data.
- API contract changes require matching updates in both repositories.

## Validation

For backend changes, run:

```bash
npm test
npm run lint
npm run build
```

Use live endpoint and cross-origin checks when the environment permits them.

## Documentation Synchronization

Use `docs/PROJECT_CONTEXT.md` as the backend source of truth. Update only affected files, including API, architecture, data, recommender, evaluation, risk, roadmap, backlog, decision, setup, README, lessons, and environment docs. Keep `AGENTS.md` and `CLAUDE.md` aligned.

## Safety

- Never commit real secrets, MongoDB credentials, private interaction logs, emails, orders, ratings, or `.env` files.
- Do not add scraping, auth, payments, admin APIs, collaborative filtering, or customer write routes without explicit scope.
- Do not use destructive Git commands or overwrite user work.
- Cleanup must use verified exact paths inside this repository. Never delete source, docs, assets, config, or `node_modules` without explicit scope.
- Do not commit or push unless the user explicitly asks.
- Do not use emojis in responses, docs, code comments, UI copy, commits, or project files.

## Completion Report

Report changed behavior, files, validation actually run, supported routes, data limitations, and deferred work. Do not present deferred work as started.
