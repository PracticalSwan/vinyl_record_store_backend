# Deferred Backend Setup

The current backend setup is complete for the integrated read, authentication, and customer-state academic demo. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Collect enough privacy-safe positive interaction history for the implemented BFP-02 evaluator to cross its evidence threshold; optional demo-order history remains separate.
- Add password recovery or other identity features only if a later requirement explicitly accepts their privacy/security cost.
- Add deployment configuration and observability. Administrator routes are implemented.
- Re-run `npm run recommender:evaluate` when the retained dataset materially changes; do not add quality claims while its status is `insufficient-evidence`.
- Remaining personalization (PERS-06 through PERS-09). PERS-00 through PERS-05 are complete behind default-off flags. Do not enable or start later milestones without a separate explicit task; do not add collaborative filtering, matrix factorization, or any quality claim.
- Run a separately approved recommender experiment against the versioned historical dataset only after the algorithm, baselines, metrics, and leakage controls are reviewed. `dataset:evaluation:readiness` alone is not that experiment.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.

MongoDB models, repositories, active dataset selection, seed migration, index verification, authentication, and customer-state write APIs are implemented. Keep seed as the no-database default; registered accounts, the active 2,305-product dataset, and durable customer state require explicit MongoDB mode.
