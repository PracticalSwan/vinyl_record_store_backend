# Backend Evaluation

This plan separates deterministic behavior evidence from unsupported quality claims.

## Current Automated Evidence

| Check | Current evidence through 2026-08-13 |
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
| Session-owned identity, anonymous fallback, admin denial, and cross-user-safe legacy behavior | Passing Node and browser contract tests. |
| Ideal-order NDCG sanity | Passing Node test equals 1.0. |
| Frontend CORS origin rule | Passing Node test. |
| Authentication, signed/tampered cookies, roles, registration, and the interaction cap | Passing Node tests plus browser session flows. |
| Write validation, ownership, interaction/merge idempotency, transactions, and account cleanup | Passing Node tests plus live Atlas browser flows. |
| Exact recommendation request logging, opt-out, ordered reasons, attribution context, logger failure propagation, and deletion-race ownership | Passing Node transaction/service tests plus frontend desktop/mobile analytics flows and live Atlas cleanup. |
| PERS-03 profile through PERS-09 integration closure | Passing Node tests cover every independent flag dependency, pure and hybrid mode/version/reason selection, one candidate read, one exclusion pass, later feedback suppression, opt-out, failure propagation, actor/subject isolation, and privacy-safe responses. All ranking flags remain default-off and modes use deterministic fixtures. |
| Catalog import validation, deduplication, ownership, transactions, external-client limits, and artwork provenance | Passing Node tests plus a live no-write Atlas preview. |
| Exact 116-file local artwork parity, hashes, JPEG dimensions, orphan detection, redirect security, canonical-ID route mapping, immutable headers, and browser decoding | Passing verifier, Node tests, live HTTP enumeration, and frontend Playwright coverage on 2026-07-21. |
| Dataset relevance, minimum evidence, temporal split, leakage checks, deterministic baselines, and aggregate-only output | Passing Node tests plus a live report generation. |
| Amazon source/staging/config/identity/artwork ownership, deterministic record digests, explicit v3-current/v2-rollback/v1-base semantics, stable public IDs, pseudonym format, historical indexes/no-TTL, exact accepted/local artwork coverage, legacy preservation, and exact three-customer preservation | Passing DATA integration tests plus live read-only `dataset:artwork:verify`, v3 verification while active, full v2 and v1 rollback-target verification while v3 is active, `dataset:evaluation:readiness`, and Atlas index verification on 2026-08-13. No import, activation, or rollback write was run because PERS-09 did not change lifecycle behavior. |
| Full backend behavior suite | 286 Node tests completed on 2026-08-13: 285 passed, 0 failed, and 1 intentional Windows symlink-permission skip, including transactional lifecycle fencing, single-pass component preparation, legacy-route isolation, exact logging, all personalization modes/flags/failures, privacy, and DATA-15 regression coverage. |
| ESLint | Passed on 2026-08-13. |
| Next.js production build | Passed on 2026-08-13 with all catalog, recommendation, authentication, customer-state, dataset, and artwork routes. |

Run:

```bash
npm run catalog:artwork:verify
npm run dataset:artwork:verify
npm run dataset:verify
npm run dataset:evaluation:readiness
npm test
npm run lint
npm run build
```

## What These Tests Do Not Prove

Behavior tests do not show that recommendations are relevant to real users. The live Part B pipeline implements final-state relevance, temporal leave-last-positive-out splitting, full active-catalog candidates, and matched random/popularity/content-based methods, but retained live evidence still does not meet its minimum boundary and emits no ranking-quality metrics.

The Amazon historical adapter is a different evidence source. Its `ready` result means 1,708 pseudonymous subjects have valid leakage-safe inputs under the pinned split and `rating >= 4` relevance rule. It does not execute or evaluate a ranking model, does not combine with live logs, and does not change the live `insufficient-evidence` status.

## Required Offline Protocol Before Reporting Quality

1. Define relevance explicitly, such as held-out purchases or ratings of at least 4 of 5.
2. Use a temporal or leave-one-out split without leakage.
3. Compare random, popularity, and content-based models on the same candidates and value of `k`.
4. Report at least NDCG@k and MAP@k plus catalog coverage and one of novelty, diversity, or serendipity.
5. Report the evaluated user count and state whether ranking used the full catalog or sampled negatives.

`npm run recommender:evaluate` writes aggregate-only JSON and Markdown under `reports/recommender/<date>-<algorithm-version>/`. Metric helpers support precision, recall, hit rate, MRR, MAP, NDCG, coverage, novelty, and personalization. Do not publish metrics until the command reports an eligible dataset.

The offline popularity baseline is identified as `offline-popularity-train-v1` so
its train-split-only evidence cannot be confused with the production
`popularity-v1` aggregate mode.
