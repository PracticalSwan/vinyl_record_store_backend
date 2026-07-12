# Backend Risk Register

| ID | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| BR-001 | Credentials leak. | High | Keep Atlas credentials in ignored `.env.local`; scripts log only safe status and error names. | controlled |
| BR-002 | Private interaction data is exposed. | High | Accept only the versioned bounded schema, reject PII/unknown fields, return counts rather than rows, apply TTL retention, and remove owned events on account deletion. | controlled |
| BR-003 | API contract drifts. | High | Update both repos and validate builds together. | controlled |
| BR-004 | Demo output is presented as real personalization. | High | Explicit demo-profile/cold-start modes. | controlled |
| BR-005 | Fixed weights produce weak relevance. | Medium | Document weights and require offline baseline evaluation before quality claims. | open |
| BR-006 | Catalog metadata is incomplete, mismatched, or biased. | Medium | Validate imports, preserve source ownership, prefer exact official album-vinyl MusicBrainz matches, visually review every bundled cover, document six explicit identity exceptions, bind artwork to a release/release group, record provenance, and retain placeholders. | controlled |
| BR-007 | One artist dominates a list. | Medium | Cap at two results per artist. | controlled |
| BR-008 | Implemented state APIs are mistaken for production commerce. | Medium | Document the local-UI migration boundary and absence of orders, payments, recovery, deployment hardening, and quality evidence. | controlled |
| BR-009 | CORS origin is misconfigured. | Medium | Configure `FRONTEND_ORIGIN` and verify live when environment permits. | open |
| BR-010 | Invalid input creates unsafe work. | High | Bound IDs, limits, pagination, prices, booleans, and user ID syntax. | controlled |
| BR-011 | Explicit MongoDB mode hides a database failure by serving seed data. | High | Never silently fall back; return `503 PERSISTENCE_UNAVAILABLE`. | controlled |
| BR-012 | Seed migration overwrites unrelated or ambiguous records. | High | Dry-run first, refuse identity/source conflicts, transact writes, and never delete records. | controlled |
| BR-013 | Next.js bundles a PostCSS version with a moderate advisory. | Medium | Track the upstream Next.js fix; do not apply npm's forced breaking downgrade. No high or critical audit findings exist. | open |
| BR-014 | A forged request mutates another account. | High | Derive ownership only from a revalidated signed session; reject client user IDs and require the exact configured origin. | controlled |
| BR-015 | Session or password material leaks. | High | Use scrypt, signed HttpOnly cookies, non-selecting password fields, generic failures, safe logs, ignored environment files, and no secret response fields. | controlled |
| BR-016 | A retry duplicates guest state or events. | High | Enforce unique event IDs and stable merge receipts/input hashes; test replay behavior and cart quantity caps. | controlled |
| BR-017 | Logged lists cannot join events or expose identity. | High | Generate request/list IDs server-side, derive authenticated ownership from the session, hide subjects, require complete event context, honor opt-out, and apply TTL. | controlled |
| BR-018 | External catalog services are unavailable or rate-limited. | Medium | Use a meaningful User-Agent, one request per second, bounded timeouts, local cache, no scraping, warnings instead of data loss, and no-write previews. | controlled |
| BR-019 | Sparse interactions produce misleading quality claims. | High | Require 20 eligible subjects with 5 final positive products each; below that threshold emit aggregate completeness and an explicit non-conclusion only. | controlled |
| BR-020 | Planned personalization is presented as real measured quality. | High | Honesty wording is frozen; PERS-00/01/02 retain `content-demo-v1` and `insufficient-evidence`, and synthetic fixtures remain labelled demonstrations. | controlled |
| BR-021 | The arbitrary-user recommendation route leaks private profile data after personalization lands. | High | PERS-01 restricts the route to explicit demo/cold-start descriptors; non-`demo-user` ids never read profile data, and cross-user denial tests gate PERS-03. | controlled |
| BR-022 | The opt-out gap is not fully closed (opt-out suppresses request logging but not interaction persistence today). | High | PERS-06 suppresses passive analytics persistence under opt-out while explicit functional actions persist as account state. | open |
| BR-023 | Stored preferences remain inert or a component dominates scoring. | Medium | PERS-04 wires preferences as hard/soft constraints with normalization; PERS-08 renormalizes weights when a component is unavailable. | open |
| BR-024 | A single negative signal suppresses an entire genre. | Medium | PERS-05 bounds negative feature evidence; one dismiss cannot exclude a genre unless explicitly chosen. | open |
| BR-025 | Narrow real preferences yield an empty storefront. | Medium | PERS-04 returns empty-with-explanation or clearly separated fallback instead of silently relaxing hard constraints. | open |
| BR-026 | Demo or seeded traffic dominates popularity scoring. | Medium | PERS-07 excludes demo-account activity and uses unique-user counting with Bayesian smoothing. | open |
| BR-027 | Hybrid weight drift or explanation/score mismatch goes unnoticed. | Medium | PERS-08 keeps weights configuration-controlled and versioned and generates explanations from normalized score contributions. | open |
| BR-028 | Personalization account-deletion cleanup is incomplete. | High | PERS-03/PERS-09 extend the existing transactional deletion to the feedback collection and any profile cache. | open |
