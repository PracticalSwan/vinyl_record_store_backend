# Backend Risk Register

| ID | Risk | Impact | Likelihood | Mitigation | Status |
| --- | --- | --- | --- | --- | --- |
| BR-001 | MongoDB credentials leak. | High | Medium | Keep real credentials in `.env.local`; never commit them. | open |
| BR-002 | Backend exposes private interaction data. | High | Medium | Filter responses and avoid raw logs in public APIs. | open |
| BR-003 | API contracts drift from frontend expectations. | Medium | High | Update backend and frontend docs together when contracts change. | open |
| BR-004 | Sparse interaction data weakens recommendations. | Medium | High | Start content-based and add collaborative methods later. | open |
| BR-005 | Bad metadata weakens scoring. | Medium | Medium | Validate product data and document required fields. | open |
| BR-006 | Recommendation bias toward one artist or genre. | Medium | Medium | Add diversity checks and log outputs for review. | open |
| BR-007 | Scope creep into auth, payments, scraping, or admin tools. | High | Medium | Keep MVP focused and defer broad features unless approved. | open |
| BR-008 | Framework version drift. | Medium | Medium | Verify latest React and Next.js versions before dependency work. | open |
| BR-009 | Inconsistent agent instructions. | Medium | Medium | Keep `AGENTS.md` and `CLAUDE.md` similar in context. | open |
| BR-010 | Missing validation causes bad writes. | High | Medium | Add validation before database operations. | open |
| BR-011 | Accidental deletion during cleanup. | High | Low | Remove only exact intended files after path verification inside the backend folder. | open |
