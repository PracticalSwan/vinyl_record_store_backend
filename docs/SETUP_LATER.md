# Deferred Backend Setup

The current backend setup is complete for the integrated read, authentication, and customer-state academic demo. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Add recommendation-request logging, the offline evaluation dataset, and optional demo-order history.
- Add password recovery or other identity features only if a later requirement explicitly accepts their privacy/security cost.
- Add admin routes, deployment configuration, and observability.
- Build a leakage-safe offline evaluation dataset and baseline comparison.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.

MongoDB models, repositories, explicit catalog selection, seed migration, index verification, authentication, and customer-state write APIs are implemented. Keep seed as the default catalog mode; registered accounts and durable customer state require explicit MongoDB mode.
