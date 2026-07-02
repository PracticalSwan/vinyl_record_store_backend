# Backend Lessons

Read this file before every backend session.

## Current Position

- The backend is an implemented read-only Next.js API, not a starter or planning-only scaffold.
- The current catalog is approved demo seed data; MongoDB is not connected.
- The recommender is deterministic content-based logic for product similarity, a synthetic `demo-user`, and cold-start fallback.
- Behavior tests prove implementation rules, not offline recommendation quality.

## Working Rules

- Read project-root instructions before subtree instructions.
- Keep `AGENTS.md` and `CLAUDE.md` aligned.
- Keep route handlers thin, validate inputs before service calls, and preserve safe response envelopes.
- Remove seed-only `reason` fields from public product responses; recommendation reasons must be generated from actual matching logic.
- Never describe `demo-profile` output as a real customer's personalization.
- Use the recommender-evaluation protocol before computing or reporting ranking-quality metrics.
- Run `npm test`, `npm run lint`, and `npm run build` after backend behavior changes.

## Safety

- Do not commit credentials or real private interaction data.
- Do not start MongoDB, auth, payments, scraping, admin tools, or collaborative filtering without explicit scope.
- Use plain text instead of emojis.
- Cleanup only verified exact paths inside this repository.
