# Vinyl Record Store Backend

The API service behind the **Vinyl Record Store Recommender System**, an academic project for CSX4207 (Decision Support and Recommender Systems) at Assumption University. It is a Next.js application that serves the vinyl catalog, powers explainable recommendations, and manages authenticated customer state for the Groovehaus storefront.

## About

This service is the core of the demo. It owns the product catalog, the recommendation engine, customer accounts and sessions, and every write operation. The separate Groovehaus frontend is a pure API consumer.

Two things worth knowing up front:

- The catalog ships with 116 reviewed records and can optionally persist to MongoDB Atlas. Seed mode works out of the box with no database required.
- Recommendations remain deterministic `content-demo-v1` behavior: the restricted legacy showcase is `demo-profile`, verified customers use a session-owned `cold-start` path, and visitors receive an `anonymous-fallback`. Preferences and behavior do not affect ranking yet, and no recommendation-quality claim is made.
- Both catalog modes expose the same human-reviewed MusicBrainz identities and approved Cover Art Archive hotlinks. MongoDB mode also supports preview-first catalog imports and an aggregate-only offline evaluation command. The current report is an explicit `insufficient-evidence` result, not a quality score.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and algorithm status. |
| `GET` | `/api/products` | Paginated, filterable product list. |
| `GET` | `/api/products/:id` | Product detail. |
| `GET` | `/api/search?q=` | Text search with catalog filters. |
| `GET` | `/api/recommendations/product/:id` | Similar records with explanations. |
| `GET` | `/api/recommendations/me` | Session-owned customer `cold-start` or anonymous fallback list. |
| `GET` | `/api/recommendations/user/:userId` | Restricted legacy showcase: `demo-user` or generic cold-start only. |
| `POST` | `/api/auth/register` | Create a customer account and session. |
| `POST` | `/api/auth/login` | Sign in a registered or demo identity. |
| `POST` | `/api/auth/logout` | End the session. |
| `GET` | `/api/auth/session` | Restore safe public session state. |
| `GET`, `DELETE` | `/api/me` | Read the profile or delete the account. |
| `PATCH` | `/api/me/preferences` | Replace onboarding preferences. |
| `POST` | `/api/interactions` | Ingest a bounded analytics batch. |
| `GET`, `PUT`, `DELETE` | `/api/wishlist` | Read or mutate the wishlist. |
| `GET`, `PUT`, `DELETE` | `/api/cart` | Read or mutate cart quantities. |
| `GET`, `PUT`, `DELETE` | `/api/ratings` | Read or mutate ratings. |
| `POST` | `/api/me/merge-guest-state` | Merge guest wishlist, cart, and ratings. |

Full query, filter, and response-shape details are documented in `docs/API_CONTRACT_PLAN.md`.

## Tech stack

Next.js, React, Tailwind CSS, and Mongoose, tested with the Node test runner.

## Run locally

```bash
npm install
npm run dev
```

The service runs at `http://localhost:3000`. By default it serves the bundled seed catalog, so no database is needed to try it. To use MongoDB Atlas, set `MONGODB_URI`, `MONGODB_DB_NAME`, and `CATALOG_DATA_SOURCE=mongodb` in `.env.local`, then run the seed and index scripts. See `.env.example` for all options.

Catalog imports default to a no-write preview: `npm run catalog:import -- --dry-run --input examples/catalog-import-template.json`. Add `--apply` only after reviewing every action; `--enrich` uses MusicBrainz and Cover Art Archive under their service limits. Run `npm run recommender:evaluate` to regenerate the privacy-safe report under `reports/recommender/`.

Artwork curation is also preview-first. `npm run catalog:artwork:propose` produces an ignored JSON report and visual gallery. After human review resolves every close match, `npm run catalog:artwork:build` validates the six explicit manual-review exceptions and regenerates `src/data/artworkManifest.js`. The seed migration manages this reviewed manifest, preserves immutable slugs and soft-delete tombstones, and remains idempotent.

## Showcase accounts

Two roles exist: `customer` and `admin`. Exactly three showcase customer accounts are seeded into MongoDB and protected from account deletion by immutable public ID. The single administrator account is environment-backed and is never stored as a customer record.

- Customer (jazz): `jazzlistener` / `jazz-groove-2026`
- Customer (rock): `rockcollector` / `rock-groove-2026`
- Customer (soul): `soulseeker` / `soul-groove-2026`
- Admin: `admin` / `groovehaus-admin`

Showcase customer logins require MongoDB mode. Seed the accounts with `npm run db:seed:users:apply`. Registered customers choose their own credentials through the frontend.

## Project structure

- `src/app/api/` — Next.js route handlers.
- `src/services/` — catalog, auth, customer-state, and account logic.
- `src/lib/catalog/` and `src/lib/external/` — import validation and approved metadata clients.
- `src/lib/recommender/` — scoring, leakage-safe datasets, and evaluation helpers.
- `src/models/` — Mongoose schemas and indexes.
- `src/repositories/` — seed and MongoDB data access.
- `src/data/` — store metadata, the reviewed artwork manifest, combined seed records, and showcase user profiles.
- `docs/` — contracts, architecture, decisions, and evaluation notes.
- `reports/recommender/` — aggregate-only offline evaluation output.

## License

MIT, copyright Sithu Win San and Phone Khant Aung.
