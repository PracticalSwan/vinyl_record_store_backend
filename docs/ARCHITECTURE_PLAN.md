# Backend Architecture

This document describes the implemented read and authenticated mutation service structure.

## Request Flow

1. A Next.js route handler receives the request.
2. Catalog/auth/write validation bounds route parameters, query strings, JSON size, allowed body keys, arrays, timestamps, and controlled values.
3. Authentication verifies scrypt credentials and a signed session cookie; protected routes reload the subject and derive ownership from that session. Recommendation identity is reduced to a safe descriptor before ranking or logging.
4. Catalog, import, artwork delivery, recommendation-serving/logging, evaluation, auth, state, or account services apply business rules and call the appropriate repository or validated local asset boundary.
5. Repositories normalize catalog documents, execute state mutations, preserve idempotency receipts, and use transactions for multi-document consistency.
6. `src/lib/http.js` produces the common success or error envelope.
7. `next.config.mjs` adds exact-origin credentialed CORS; mutation handlers also verify the request origin.

## Modules

- API layer: `src/app/api/`.
- Service layer: `src/services/` for catalog, recommendation serving/logging, authentication, customer state, and account lifecycle.
- Repository layer: `src/repositories/`.
- Persistence models: `src/models/`.
- Validation layer: `src/validation/` plus bounded JSON/origin checks in `src/lib/request.js`.
- Authentication layer: `src/lib/auth/` for scrypt, signed cookies, sessions, roles, and recommendation-subject derivation; `src/lib/interactionCap.js` bounds interaction ingestion per identity.
- Recommender layer: `src/lib/recommender/`.
- Catalog ingestion layer: `src/lib/catalog/`, `src/lib/external/`, `src/services/catalogImport.js`, and the preview/apply command.
- External dataset layer: `src/lib/dataset/`, immutable `DatasetProduct`, `DatasetImport`, `HistoricalAmazonRating`, `datasetImportRepository`, and the prepare/enrich/download/import/activate/rollback/readiness/verify commands.
- Artwork layer: the remote proxy in `src/services/artworkImage.js` and `src/lib/external/artworkImageProxy.js`; the committed fallback verifier/downloader in `src/lib/external/localArtworkAssets.js` and `scripts/download-local-artwork.mjs`; and the stable-ID redirect in `src/services/localArtwork.js`.
- Error/response helpers: `src/lib/errors.js` and `src/lib/http.js`.
- Default data source: `src/data/records.js` through `seedCatalogRepository.js`.
- Optional data source: Atlas through `mongoCatalogRepository.js` and `src/lib/db/mongodb.js`.
- Catalog presentation overlay: `src/data/catalogPresentationOverlay.json` plus presentation services suppress only 46 verified duplicate display rows and add supplemental artwork metadata without changing `datasetProducts`, historical ratings, direct source-row identity, or DATA-15 evidence.
- Data-source selection and migration support: `src/lib/db/dataSource.js` and `src/lib/db/seedMigration.js`.

## Runtime Properties

- Read and mutation routes are dynamic Next.js route handlers.
- Seed mode filters the small demo catalog in memory; explicit MongoDB mode resolves one active dataset key and executes equivalent repository queries with dynamic aggregation-based facets. Without an active key, MongoDB mode selects preserved legacy records.
- Search is a case-insensitive literal substring. Repeated values are ORed within genre, condition, and era facets and ANDed across facets. Sort tie-breakers use stable public IDs.
- The approved seed remains the default. Explicit MongoDB mode requires valid Atlas configuration and never silently falls back.
- The default allowed frontend origin is `http://localhost:5173`; mutations require that exact origin and use credentialed requests.
- Showcase and registered customer identity/state require MongoDB mode; the sole environment-backed administrator is not a customer profile and cannot use `/me` recommendations.
- Recommendation responses always receive request/list IDs. `GET /api/recommendations/me` uses a verified customer descriptor or anonymous fallback; administrators are rejected. The service owns catalog/profile/popularity reads and passes immutable request inputs to pure scorers. MongoDB mode logs a tracking-enabled served list before response; authenticated logging revalidates and transactionally fences the active customer against account deletion, while seed mode and usage opt-out skip persistence.
- Offline evaluation is a command path, not a request route. Live evidence remains separate from the versioned historical Amazon collection. The historical adapter consumes only the active dataset, validates temporal splits and eligibility, and emits aggregate readiness rather than model metrics.
- Artwork runtime ordering is source-aware. Legacy/seed rows use proxy -> local -> placeholder. Strict v3 rows with verified local coverage use local -> proxy -> placeholder. Presentation-only supplemental dataset artwork has no bundled file and uses proxy -> placeholder. The proxy validates every redirect hop and its Netlify cache varies by `u`; local verifiers still enforce exact coverage, SHA-256, dimensions, and orphan-free directories.

## Security

Inputs are bounded before repository work, regex metacharacters are escaped for MongoDB substring matching, ownership is server-derived, login failures are generic with dummy-hash timing, interaction ingestion is per-identity capped, and sessions are signed/HttpOnly. Artwork acquisition starts only from reviewed Cover Art Archive URLs, validates every redirect hop, and enforces time/byte/pixel/JPEG bounds before publication. Public responses omit seed-only reasons, internal ObjectIds, password fields, and raw events. Unexpected failures return safe errors; credentials stay in ignored local environment files.

## Production Deployment

- `master` is the sole Git branch and GitHub-linked source for Netlify production.
- API: `https://groovehaus-api.netlify.app/`; storefront: `https://groovehaus-store.netlify.app/`.
- Netlify runs the Next.js adapter from `netlify.toml`; artwork cache files use `/tmp` and are disposable.
- Browser traffic is same-origin at the storefront and `/api/*` is proxied to the API, so signed cookies remain first-party.
- Production environment overrides select MongoDB/v3 Profile B; committed source defaults remain conservative.
