# Vinyl Record Store Backend

This folder owns the backend side of the Vinyl Record Store Recommender System.

The backend is planned as a Next.js server-side application that exposes API routes, stores data in MongoDB Atlas, logs user interactions, and runs recommendation services for the separate React frontend.

## Current Status

Planning/setup stage.

This folder currently contains a Next.js starter, but product backend behavior has not been implemented. Do not treat the starter page as a finished app feature.

## Backend Responsibilities

- Product catalog API.
- Product detail API.
- Search and filter API.
- User interaction logging.
- Wishlist, cart, and order-related API behavior.
- MongoDB Atlas data access.
- Content-based recommendation service.
- Recommendation explanations.
- Recommendation evaluation support.

Frontend UI and customer-facing components belong in `../vinyl_record_store_frontend`.

## Planned Tech Stack

- Backend framework: Next.js.
- Database: MongoDB Atlas.
- Recommender: content-based MVP, with collaborative or hybrid recommendation later if enough interaction data exists.
- Frontend consumer: separate React frontend.

## Before Working Here

Read these files first:

1. `LESSONS.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. Relevant files in `docs/`

## Environment Variables

Use `.env.local` for real local values. Do not commit real secrets.

See `.env.example` for placeholders.

## Scripts

Current scripts come from the Next.js starter:

```bash
npm run dev
npm run build
npm run start
npm run lint
```

Run lint/build checks when backend implementation changes make those checks relevant.

## Documentation Index

- `docs/PROJECT_CONTEXT.md`: backend source of truth.
- `docs/BACKEND_REQUIREMENTS.md`: backend requirements.
- `docs/API_CONTRACT_PLAN.md`: planned API contracts.
- `docs/DATA_MODEL_PLAN.md`: MongoDB Atlas data model plan.
- `docs/RECOMMENDER_SYSTEM_PLAN.md`: backend recommender plan.
- `docs/ARCHITECTURE_PLAN.md`: backend architecture and boundaries.
- `docs/ROADMAP.md`: backend phase plan.
- `docs/TASK_BACKLOG.md`: backend task list.
- `docs/DECISION_LOG.md`: backend decisions.
- `docs/EVALUATION_PLAN.md`: backend evaluation plan.
- `docs/RISK_REGISTER.md`: backend risks.
- `docs/SETUP_LATER.md`: future setup notes.

## Documentation Rule

Update backend docs when backend setup, behavior, architecture, API contracts, data models, recommender logic, environment variables, packages, validation, risks, or scope change.
