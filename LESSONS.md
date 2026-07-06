# Backend Lessons

Read this file before every backend session.

## Current Position

- The backend is an implemented Next.js catalog, recommender, authentication, and customer-state API, not a starter or planning-only scaffold.
- The approved demo seed remains the default catalog. Explicit `CATALOG_DATA_SOURCE=mongodb` selection uses the Atlas catalog repository; never describe MongoDB as an automatic fallback.
- Strict Mongoose models, repositories, signed sessions, customer write routes, an idempotent seed migration, and index verification exist.
- The recommender is deterministic content-based logic for product similarity, a synthetic `demo-user`, and cold-start fallback.
- Recommendation routes return server-generated request/list IDs. In MongoDB mode they log exactly what was served unless the usage-data header opts out; seed mode remains non-persistent.
- Behavior tests prove implementation rules, not offline recommendation quality.
- Catalog ingestion, backend-approved artwork, and the offline evaluation pipeline are implemented. The current evaluation output remains an evidence-bound non-conclusion.

## Working Rules

- Read project-root instructions before subtree instructions.
- Keep `AGENTS.md` and `CLAUDE.md` aligned.
- Keep route handlers thin, validate inputs before service calls, and preserve safe response envelopes.
- Remove seed-only `reason` fields from public product responses; recommendation reasons must be generated from actual matching logic.
- Never describe `demo-profile` output as a real customer's personalization.
- Use the recommender-evaluation protocol before computing or reporting ranking-quality metrics.
- Run `npm run db:ping` after changing Atlas credentials or connection code; a successful ping does not prove persistence behavior.
- Run `npm run db:seed` before `npm run db:seed:apply`; abort on conflicts. Use `npm run db:indexes` to verify the connected database after model or index changes.
- Keep seed and MongoDB catalog behavior equivalent, including literal search, repeated facets, deterministic sorting, pagination, soft-delete exclusion, and public numeric IDs.
- Derive ownership from `requireSession`, require the exact mutation origin, bound JSON and arrays, and preserve stable safe error codes.
- Preserve interaction and guest-merge idempotency. Cart and account lifecycle operations must remain transaction-safe, and guest rating merges must use the newest valid timestamp.
- Require complete request/list/version/mode/rank context for recommendation events. Keep request logs aligned to rendered surfaces and never trust a client-supplied authenticated owner.
- Seeded identities (admin and demo-customer) are environment-backed, have ephemeral preferences, and cannot be deleted. Registration creates customers only; the administrator role is env-only with no promotion path.
- The seed migration reconciles catalog content only; it must never rewrite the `deletedAt` tombstone, so operator soft-deletes survive re-runs.
- Run catalog imports without `--apply` first. Keep batches atomic unless partial mode is explicitly justified, preserve source ownership and existing enrichment on seed re-runs, and treat supplied public-ID disagreement as a conflict.
- Require MusicBrainz release or release-group identity before accepting artwork. External enrichment may fill missing genre/year/label but must never replace store price, stock, condition, or supplied metadata.
- Pseudonymize evaluation subjects before dataset construction and keep generated reports aggregate-only. Below the minimum evidence boundary, report completeness and counts rather than metrics.
- Run `npm test`, `npm run lint`, and `npm run build` after backend behavior changes.

## Safety

- Do not commit credentials or real private interaction data.
- Do not start payments, scraping, public admin tools, collaborative filtering, demo-order APIs, or additional identity features without explicit scope.
- Use plain text instead of emojis.
- Cleanup only verified exact paths inside this repository.
