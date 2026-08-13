# Historical Recommender Validation Benchmark

Status: Superseded during NEXT-01 review. Do not use this run for NEXT-02 or test authorization; use `../next-01-final-v3/`.

Status: evaluated

Dataset: `amazon-reviews-2023-cds-vinyl-5core-v3`

Protocol: train evidence to validation targets; k=10; relevance is rating >= 4.

Evaluated subjects: 1823.

| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 0.002261 | 0.001611 | 0.004388 | 0.998698 | 8.702116 | 0.995635 |
| popularity | 0.019733 | 0.012804 | 0.042787 | 0.008243 | 5.321176 | 0.049707 |
| content-based | 0.035004 | 0.028967 | 0.053758 | 0.670716 | 8.497302 | 0.97354 |

## Test status

The live historical test split remains sealed. No test metric or test-target support statistic was computed for NEXT-02.

## Interpretation boundaries

Historical Amazon subjects are research pseudonyms, not Groovehaus application customers.

This validation result does not measure the live preference, behavior, popularity, or hybrid personalization modes because those application signals are absent from the historical dataset.

Each stored validation split has at most one row per subject, so NDCG, MAP, and MRR provide closely related single-target rank evidence rather than independent multi-relevance evidence.

Dataset readiness and validation metrics are evidence inputs, not a claim of production recommendation quality.
