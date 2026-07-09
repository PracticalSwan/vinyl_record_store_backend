# Deferred Backend Setup

The current backend setup is complete for the integrated read, authentication, and customer-state academic demo. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Collect enough privacy-safe positive interaction history for the implemented BFP-02 evaluator to cross its evidence threshold; optional demo-order history remains separate.
- Add password recovery or other identity features only if a later requirement explicitly accepts their privacy/security cost.
- Add admin routes, deployment configuration, and observability.
- Re-run `npm run recommender:evaluate` when the retained dataset materially changes; do not add quality claims while its status is `insufficient-evidence`.
- Genuine personalization (PERS-00 through PERS-09), scheduled after BFP-07, FFP-07, and FFP-08. See `PERSONALIZATION_IMPLEMENTATION_PLAN.md`. Do not start until the user explicitly opens personalization work; do not add collaborative filtering, matrix factorization, or any quality claim.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.

MongoDB models, repositories, explicit catalog selection, seed migration, index verification, authentication, and customer-state write APIs are implemented. Keep seed as the default catalog mode; registered accounts and durable customer state require explicit MongoDB mode.
