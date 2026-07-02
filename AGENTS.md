# AGENTS.md

Project-specific backend instructions for Codex and future coding agents.

This is a SUBTREE instruction file. Per the project hierarchy, read the **project-root** instruction files (`../CLAUDE.md` and `../AGENTS.md` at `CSX4207/Project/`) and the global files FIRST; they take precedence. This file adds backend-specific rules only and never overrides the root.

## Project Summary

This folder owns the backend for the Vinyl Record Store Recommender System. The backend is responsible for API routes, server-side validation, MongoDB Atlas access, user interaction logging, recommendation services, and backend evaluation support.

The academic focus is Decision Support and Recommender Systems. Backend work must preserve clear recommender explanations and evidence for evaluation.

## Current Phase

The backend is in planning/setup only.

Do not implement API logic, database logic, recommender algorithms, authentication, scraping scripts, or production backend behavior unless the user explicitly asks for implementation later.

## Folder Boundary

- `vinyl_record_store_backend` owns Next.js server-side behavior, API contracts, MongoDB Atlas access, recommender logic, backend validation, and backend tests.
- `vinyl_record_store_frontend` owns React UI, client-side screens, frontend components, and API consumption.
- Do not put customer-facing UI implementation in the backend folder beyond default scaffold files unless the user changes the architecture.
- Do not put database credentials, MongoDB connection logic, or recommender algorithms in the frontend folder.

## Required Startup Reads

Before starting every session in this backend folder, read:

**First, always:** the project-root instruction files (`../CLAUDE.md` and `../AGENTS.md` at `CSX4207/Project/`) plus the global files. Root is authoritative and is read before this subtree file.

Then, within this folder:

1. `LESSONS.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. Relevant files in `docs/`
5. `package.json` and lockfiles when setup, dependencies, scripts, or framework versions may be affected

## Planned Tech Stack

- Backend framework: Next.js.
- API surface: Next.js route handlers, server actions, or API routes after the implementation path is approved.
- Database: MongoDB Atlas.
- Recommender service: content-based MVP, with collaborative or hybrid methods later only when enough interaction data exists.
- Frontend consumer: separate React frontend folder.

## Latest React And Next.js Version Rule

When implementation or dependency work begins, use the latest stable React and Next.js versions that are compatible with the project.

- Verify current versions from official docs or the npm registry before installing, upgrading, or changing framework APIs.
- As of 2026-06-24, npm registry metadata showed React `19.2.7` and Next.js `16.2.9` as latest.
- Do not rely on those exact numbers later without rechecking.
- If a task cannot use the latest stable version, document the reason in `docs/DECISION_LOG.md`.

## Code Quality Expectations

For future backend code:

- Keep route handlers thin. Move business logic into service or library modules.
- Validate request input before reading or writing data.
- Return consistent response and error shapes.
- Keep secrets server-only.
- Keep MongoDB access in `src/lib/db/` or another documented backend-only boundary.
- Keep recommender scoring and explanation logic in `src/lib/recommender/`.
- Add comments only where they clarify non-obvious logic.
- Prefer small functions with clear names.
- Avoid unrelated rewrites.
- Run `npm run lint` and `npm run build` when backend implementation changes make those checks relevant.

## File Cleanup Rule

After every task, remove obsolete files, cache output, temporary files, and throwaway artifacts created during the task.

Cleanup must be exact and safe:

- Remove only files that are clearly intended for removal.
- Verify the resolved path is inside the current project folder before deleting.
- Prefer explicit file paths over broad globs.
- Do not delete source files, docs, config files, assets, or user work unless the user explicitly asks.
- Do not delete `node_modules` unless the user asks for a dependency reset.
- If unsure whether a file is safe to remove, leave it and mention it in the final summary.
- There must be no accidental deletion.

## Agent Instruction Consistency

`AGENTS.md` and `CLAUDE.md` must be similar in context and must not contradict each other. If one instruction file changes, check the other in the same task and update it when relevant.

## Repository Inspection Workflow

Before changing files:

1. Resolve the actual backend root.
2. Check whether this folder or its parent is a valid git repository.
3. Read `LESSONS.md`, `AGENTS.md`, `CLAUDE.md`, `README.md`, and relevant files in `docs/`.
4. Inspect only files related to the task.
5. Treat existing code and docs as the current source of truth.
6. Prefer backend-specific docs over frontend assumptions.

## Future Task Workflow

1. Identify the task type: planning, API, database, recommender, validation, testing, setup, or docs.
2. Make a short plan for multi-file work.
3. Modify only relevant backend files.
4. Validate when practical.
5. Update affected backend docs in the same task.
6. Check whether frontend integration docs also need updates.
7. Summarize changed files, validation, assumptions, and next steps.

## Documentation Synchronization Rule

Backend documentation is part of the work. If a task changes backend setup, architecture, API behavior, data models, recommender logic, validation, environment variables, package choices, commands, risks, or project scope, update the relevant docs before finishing.

Before finishing any backend task, check whether these files need updates:

- `README.md`
- `LESSONS.md`
- `docs/PROJECT_CONTEXT.md`
- `docs/BACKEND_REQUIREMENTS.md`
- `docs/API_CONTRACT_PLAN.md`
- `docs/DATA_MODEL_PLAN.md`
- `docs/RECOMMENDER_SYSTEM_PLAN.md`
- `docs/ARCHITECTURE_PLAN.md`
- `docs/ROADMAP.md`
- `docs/TASK_BACKLOG.md`
- `docs/DECISION_LOG.md`
- `docs/EVALUATION_PLAN.md`
- `docs/RISK_REGISTER.md`
- `.env.example`

## Documentation Update Checklist

- Backend behavior or usage changed: update `README.md`.
- Backend architecture changed: update `docs/ARCHITECTURE_PLAN.md` and `docs/DECISION_LOG.md`.
- Data model changed: update `docs/DATA_MODEL_PLAN.md`.
- API behavior changed: update `docs/API_CONTRACT_PLAN.md`.
- Recommender logic changed: update `docs/RECOMMENDER_SYSTEM_PLAN.md` and `docs/EVALUATION_PLAN.md`.
- Environment variable changed: update `.env.example` and setup docs.
- Backend risk changed: update `docs/RISK_REGISTER.md`.
- Project status changed: update `docs/ROADMAP.md` and `docs/TASK_BACKLOG.md`.

## Git Safety Rules

- Check git status before commit-oriented or publish-oriented work.
- Do not assume the parent `.git` folder is valid.
- Do not run destructive commands such as `git reset --hard`, `git checkout --`, mass deletion, or history rewriting unless the user explicitly asks.
- Do not commit, push, publish, or sync unless the user explicitly asks.
- Do not overwrite user work.

## Secrets And Privacy

- Do not commit real secrets.
- Keep `.env.example` as placeholders only.
- Keep `.env`, `.env.local`, and other local secret files ignored.
- Treat user behavior, order history, ratings, and email addresses as privacy-sensitive.

## Recommender System Rules

- Start with content-based recommendation.
- Exclude already purchased records from default recommendations.
- Prefer in-stock records.
- Generate clear explanation reasons with each recommendation.
- Add collaborative or hybrid recommendation only after there is enough interaction data.
- Keep scoring weights documented.
- Update evaluation docs when recommender logic changes.

## MongoDB Atlas Rules

- Use `MONGODB_URI` and `MONGODB_DB_NAME` placeholders only.
- Keep database access server-only.
- Plan collections before adding database code.
- Add indexes deliberately and document the reason for each index.
- Do not expose raw private interaction logs to the frontend.

## Academic Explanation Expectations

Future backend implementation summaries should explain:

- What server behavior changed.
- How it supports decision-making.
- How it relates to recommender systems.
- What data assumptions were made.
- How the behavior can be evaluated.
