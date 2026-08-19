# Vinyl Record Store Backend

The API service behind the **Vinyl Record Store Recommender System**, an academic project for CSX4207 (Decision Support and Recommender Systems) at Assumption University. It is a Next.js application that serves the vinyl catalog, powers explainable recommendations, and manages authenticated customer state for the Groovehaus storefront.

## About

This service is the core of the demo. It owns the product catalog, the recommendation engine, customer accounts and sessions, and every write operation. The separate Groovehaus frontend is a pure API consumer.

Three things worth knowing up front:

- MongoDB mode currently activates the immutable `amazon-reviews-2023-cds-vinyl-5core-v3` research catalog: 2,305 products in `datasetProducts` and 20,288 isolated historical ratings from 2,387 pseudonymous subjects. V2 is the immediate rollback release, v1 is the legacy identity-registry base, and the original 116 reviewed records remain available.
- Recommendations default to deterministic `content-demo-v1` behavior: the restricted legacy showcase is `demo-profile`, verified customers use a session-owned `cold-start` path, and visitors receive an `anonymous-fallback`. When the default-off flags are enabled, verified customers may receive `preference-profile-v1`, `behavior-profile-v1`, or `personalized-hybrid-v1`, and anonymous/empty-profile requests may receive `popularity-v1`; exact feedback remains a server-owned exclusion. No recommendation-quality claim is made.
- The 116 legacy records retain their reviewed MusicBrainz/Cover Art Archive mappings and verified local JPEG fallbacks. V3 has 208 strict accepted artwork decisions with a separate verified local fallback set; v2 rollback evidence independently pins the same stable assets. Ambiguous or unresolved rows use the generic placeholder and never borrow legacy art. The dataset workflow does not reuse Amazon images. Nullable commercial fields remain unknown and non-purchasable. The live-customer evaluator still reports `insufficient-evidence`; separately, the completed historical benchmark measured random, positive-popularity, content, and one offline-only biased-MF candidate. Content was strongest descriptively; biased MF was a negative result and is not production-integrated.

## API

| Method | Route | Purpose |
| --- | --- | --- |
| `GET` | `/api/health` | Service and algorithm status. |
| `GET` | `/api/products` | Paginated, filterable product list. |
| `GET` | `/api/products/:id` | Product detail. |
| `GET` | `/api/search?q=` | Text search with catalog filters. |
| `GET` | `/api/artwork?u=` | Primary artwork proxy: validates every redirect hop, bounds time/size, and disk-caches approved Cover Art Archive bytes. |
| `GET` | `/api/artwork/local/:publicId` | Redirects a canonical bundled-record ID to its immutable, content-addressed local JPEG; malformed IDs return 400 and unmapped IDs return 404. |
| `GET` | `/api/recommendations/product/:id` | Similar records with explanations. |
| `GET` | `/api/recommendations/me` | Session-owned customer preference/behavior/hybrid or cold-start list, plus aggregate popularity or anonymous fallback when applicable; ranking flags remain default-off. |
| `GET` | `/api/recommendations/user/:userId` | Restricted legacy showcase: `demo-user` or generic cold-start only. |
| `POST` | `/api/auth/register` | Create a customer account and session. |
| `POST` | `/api/auth/login` | Sign in a registered or demo identity. |
| `POST` | `/api/auth/logout` | End the session. |
| `GET` | `/api/auth/session` | Restore safe public session state. |
| `GET`, `DELETE` | `/api/me` | Read the profile or delete the account. |
| `PATCH` | `/api/me/preferences` | Replace onboarding preferences. |
| `POST` | `/api/interactions` | Ingest a bounded analytics batch. |
| `GET` | `/api/wishlist` | Read the signed-in customer's wishlist. |
| `PUT`, `DELETE` | `/api/wishlist/:productId` | Add or remove one wishlist product. |
| `GET` | `/api/cart` | Read the signed-in customer's cart. |
| `PUT`, `DELETE` | `/api/cart/:productId` | Set or remove one cart product. |
| `GET` | `/api/ratings` | Read the signed-in customer's ratings. |
| `PUT`, `DELETE` | `/api/ratings/:productId` | Set or remove one product rating. |
| `PUT`, `DELETE` | `/api/me/feedback/:productId` | Optional exact-item `not-interested`/`already-own` feedback and idempotent undo. |
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

The final classroom setup is the explicit MongoDB/v3 **Profile B: Selective Personalization** environment, not the committed default. It enables saved-preference ranking and exact feedback while keeping behavioral ranking, popularity, and hybrid disabled. Follow [`docs/DEMO_PERSONALIZATION_RUNBOOK.md`](docs/DEMO_PERSONALIZATION_RUNBOOK.md) for exact flags, preflight, startup, rollback, and claim boundaries.

The current sealed-v3 dataset workflow is hash-pinned and fail-closed. `dataset:prepare` is a no-write reproduction check for the existing private v3 staging evidence; it will not replace sealed staging or the committed public quality summary and it rejects same-key staging overrides:

```powershell
npm.cmd run dataset:profile
npm.cmd run dataset:prepare
npm.cmd run dataset:artwork:enrich
npm.cmd run dataset:artwork:verify
npm.cmd run dataset:import
npm.cmd run dataset:verify
npm.cmd run dataset:evaluation:readiness
```

Raw source and staging files remain ignored. Apply/activation commands are not part of normal sealed-v3 verification; use them only for an explicitly approved new release or lifecycle rehearsal. See [`docs/AMAZON_REVIEWS_DATA_INTEGRATION_PLAN.md`](docs/AMAZON_REVIEWS_DATA_INTEGRATION_PLAN.md) before reacquiring artwork, importing, activating, or rolling back the dataset.

The historical baseline evaluator requires a new explicit immutable run ID and runs validation separately from any authorized test:

```powershell
npm.cmd run recommender:evaluate:historical -- --stage=validation --run-id=<new-run-id>
```

The canonical NEXT-01 through NEXT-03 packet is under `reports/recommender/historical/amazon-reviews-2023-cds-vinyl-5core-v3/next-01-final-v3/`. Its validation cohort contains 1,823 subjects. NEXT-02 approved one bounded observed-only biased-MF experiment, and NEXT-03 selected 16 factors, learning rate `0.005`, regularization `0.02`, and 50 epochs on validation before consuming the final test once. The common test cohort contains 1,708 subjects with a relevant test target; 679 otherwise structurally eligible subjects are outside that conditional metric cohort. The permanent attempt marker forbids a rerun. Historical subjects remain research pseudonyms and are never joined to Groovehaus customers.

Catalog imports default to a no-write preview: `npm run catalog:import -- --dry-run --input examples/catalog-import-template.json`. Add `--apply` only after reviewing every action; `--enrich` uses MusicBrainz and Cover Art Archive under their service limits. Run `npm run recommender:evaluate` to regenerate the privacy-safe report under `reports/recommender/`.

Artwork curation is also preview-first. `npm run catalog:artwork:propose` produces an ignored JSON report and visual gallery. After human review resolves every close match, `npm run catalog:artwork:build` validates the six explicit manual-review exceptions and regenerates `src/data/artworkManifest.js`. The seed migration manages this reviewed manifest, preserves immutable slugs and soft-delete tombstones, and remains idempotent.

Run `npm run catalog:artwork:download` to stage, validate, and publish local JPEG fallbacks from that reviewed source manifest. The command is idempotent and reuses valid files; `--refresh` forces retrieval and `--prune` removes only verified orphan JPEGs. Run `npm run catalog:artwork:verify` for the non-network legacy release check. It requires exact catalog/source/local ID parity, all 116 hashes and dimensions, and no orphan artwork files. Run `npm run dataset:artwork:verify` for the current v3 set; `dataset:verify -- --dataset-key=amazon-reviews-2023-cds-vinyl-5core-v2 --expect-active=amazon-reviews-2023-cds-vinyl-5core-v3` verifies the v2 rollback evidence while v3 remains active.

## Catalog presentation overlay

The sealed v3 research dataset remains unchanged at 2,305 source products. The customer-facing catalog applies a reproducible presentation overlay that suppresses 46 high-confidence duplicate display rows, leaving 2,259 visible records while preserving direct source-row lookup and all historical evaluation data. Run `npm run catalog:presentation:verify` to confirm that the committed suppression list still matches the active dataset.

Artwork enrichment is also presentation-only. The sealed dataset contributes 176 structured artwork records among the visible rows, and the reviewed supplemental overlay adds Cover Art Archive artwork to 1,124 more records, for 1,300/2,259 visible records with artwork (57.55%). Supplemental artwork is accepted only after a unique MusicBrainz album release-group match (score >= 95, exact normalized title, strong artist match) and a successful image validation through the production artwork proxy. It never overrides sealed structured artwork. Because a MusicBrainz release group can contain multiple editions, supplemental artwork is representative album artwork, not evidence of the exact Amazon pressing. Unresolved records remain without guessed artwork. The resumable enrichment command is `npm run catalog:presentation:artwork`.

## Netlify production

The production API is deployed as the `groovehaus-api` Netlify project using this repository's `netlify.toml` and Netlify's native Next.js runtime. Production uses MongoDB/v3 Profile B and stores `MONGODB_URI`, `AUTH_SECRET`, administrator hashes/salts, and all other sensitive values only in Netlify environment variables.

Set `FRONTEND_ORIGIN` to the exact production storefront origin, `AUTH_COOKIE_SECURE=true`, and `ARTWORK_CACHE_DIR=/tmp/groovehaus-artwork-images`. Keep `PERS_BEHAVIORAL_RANKING`, `PERS_POPULARITY`, and `PERS_HYBRID` disabled. The companion storefront proxies `/api/*` through its own Netlify origin, so browser sessions remain first-party.

## Showcase accounts

Two roles exist: `customer` and `admin`. Exactly three showcase customer accounts are seeded into MongoDB and protected from account deletion by immutable public ID. The single administrator account is environment-backed and is never stored as a customer record.

- Customer (jazz): `jazzlistener` / `jazz-groove-2026`
- Customer (rock): `rockcollector` / `rock-groove-2026`
- Customer (soul): `soulseeker` / `soul-groove-2026`
- Admin: environment-backed through `AUTH_DEMO_ADMIN_USERNAME`, `AUTH_DEMO_ADMIN_PASSWORD_HASH`, and `AUTH_DEMO_ADMIN_PASSWORD_SALT`; no administrator password is committed.

For local Next.js development, escape every `$` delimiter in the scrypt hash as `\$` inside `.env.local`; Next's dotenv loader expands unescaped `$` values. Netlify environment variables are stored literally and do not require that escaping.

Showcase customer logins require MongoDB mode. Seed the accounts with `npm run db:seed:users:apply`. Registered customers choose their own credentials through the frontend.

## Project structure

- `public/artwork/` — 116 immutable legacy JPEG fallbacks plus the current v3 accepted set under `public/artwork/dataset/`; v2 rollback evidence pins the stable dataset assets separately, and provenance lives in the generated manifests/evidence.
- `src/app/api/` — Next.js route handlers.
- `src/services/` — catalog, auth, customer-state, and account logic.
- `src/lib/catalog/` and `src/lib/external/` — import validation and approved metadata clients.
- `src/lib/dataset/` — pinned Amazon Reviews transformation and leakage-safe readiness adapter.
- `src/lib/recommender/` — scoring, leakage-safe datasets, and evaluation helpers.
- `src/models/` — Mongoose schemas and indexes.
- `src/repositories/` — seed and MongoDB data access.
- `src/data/` — store metadata, the reviewed artwork manifest, combined seed records, and showcase user profiles.
- `data/amazon-reviews-2023/` — committed source manifest, transformation config, aggregate quality summary, and ignored raw/staging boundary.
- `docs/` — contracts, architecture, decisions, and evaluation notes.
- `reports/recommender/` — aggregate-only offline evaluation output.

## License

Code and original documentation are MIT, copyright Sithu Win San and Phone Khant Aung. The third-party cover images are excluded from the MIT grant; see [`docs/THIRD_PARTY_ARTWORK.md`](docs/THIRD_PARTY_ARTWORK.md).
