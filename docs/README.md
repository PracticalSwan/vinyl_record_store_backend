# Backend Documentation

These files document the implemented catalog/recommendation API, optional MongoDB catalog persistence, signed authentication, and customer-state mutation boundary.

- `PROJECT_CONTEXT.md`: canonical backend status and boundaries.
- `BACKEND_REQUIREMENTS.md`: requirements and implementation status.
- `API_CONTRACT_PLAN.md`: current routes, validation, and response shapes.
- `DATA_MODEL_PLAN.md`: seed shape, implemented Mongoose models, indexes, privacy, and active/deferred write boundaries.
- `RECOMMENDER_SYSTEM_PLAN.md`: implemented scoring, explanations, diversity, restricted showcase, session-owned cold-start, and anonymous-fallback rules.
- `ARCHITECTURE_PLAN.md`: current modules and request flow.
- `EVALUATION_PLAN.md`: automated behavior checks, implemented offline protocol, and the active evidence boundary.
- `FUTURE_IMPLEMENTATION_PLAN.md`: completed BFP-01/02/03/04/06/07/08/09 records plus remaining deferred work; recommender selection stays as a historical on-hold placeholder.
- `PERSONALIZATION_IMPLEMENTATION_PLAN.md`: PERS-00 through PERS-02 completed 2026-07-10; PERS-03 through PERS-09 remain planned, with no quality claim.
- `ROADMAP.md` and `TASK_BACKLOG.md`: completed consolidation and deferred work.
- `DECISION_LOG.md`, `RISK_REGISTER.md`, and `SETUP_LATER.md`: durable decisions, risks, and unstarted setup.

Update the frontend contract when a shared path or response shape changes.
