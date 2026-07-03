# Backend Task Status

Statuses are `done` or `deferred`. Deferred items are not active work.

| ID | Task | Status | Notes |
| --- | --- | --- | --- |
| B-001 | Establish backend repository and instructions. | done | Agent, lesson, license, and GitHub-facing files exist. |
| B-002 | Confirm Next.js JavaScript base. | done | Next.js 16.2.9 App Router. |
| B-003 | Implement catalog list/detail/search. | done | Validated read routes. |
| B-004 | Implement content-based recommendations. | done | Product, demo-profile, and cold-start modes. |
| B-005 | Add explanations, exclusions, diversity, and version. | done | `content-demo-v1`. |
| B-006 | Connect frontend origin with CORS. | done | `FRONTEND_ORIGIN`. |
| B-007 | Add automated validation. | done | Eleven tests, lint, and build pass. |
| B-008 | Align backend documentation. | done | Updated during 2026-07-02 consolidation. |
| B-009 | Add MongoDB persistence. | deferred | Atlas connection and ping are complete; models, collections, repositories, and seed migration remain planned in BFP-01. |
| B-010 | Add identity and write APIs. | deferred | Planned in BFP-03 and BFP-04; registration requires the MongoDB user repository, not merely a successful Atlas ping. |
| B-011 | Build the evaluation dataset and run an offline benchmark. | deferred | Planned in BFP-02; requires sufficient held-out interaction data and baselines. |
| B-012 | Add controlled catalog ingestion and metadata enrichment. | deferred | Planned in BFP-06; requires the MongoDB repository. |
| B-013 | Add protected admin catalog management. | deferred | Planned in BFP-07; requires persistence and administrator authorization. |
| B-014 | Select and implement a future recommender method. | deferred | BFP-05 is explicitly on hold pending the user's algorithm decision. |
