# NEXT-03 Post-Test Addendum

This addendum corrects one field-label issue in the immutable final-test JSON. It does not change any metric value, model ordering, protocol, selection, or conclusion, and the final test was not rerun.

In `final-test/test-results.json`, the baseline models' `metricsUnrounded` objects duplicate the already six-decimal `metrics` values produced by `historical-offline-evaluation-v1`. Those baseline values are therefore six-decimal reported metrics, not full-precision IEEE-754 metrics. The biased-MF `metricsUnrounded` object does retain full-precision values.

The published comparison table intentionally uses six-decimal values for every model. The correction does not affect the conclusion: content-based leads descriptively, positive popularity is second, and biased matrix factorization is a negative offline-only result.

The common metric cohort contains 1,708 structurally eligible subjects with a relevant test target. It excludes 679 subjects without a relevant test target, so the table is a positive-target conditional estimate rather than an all-subject performance estimate. No confidence interval or significance test was run.

The one-time attempt remains consumed. `final-test-attempt-claimed.json` records `rerunPermitted: false`.
