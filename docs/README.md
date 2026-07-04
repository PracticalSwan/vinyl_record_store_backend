# Backend Documentation

These files document the implemented catalog/recommendation API, optional MongoDB catalog persistence, signed authentication, and customer-state mutation boundary.

- `PROJECT_CONTEXT.md`: canonical backend status and boundaries.
- `BACKEND_REQUIREMENTS.md`: requirements and implementation status.
- `API_CONTRACT_PLAN.md`: current routes, validation, and response shapes.
- `DATA_MODEL_PLAN.md`: seed shape, implemented Mongoose models, indexes, privacy, and active/deferred write boundaries.
- `RECOMMENDER_SYSTEM_PLAN.md`: implemented scoring, explanations, diversity, and cold-start rules.
- `ARCHITECTURE_PLAN.md`: current modules and request flow.
- `EVALUATION_PLAN.md`: automated behavior checks and the offline metric boundary.
- `FUTURE_IMPLEMENTATION_PLAN.md`: completed BFP-01/BFP-03/BFP-04/BFP-02 Part A records plus deferred Part B evaluation-data, ingestion, and admin plans; recommender selection is on hold.
- `ROADMAP.md` and `TASK_BACKLOG.md`: completed consolidation and deferred work.
- `DECISION_LOG.md`, `RISK_REGISTER.md`, and `SETUP_LATER.md`: durable decisions, risks, and unstarted setup.

Update the frontend contract when a shared path or response shape changes.
