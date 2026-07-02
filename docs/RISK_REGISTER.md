# Backend Risk Register

| ID | Risk | Impact | Mitigation | Status |
| --- | --- | --- | --- | --- |
| BR-001 | Credentials leak. | High | No active DB credentials; keep `.env.local` ignored. | controlled |
| BR-002 | Private interaction data is exposed. | High | No real interaction store; public routes return products and safe summaries only. | controlled |
| BR-003 | API contract drifts. | High | Update both repos and validate builds together. | controlled |
| BR-004 | Demo output is presented as real personalization. | High | Explicit demo-profile/cold-start modes. | controlled |
| BR-005 | Fixed weights produce weak relevance. | Medium | Document weights and require offline baseline evaluation before quality claims. | open |
| BR-006 | Catalog metadata is incomplete or biased. | Medium | Use approved demo data and validate future imports. | open |
| BR-007 | One artist dominates a list. | Medium | Cap at two results per artist. | controlled |
| BR-008 | In-memory seed is mistaken for persistence. | Medium | Document read-only demo status and defer writes. | controlled |
| BR-009 | CORS origin is misconfigured. | Medium | Configure `FRONTEND_ORIGIN` and verify live when environment permits. | open |
| BR-010 | Invalid input creates unsafe work. | High | Bound IDs, limits, pagination, prices, booleans, and user ID syntax. | controlled |
