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
| Historical NEXT-01 validation benchmark | Canonical immutable `next-01-final-v3` packet evaluates deterministic random, positive train-popularity, and positive-seed content baselines on 1,823 validation-eligible subjects. The implementation digest, baseline versions, dataset descriptor, and deterministic validation result are sealed; the test split remains unopened. |
| Amazon source/staging/config/identity/artwork ownership, deterministic record digests, explicit v3-current/v2-rollback/v1-base semantics, stable public IDs, pseudonym format, historical indexes/no-TTL, exact accepted/local artwork coverage, legacy preservation, and exact three-customer preservation | Passing DATA integration tests plus live read-only `dataset:artwork:verify`, v3 verification while active, full v2 and v1 rollback-target verification while v3 is active, `dataset:evaluation:readiness`, and Atlas index verification on 2026-08-13. No import, activation, or rollback write was run because PERS-09 did not change lifecycle behavior. |
| Full backend behavior suite | 298 Node tests completed on 2026-08-13: 297 passed, 0 failed, and 1 intentional Windows symlink-permission skip, including historical evaluation/seal coverage, transactional lifecycle fencing, single-pass component preparation, legacy-route isolation, exact logging, all personalization modes/flags/failures, privacy, and DATA-15 regression coverage. |
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

The Amazon historical adapter is a different evidence source. Its `ready` result means 1,708 pseudonymous subjects have valid leakage-safe final-test inputs under the pinned split and `rating >= 4` relevance rule. NEXT-01 separately evaluated 1,823 validation-eligible subjects using train evidence only. Neither result combines with live logs or changes the live `insufficient-evidence` status.

## Historical NEXT-01 Validation Benchmark

The canonical packet is `reports/recommender/historical/amazon-reviews-2023-cds-vinyl-5core-v3/next-01-final-v3/`. It freezes `k=10`, relevance `rating >= 4`, seed `groovehaus-historical-v1`, the full 2,305-product universe, stage-specific shared cohorts, all observed-history exclusions, positive-only popularity/content evidence, and deterministic public-ID ties. Popularity support is computed from the full structurally eligible train corpus; novelty uses all observed train support.

Validation measured the following aggregate results:

| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Random | 0.002261 | 0.001611 | 0.004388 | 0.998698 | 8.702116 | 0.995635 |
| Positive popularity | 0.019733 | 0.012804 | 0.042787 | 0.008243 | 5.321176 | 0.049707 |
| Content-based | 0.035004 | 0.028967 | 0.053758 | 0.670716 | 8.497302 | 0.973540 |

These are single-target validation results, not production-quality claims. Content produced 98 hits versus popularity's 78, but no uncertainty or significance analysis was run and the absolute 5.38% content HitRate remains low. Eight subjects lacked a positive content seed. The final historical test split remains sealed until the validation-only decision/tuning path is complete.

Run a new immutable validation only with:

```powershell
npm.cmd run recommender:evaluate:historical -- --stage=validation --run-id=<new-run-id>
```

The runner refuses an omitted or reused run ID. Final-test access additionally requires a matching validation seal and machine-readable decision authorization. Reports are aggregate-only and historical user factors or identities must never be attached to Groovehaus accounts.

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
