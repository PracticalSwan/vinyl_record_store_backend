# Backend Roadmap

## Phase 0: Backend Planning/Setup

Status: in progress.

Must-do tasks:

- Add backend agent instructions.
- Add backend lessons.
- Add backend planning docs.
- Add backend env template.
- Add backend source placeholders.

Should-do tasks:

- Note frontend/backend boundary.
- Record current Next.js starter state.

Optional tasks:

- Add future setup notes.

Likely docs updated:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `LESSONS.md`
- All backend docs
- `.env.example`

## Phase 1: Backend Scaffold Review

Must-do tasks:

- Confirm current Next.js scaffold is the chosen backend base.
- Verify React and Next.js versions before dependency work.
- Decide JavaScript versus TypeScript.

Should-do tasks:

- Confirm lint/build commands.
- Remove or replace default starter UI only when implementation is approved.

Optional tasks:

- Add formatting tools if approved.

Likely docs updated:

- `docs/ARCHITECTURE_PLAN.md`
- `docs/DECISION_LOG.md`
- `docs/SETUP_LATER.md`

## Phase 2: MongoDB Atlas Data Layer

Must-do tasks:

- Add backend-only MongoDB configuration.
- Add database helper boundary.
- Define collections and indexes.

Should-do tasks:

- Add validation for schema-like requirements.
- Add safe seed data only if approved.

Optional tasks:

- Add migration notes.

Likely docs updated:

- `docs/DATA_MODEL_PLAN.md`
- `.env.example`
- `docs/RISK_REGISTER.md`

## Phase 3: Product APIs

Must-do tasks:

- Product listing API.
- Product detail API.
- Search and filter API.

Should-do tasks:

- Consistent error shape.
- Tests or manual API checks.

Optional tasks:

- Admin product management API.

Likely docs updated:

- `docs/API_CONTRACT_PLAN.md`
- `docs/BACKEND_REQUIREMENTS.md`
- `docs/TASK_BACKLOG.md`

## Phase 4: Interaction APIs

Must-do tasks:

- Log views.
- Log wishlist actions.
- Log cart actions.
- Log purchases or simulated purchases.

Should-do tasks:

- Add rating or like/dislike signals.
- Add interaction context for evaluation.

Optional tasks:

- Add user preference onboarding.

Likely docs updated:

- `docs/API_CONTRACT_PLAN.md`
- `docs/DATA_MODEL_PLAN.md`
- `docs/RECOMMENDER_SYSTEM_PLAN.md`

## Phase 5: Recommender Service

Must-do tasks:

- Content-based recommender.
- Exclude already purchased records.
- Prefer in-stock records.
- Generate explanation reasons.

Should-do tasks:

- Log recommendation outputs.
- Add algorithm version labels.

Optional tasks:

- Related artist mapping.

Likely docs updated:

- `docs/RECOMMENDER_SYSTEM_PLAN.md`
- `docs/EVALUATION_PLAN.md`
- `docs/API_CONTRACT_PLAN.md`

## Phase 6: Evaluation And Hardening

Must-do tasks:

- Manual recommender scenarios.
- Backend validation checks.
- Lint/build checks.

Should-do tasks:

- Diversity checks.
- Coverage checks.
- Explanation quality checks.

Optional tasks:

- Survey data collection support.

Likely docs updated:

- `docs/EVALUATION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `docs/DECISION_LOG.md`
