# Backend Lessons

Read this file before every backend session.

## Current Position

- The backend is an implemented read-only Next.js API, not a starter or planning-only scaffold.
- The approved demo seed remains the default catalog. Explicit `CATALOG_DATA_SOURCE=mongodb` selection uses the Atlas catalog repository; never describe MongoDB as an automatic fallback.
- Strict Mongoose models, repositories, an idempotent seed migration, and index verification exist, but authentication and customer write routes do not.
- The recommender is deterministic content-based logic for product similarity, a synthetic `demo-user`, and cold-start fallback.
- Behavior tests prove implementation rules, not offline recommendation quality.

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
- The seed migration reconciles catalog content only; it must never rewrite the `deletedAt` tombstone, so operator soft-deletes survive re-runs.
- Run `npm test`, `npm run lint`, and `npm run build` after backend behavior changes.

## Safety

- Do not commit credentials or real private interaction data.
- Do not start auth, payments, scraping, admin tools, collaborative filtering, or customer write APIs without explicit scope.
- Use plain text instead of emojis.
- Cleanup only verified exact paths inside this repository.
