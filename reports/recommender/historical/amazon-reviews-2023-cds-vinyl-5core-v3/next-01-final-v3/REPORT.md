# Historical Recommender Validation Benchmark

Status: evaluated

Dataset: `amazon-reviews-2023-cds-vinyl-5core-v3`

Protocol: train evidence to validation targets; k=10; relevance is rating >= 4.

Evaluated subjects: 1823.

The validation cohort is stage-specific. It is not the 1,708-subject test-readiness cohort reported by the historical readiness command.

| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 0.002261 | 0.001611 | 0.004388 | 0.998698 | 8.702116 | 0.995635 |
| popularity | 0.019733 | 0.012804 | 0.042787 | 0.008243 | 5.321176 | 0.049707 |
| content-based | 0.035004 | 0.028967 | 0.053758 | 0.670716 | 8.497302 | 0.97354 |

## Support and sparsity

Training-corpus density: 0.002974. Evaluation-cohort density: 0.00295.

Eligible-subject train ratings: median 4, mean 6.799232, range 3-89.

Positive train ratings: median 4, mean 6.217773.

Observed item support: median 5, p90 13, maximum 75.

Positive item support: median 5; 1 zero-support (0.000434) and 27 zero-or-one-support products (0.011714).

Validation targets cold to train: 0 of 1823 (0).

Candidate count: median 2301, mean 2298.200768, range 2216-2302.

Content-positive evidence was available for 1815 subjects; 8 subjects had no positive content seed and therefore received deterministic zero-score content ties.

The content baseline reuses content-demo-v1 metadata weights, deterministic public-ID ties, and its maximum-two-items-per-artist diversification cap.

## Content metadata coverage

| Field | Present | Total | Coverage |
| --- | ---: | ---: | ---: |
| artist | 2282 | 2305 | 0.990022 |
| genre | 2081 | 2305 | 0.90282 |
| year | 208 | 2305 | 0.090239 |
| label | 2217 | 2305 | 0.961822 |

## Runtime observation

Elapsed 18777 ms; RSS changed from 80027648 to 118050816 bytes; heap used changed from 21718672 to 23869232 bytes. These are process observations, not a cross-machine benchmark.

## Test status

The live historical test split remains sealed. No test metric or test-target support statistic was computed for NEXT-02.

## Interpretation boundaries

Historical Amazon subjects are research pseudonyms, not Groovehaus application customers.

This validation result does not measure the live preference, behavior, popularity, or hybrid personalization modes because those application signals are absent from the historical dataset.

Each stored validation split has at most one row per subject, so NDCG, MAP, and MRR provide closely related single-target rank evidence rather than independent multi-relevance evidence.

The absolute hit rates are low. Content produced 98 top-10 hits versus 78 for popularity, but no uncertainty interval or significance test was run; this is directional gate evidence, not a robust superiority claim.

Dataset readiness and validation metrics are evidence inputs, not a claim of production recommendation quality.
