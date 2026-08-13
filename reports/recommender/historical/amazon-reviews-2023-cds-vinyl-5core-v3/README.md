# Historical Evaluation Run Registry

Canonical NEXT-01 validation evidence: `next-01-final-v3/`.

| Run | Status | Use |
| --- | --- | --- |
| `next-01-final-v3` | Canonical | NEXT-02 validation evidence and validation-seal authorization source |
| `next-01-review-v2` | Superseded | Retained immutable review iteration; do not cite or authorize test |
| `next-01-baselines-v1` | Superseded | Retained immutable initial iteration; do not cite or authorize test |

The evaluator requires an explicit `--run-id` and refuses to overwrite an existing run. Test evaluation additionally requires a valid `next-02-decision.json` bound to the canonical validation seal.

NEXT-02 approved only the offline-academic `biased-matrix-factorization-v1` validation experiment. The canonical run contains the machine-readable decision and frozen contract. Its initial decision has `testAuthorized: false`; no test row may be read until NEXT-03 binds its validation winner and candidate implementation in a separate immutable authorization.
