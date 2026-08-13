# NEXT-02 SVD / Collaborative-Filtering Decision

Date: 2026-08-13

Decision: APPROVE one bounded `biased-matrix-factorization-v1` experiment.

Classification: `offline-academic-only`.

Final-test authorization: false. NEXT-03 must first complete validation-only selection and create a separate immutable authorization binding the selected configuration and candidate implementation.

## Evidence boundary

This gate uses the canonical aggregate NEXT-01 validation packet at `reports/recommender/historical/amazon-reviews-2023-cds-vinyl-5core-v3/next-01-final-v3/` plus a separate aggregate query over `split: train` only. No test row, test metric, or test-target support statistic was read.

The canonical validation seal is `4c30c32699d6d3d70116f86901b4470b48cf5f3f607d3dd7b02d523acf977e4b`. The frozen experiment contract is `next-03-experiment-contract.json`, canonicalized as SHA-256 of `JSON.stringify` on its parsed JSON value, with digest `3c47a2acaaa3d18283fd8a73b00ffee756f3490d7c174e9c84e464d14c62d3a1`.

## Baseline validation evidence

| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Random | 0.002261 | 0.001611 | 0.004388 | 0.998698 | 8.702116 | 0.995635 |
| Positive popularity | 0.019733 | 0.012804 | 0.042787 | 0.008243 | 5.321176 | 0.049707 |
| Content-based | 0.035004 | 0.028967 | 0.053758 | 0.670716 | 8.497302 | 0.973540 |

Content produced 98 top-10 hits versus popularity's 78, but the absolute content HitRate is 5.38% and no uncertainty/significance analysis was run. This is a distinct but uncertain collaborative hypothesis, not an expectation that the learned model must win.

## Train-only support and overlap

- 16,364 ratings across 2,387 structurally eligible subjects and all 2,305 items; density 0.2974%.
- Median support is five ratings per subject and five per item.
- Ratings are strongly positive-skewed: 89.56% are at least four; 50.02% of users have no within-user rating variance and 64.35% have only positive train ratings.
- User-user overlap: 90.45% of connected pairs share exactly one item; overlap of at least three covers only 26.94% of users.
- Item-item overlap: 91.64% of connected pairs share exactly one user; overlap of at least three covers only 29.15% of items.
- Every item has train support. A small observed-only factor model is feasible without dense zero filling or a new dependency.
- The existing bounded offline scan is adequate; no schema or index change is justified.

## Options considered

- User-based CF: rejected. Defensible minimum-overlap rules would leave most subjects without stable neighbors; Pearson is frequently undefined because half of users have no rating variance.
- Item-based CF: rejected. Its overlap structure has the same single-co-rating instability and broad unsupported-neighbor problem.
- Classical truncated SVD: rejected. Dense zero filling would misrepresent missing ratings, while sparse decomposition/centering choices and dependencies add complexity without a clearer course question.
- No learned model: remains the safe fallback if the approved experiment fails or performs poorly.
- Biased matrix factorization: approved. It fits observed 1-5 ratings only, represents missing entries as absent, scores the same full catalog/cohort, and adds a truthful learned collaborative comparison.

## Rubric

| Category | Score | Rationale |
| --- | ---: | --- |
| Data support | 1/2 | All items are supported, but density and median user/item histories are marginal. |
| Distinct value | 1/2 | Latent collaboration is a different hypothesis; improvement over content is uncertain. |
| Academic value | 2/2 | It supports a direct popularity/content/learned-method trade-off discussion. |
| Reproducibility | 2/2 | Deterministic JavaScript, fixed mechanics, no new dependency, eight configurations. |
| Runtime/dependency cost | 2/2 | Parameter storage and SGD work are bounded on the current machine. |
| Evaluation fairness | 2/2 | The same full catalog, target-positive cohort, exclusions, targets, and k are feasible. |
| Total | 10/12 | Narrow approval. |

## Frozen NEXT-03 contract

The machine-readable contract is authoritative. It freezes:

- Funk-SVD-style biased matrix factorization, truthfully named and not called classical SVD;
- global/user/item biases plus a latent dot product;
- global mean over all observed fit ratings;
- deterministic indexing, Mulberry32 factor initialization, seeded Fisher-Yates epoch order, simultaneous pre-update SGD semantics, and L2 on biases and factors;
- all observed 1-5 ratings in the fit, with missing entries absent rather than zero;
- factors 8/16, learning rate 0.005/0.01, regularization 0.02/0.05, exactly 50 epochs, no early stopping;
- unrounded NDCG@10 primary selection, then MAP, HitRate, fewer factors, higher regularization, lower learning rate, and canonical order;
- the same pinned full catalog, stage cohort, observed-item exclusions, targets, k=10, public-ID ties, and no fallback;
- a 600,000 ms wall-clock ceiling for the complete eight-configuration validation grid and 256 MiB sampled peak RSS-delta ceiling;
- aggregate-only output, no factor serialization, and no historical-to-Groovehaus identity mapping.

The validation report must record all eight attempted configurations, unrounded selection metrics, per-configuration runtime/sampled memory, training RMSE, and the bias-dominance limitation. Non-finite results or resource-bound violations fail closed.

## Authorization sequence

`next-02-decision.json` intentionally records `testAuthorized: false`. After validation chooses exactly one configuration, NEXT-03 must write a separate immutable selection authorization binding:

1. the NEXT-01 validation seal;
2. the experiment-contract digest;
3. every attempted configuration and aggregate result;
4. the winning configuration and deterministic selection-rule outcome;
5. the exact candidate version and implementation digest.

Only then may the candidate-aware runner verify all bindings before its first test-row read. It must refit the selected configuration on train plus validation, run the final test once, compare all four models on the same cohort, refuse overwrite, and never retune from test outcomes.

Historical Amazon subjects are research pseudonyms, not Groovehaus customers. This experiment will not add an API, live ranker, customer factor, feature flag, dependency, schema, index, or production-default change.
