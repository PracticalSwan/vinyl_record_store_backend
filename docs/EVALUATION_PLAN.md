# Backend Evaluation

This plan separates deterministic behavior evidence from unsupported quality claims.

## Current Automated Evidence

| Check | Evidence through 2026-08-02 |
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
| Exact recommendation request logging, opt-out, ordered reasons, and attribution context | Passing Node tests plus frontend desktop/mobile analytics flows. |
| Catalog import validation, deduplication, ownership, transactions, external-client limits, and artwork provenance | Passing Node tests plus a live no-write Atlas preview. |
| Exact 116-file local artwork parity, hashes, JPEG dimensions, orphan detection, redirect security, canonical-ID route mapping, immutable headers, and browser decoding | Passing verifier, Node tests, live HTTP enumeration, and frontend Playwright coverage on 2026-07-21. |
| Dataset relevance, minimum evidence, temporal split, leakage checks, deterministic baselines, and aggregate-only output | Passing Node tests plus a live report generation. |
| Amazon source hashes/config digest, deterministic staging, active-version counts, pseudonym format, historical indexes/no-TTL, 116-record legacy preservation, and exact three-customer preservation | Passing DATA integration tests plus live `dataset:verify`, `dataset:evaluation:readiness`, and Atlas index verification. |
| ESLint | Passed. |
| Next.js production build | Passed with all catalog, recommendation, authentication, and customer-state routes. |

Run:

```bash
npm run catalog:artwork:verify
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
