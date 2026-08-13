# Historical Recommender Final Test Benchmark

Status: final-test-complete

Dataset: `amazon-reviews-2023-cds-vinyl-5core-v3`

Protocol: refit the frozen biased-MF winner on train plus validation, then evaluate the untouched test once beside the unchanged baselines on the same cohort and full catalog.

Evaluated subjects: 1708.

| Model | NDCG@10 | MAP@10 | HitRate@10 | Coverage | Novelty | Personalization |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 0.00091 | 0.0005 | 0.002342 | 0.999566 | 8.557413 | 0.995665 |
| popularity | 0.022427 | 0.014025 | 0.050351 | 0.007809 | 5.142454 | 0.056849 |
| content-based | 0.043214 | 0.035374 | 0.068501 | 0.657701 | 8.323877 | 0.975284 |
| biased-matrix-factorization | 0.002301 | 0.001105 | 0.00644 | 0.00564 | 8.116314 | 0.014413 |

## Frozen authorization

Validation seal: `4c30c32699d6d3d70116f86901b4470b48cf5f3f607d3dd7b02d523acf977e4b`

Experiment contract: `3c47a2acaaa3d18283fd8a73b00ffee756f3490d7c174e9c84e464d14c62d3a1`

Validation selection artifact: `3f42cbb7e3749dbdd9e25c6bf88cafa2e0082ee9ce5bc56f77d9b14b040e8562`

Candidate implementation: `5cef69f14dac7981292da159d72b437e09176a027a747d3724eb82857d601c3d`

Selected configuration: factors 16, learning rate 0.005, regularization 0.02, epochs 50.

## Model behavior

Biased-MF fit ratings: 18375; unsupported subjects: 0; unsupported target items: 0; unsupported candidate items: 0; fallback count: 0.

Final-test wall clock: 9561 ms; sampled peak RSS delta: 9019392 bytes.

Historical Amazon subjects are research pseudonyms, not Groovehaus customers. This offline test does not establish quality for the live preference, behavior, popularity, or hybrid rankers.

No post-test tuning was performed. Negative or weak learned-model results remain part of the academic outcome.
