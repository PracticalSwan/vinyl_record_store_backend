# Backend Lessons

Read this file before every backend session.

## Current Position

- The backend is an implemented Next.js catalog, recommender, authentication, and customer-state API, not a starter or planning-only scaffold.
- The reviewed combined seed remains the default catalog. Explicit `CATALOG_DATA_SOURCE=mongodb` selection uses the Atlas catalog repository; never describe MongoDB as an automatic fallback.
- Strict Mongoose models, repositories, signed sessions, customer write routes, an idempotent seed migration, and index verification exist.
- The recommender is deterministic `content-demo-v1` logic for product similarity, a restricted synthetic `demo-user`, session-owned customer cold-start, and anonymous fallback.
- Recommendation routes return server-generated request/list IDs. In MongoDB mode they log exactly what was served unless the usage-data header opts out; seed mode remains non-persistent.
- Behavior tests prove implementation rules, not offline recommendation quality.
- Catalog ingestion, backend-approved artwork, and the offline evaluation pipeline are implemented. The current evaluation output remains an evidence-bound non-conclusion.

## Working Rules

- Read project-root instructions before subtree instructions.
- Keep `AGENTS.md` and `CLAUDE.md` aligned.
- Keep route handlers thin, validate inputs before service calls, and preserve safe response envelopes.
- Remove seed-only `reason` fields from public product responses; recommendation reasons must be generated from actual matching logic.
- Never describe `demo-profile`, session-owned cold-start, or anonymous fallback output as preference/behavior personalization or measured recommendation quality.
- Build customer recommendation subjects only through `src/lib/auth/recommendationSubject.js`. The legacy URL may select only demo or generic cold-start behavior; it must never become a private-profile lookup.
- Use the recommender-evaluation protocol before computing or reporting ranking-quality metrics.
- Run `npm run db:ping` after changing Atlas credentials or connection code; a successful ping does not prove persistence behavior.
- Run `npm run db:seed` before `npm run db:seed:apply`; abort on conflicts. Use `npm run db:indexes` to verify the connected database after model or index changes.
- Keep seed and MongoDB catalog behavior equivalent, including literal search, repeated facets, deterministic sorting, pagination, soft-delete exclusion, and public numeric IDs.
- Derive ownership from `requireSession`, require the exact mutation origin, bound JSON and arrays, and preserve stable safe error codes.
- Preserve interaction and guest-merge idempotency. Cart and account lifecycle operations must remain transaction-safe, and guest rating merges must use the newest valid timestamp.
- Require complete request/list/version/mode/rank context for recommendation events. Keep request logs aligned to rendered surfaces and never trust a client-supplied authenticated owner.
- Exactly three showcase customers are MongoDB-backed. Protect their immutable public IDs from deletion at the account service boundary before repository access; `seeded` is false for these real user documents. The single administrator is environment-backed; there is no environment-backed customer or promotion path.
- The seed migration manages approved catalog metadata, reviewed MusicBrainz identities, artwork, and provenance. It must never rewrite immutable public IDs/slugs or the `deletedAt` tombstone, so existing URLs and operator soft-deletes survive re-runs.
- Run catalog imports without `--apply` first. Keep batches atomic unless partial mode is explicitly justified, preserve source ownership, and treat supplied public-ID disagreement as a conflict.
- Require MusicBrainz release or release-group identity before accepting artwork. Prefer exact official album-vinyl releases, use same-release-group Cover Art Archive fallback only after review, and keep exceptional non-vinyl identity anchors explicit in the generated manifest. External enrichment may fill missing genre/year/label but must never replace store price, stock, condition, or supplied metadata.
- Treat the committed local artwork bundle as derived, verified catalog data. Download only from the reviewed manifest, validate every redirect hop and JPEG byte stream, publish content-addressed files before the generated manifest, and require exact 116-ID/hash/dimension/orphan verification before release. The stable local endpoint is a fallback, not a second artwork-curation source.
- Pseudonymize evaluation subjects before dataset construction and keep generated reports aggregate-only. Below the minimum evidence boundary, report completeness and counts rather than metrics.
- Keep the root PostCSS override at a patched 8.5.x release while stable Next.js still pins the vulnerable 8.4.31 copy; verify with `npm ls next postcss` and `npm audit`, and do not accept npm's breaking `next@9` force-fix suggestion.
- Run `npm test`, `npm run lint`, and `npm run build` after backend behavior changes.

## Safety

- Do not commit credentials or real private interaction data.
- Do not start payments, broad scraping, public admin tools, collaborative filtering, demo-order APIs, or additional identity features without explicit scope. Manifest-driven retrieval of already reviewed Cover Art Archive files is the narrow approved exception.
- Use plain text instead of emojis.
- Cleanup only verified exact paths inside this repository.
