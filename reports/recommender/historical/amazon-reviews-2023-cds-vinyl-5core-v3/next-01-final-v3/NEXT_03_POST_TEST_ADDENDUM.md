# NEXT-03 Post-Test Addendum

This addendum corrects one field-label issue in the immutable final-test JSON. It does not change any metric value, model ordering, protocol, selection, or conclusion, and the final test was not rerun.

In `final-test/test-results.json`, the baseline models' `metricsUnrounded` objects duplicate the already six-decimal `metrics` values produced by `historical-offline-evaluation-v1`. Those baseline values are therefore six-decimal reported metrics, not full-precision IEEE-754 metrics. The biased-MF `metricsUnrounded` object does retain full-precision values.

The published comparison table intentionally uses six-decimal values for every model. The correction does not affect the conclusion: content-based leads descriptively, positive popularity is second, and biased matrix factorization is a negative offline-only result.

The common metric cohort contains 1,708 structurally eligible subjects with a relevant test target. It excludes 679 subjects without a relevant test target, so the table is a positive-target conditional estimate rather than an all-subject performance estimate. No confidence interval or significance test was run.

The one-time attempt remains consumed. `final-test-attempt-claimed.json` records `rerunPermitted: false`.

Backend commit `085f434eca6634d9644038ad84655f7d9284ede7` is the implementation landing commit and closest recorded Git snapshot for this result. Its nine Git blobs do not reproduce the artifact's exact byte digest `5cef69f14dac7981292da159d72b437e09176a027a747d3724eb82857d601c3d`, so the exact producing source bytes are not reconstructible from that commit and this is a reproducibility limitation. The pre-test authorization, permanent attempt claim, and immutable final report all agree on `5cef69f...`, and independent review before the later hardening found the then-current nine-file worktree matched that binding. Later runner hardening requires an explicit `--run-id` before database access and uses truthful precision field names for any future artifact; it does not alter this completed evidence.
