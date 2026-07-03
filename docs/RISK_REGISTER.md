# Backend Risk Register

| ID | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| BR-001 | Credentials leak. | High | Keep Atlas credentials in ignored `.env.local`; scripts log only safe status and error names. | controlled |
| BR-002 | Private interaction data is exposed. | High | Models hide sensitive fields by default; no interaction write route or real interaction dataset exists. | controlled |
| BR-003 | API contract drifts. | High | Update both repos and validate builds together. | controlled |
| BR-004 | Demo output is presented as real personalization. | High | Explicit demo-profile/cold-start modes. | controlled |
| BR-005 | Fixed weights produce weak relevance. | Medium | Document weights and require offline baseline evaluation before quality claims. | open |
| BR-006 | Catalog metadata is incomplete or biased. | Medium | Use approved demo data and validate future imports. | open |
| BR-007 | One artist dominates a list. | Medium | Cap at two results per artist. | controlled |
| BR-008 | Seed or model foundations are mistaken for persistent commerce. | Medium | Document explicit catalog modes and the absence of auth/customer write APIs. | controlled |
| BR-009 | CORS origin is misconfigured. | Medium | Configure `FRONTEND_ORIGIN` and verify live when environment permits. | open |
| BR-010 | Invalid input creates unsafe work. | High | Bound IDs, limits, pagination, prices, booleans, and user ID syntax. | controlled |
| BR-011 | Explicit MongoDB mode hides a database failure by serving seed data. | High | Never silently fall back; return `503 PERSISTENCE_UNAVAILABLE`. | controlled |
| BR-012 | Seed migration overwrites unrelated or ambiguous records. | High | Dry-run first, refuse identity/source conflicts, transact writes, and never delete records. | controlled |
| BR-013 | Next.js bundles a PostCSS version with a moderate advisory. | Medium | Track the upstream Next.js fix; do not apply npm's forced breaking downgrade. No high or critical audit findings exist. | open |
