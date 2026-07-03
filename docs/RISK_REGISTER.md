# Backend Risk Register

| ID | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| BR-001 | Credentials leak. | High | Keep Atlas credentials in ignored `.env.local`; scripts log only safe status and error names. | controlled |
| BR-002 | Private interaction data is exposed. | High | Accept only the versioned bounded schema, reject PII/unknown fields, return counts rather than rows, apply TTL retention, and remove owned events on account deletion. | controlled |
| BR-003 | API contract drifts. | High | Update both repos and validate builds together. | controlled |
| BR-004 | Demo output is presented as real personalization. | High | Explicit demo-profile/cold-start modes. | controlled |
| BR-005 | Fixed weights produce weak relevance. | Medium | Document weights and require offline baseline evaluation before quality claims. | open |
| BR-006 | Catalog metadata is incomplete or biased. | Medium | Use approved demo data and validate future imports. | open |
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
