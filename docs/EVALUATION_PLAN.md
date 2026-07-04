# Backend Evaluation

This plan separates deterministic behavior evidence from unsupported quality claims.

## Current Automated Evidence

| Check | Evidence through 2026-07-04 |
| --- | --- |
| Literal search, repeated facets, sorting, pagination, and validation | Passing Node tests. |
| Public product shape | Passing Node test. |
| Seed/MongoDB repository contract parity and failure mapping | Passing Node tests plus live catalog parity check. |
| Model constraints and declared indexes | Passing Node tests and live Atlas index verification. |
| Conflict-safe idempotent seed migration | Passing Node tests and repeated live dry-run. |
| Same-artist ranking and explanation | Passing Node test. |
| Source/out-of-stock exclusions | Passing Node test. |
| Demo-profile exclusion and mode | Passing Node test. |
| Cold-start mode and language | Passing Node test. |
| Ideal-order NDCG sanity | Passing Node test equals 1.0. |
| Frontend CORS origin rule | Passing Node test. |
| Authentication, signed/tampered cookies, roles, registration, and the interaction cap | Passing Node tests plus browser session flows. |
| Write validation, ownership, interaction/merge idempotency, transactions, and account cleanup | Passing Node tests plus live Atlas browser flows. |
| ESLint | Passed. |
| Next.js production build | Passed with all catalog, recommendation, authentication, and customer-state routes. |

Run:

```bash
npm test
npm run lint
npm run build
```

## What These Tests Do Not Prove

Behavior tests do not show that recommendations are relevant to real users. The interaction ingestion route now exists, but the frontend analytics pipeline and sufficient timestamped evidence do not. No ranking-quality result is reported because there is no eligible held-out dataset, relevance build, train/test split, or fair baseline comparison.

## Required Offline Protocol Before Reporting Quality

1. Define relevance explicitly, such as held-out purchases or ratings of at least 4 of 5.
2. Use a temporal or leave-one-out split without leakage.
3. Compare random, popularity, and content-based models on the same candidates and value of `k`.
4. Report at least NDCG@k and MAP@k plus catalog coverage and one of novelty, diversity, or serendipity.
5. Report the evaluated user count and state whether ranking used the full catalog or sampled negatives.

Metric helpers in `src/lib/recommender/evaluate.js` support precision, recall, hit rate, MAP components, NDCG, macro averaging, and coverage. Do not publish metrics until the protocol above is satisfied.
