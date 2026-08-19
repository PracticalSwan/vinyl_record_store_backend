# Deferred Backend Setup

The current backend setup is complete for the integrated academic demo and the deployed Netlify production environment. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Collect enough privacy-safe positive interaction history for the implemented BFP-02 evaluator to cross its evidence threshold; optional demo-order history remains separate.
- Add password recovery or other identity features only if a later requirement explicitly accepts their privacy/security cost.
- GitHub-linked Netlify deployment is complete. Add only broader observability, custom-domain work, or other infrastructure when a separate requirement justifies it.
- Re-run `npm run recommender:evaluate` when the retained dataset materially changes; do not add quality claims while its status is `insufficient-evidence`.
- PERS-00 through PERS-09 are complete. Keep the PERS-04 through PERS-08 ranking flags default-off unless a separate rollout is authorized; do not add collaborative filtering, matrix factorization, or any quality claim through setup work.
- Run a separately approved recommender experiment against the versioned historical dataset only after the algorithm, baselines, metrics, and leakage controls are reviewed. `dataset:evaluation:readiness` alone is not that experiment.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.

MongoDB models, repositories, active dataset selection, seed migration, index verification, authentication, and customer-state write APIs are implemented. Keep seed as the no-database default; registered accounts, the active 2,305-product dataset, and durable customer state require explicit MongoDB mode.
