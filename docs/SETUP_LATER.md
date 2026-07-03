# Deferred Backend Setup

The current backend setup is complete for the read-only integrated academic demo. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Define authentication, authorization, user identity, privacy retention, and deletion behavior.
- Add durable interaction, wishlist, cart, order, rating, and recommendation logs.
- Add admin routes, deployment configuration, and observability.
- Build a leakage-safe offline evaluation dataset and baseline comparison.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.

MongoDB models, repositories, explicit catalog selection, seed migration, and index verification are implemented. Keep using seed mode by default; selecting MongoDB does not authorize any deferred write API.
