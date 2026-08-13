# Backend Documentation

These files document the implemented catalog/recommendation API, active versioned MongoDB dataset, signed authentication, and customer-state mutation boundary.

- `PROJECT_CONTEXT.md`: canonical backend status and boundaries.
- `BACKEND_REQUIREMENTS.md`: requirements and implementation status.
- `API_CONTRACT_PLAN.md`: current routes, validation, and response shapes.
- `DATA_MODEL_PLAN.md`: seed shape, implemented Mongoose models, indexes, privacy, and active/deferred write boundaries.
- `AMAZON_REVIEWS_DATA_INTEGRATION_PLAN.md`: authoritative DATA-00 through DATA-15 implementation record, provenance contract, exact counts, activation/rollback runbook, and recommender-work gate.
- `RECOMMENDER_SYSTEM_PLAN.md`: implemented content/demo, preference, behavior, popularity, and hybrid scoring, explanations, diversity, restricted showcase, session-owned fallback, and exact feedback rules.
- `ARCHITECTURE_PLAN.md`: current modules and request flow.
- `EVALUATION_PLAN.md`: automated behavior checks, implemented offline protocol, and the active evidence boundary.
- `FUTURE_IMPLEMENTATION_PLAN.md`: completed BFP-01/02/03/04/06/07/08/09 and PERS-00 through PERS-09 records plus remaining deferred work; recommender selection stays as a historical on-hold placeholder.
- `PERSONALIZATION_IMPLEMENTATION_PLAN.md`: PERS-00 through PERS-09 completed through 2026-08-13; ranking flags remain default-off and no quality claim is made.
- `ROADMAP.md` and `TASK_BACKLOG.md`: completed consolidation and deferred work.
- `DECISION_LOG.md`, `RISK_REGISTER.md`, and `SETUP_LATER.md`: durable decisions, risks, and unstarted setup.

Update the frontend contract when a shared path or response shape changes.
