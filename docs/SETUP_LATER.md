# Deferred Backend Setup

The current backend setup is complete for the read-only integrated academic demo. The following work has not started and requires a separate explicit task.

The approved design and dependency gates are documented in `FUTURE_IMPLEMENTATION_PLAN.md`. That document does not authorize implementation by itself.

## Deferred

- Use the connected Mongoose boundary to implement models and repositories; connectivity alone is complete.
- Create collections, indexes, seed migration, data-source selection, and repository-specific environment validation.
- Define authentication, authorization, user identity, privacy retention, and deletion behavior.
- Add durable interaction, wishlist, cart, order, rating, and recommendation logs.
- Add admin routes, deployment configuration, and observability.
- Build a leakage-safe offline evaluation dataset and baseline comparison.

Do not install packages or begin these changes solely because they appear here. Recheck current dependency versions and update decisions before future setup work.
