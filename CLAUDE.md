# CLAUDE.md

Instructions for Claude Code or any Claude-based coding agent working in the backend folder.

## Project Summary

This folder owns the backend for the Vinyl Record Store Recommender System. Backend work covers API routes, server validation, MongoDB Atlas data access, interaction logging, recommender services, and evaluation support.

The project is academic. Backend changes should make the recommender easier to explain, test, and evaluate.

## Current Phase

The backend is in planning/setup only.

Do not implement API logic, database logic, recommender algorithms, authentication, scraping scripts, or production backend behavior unless the user explicitly asks for implementation later.

## Folder Boundary

- `vinyl_record_store_backend` owns backend code, API contracts, MongoDB Atlas access, recommender logic, validation, and backend tests.
- `vinyl_record_store_frontend` owns React UI, screens, components, and API consumption.
- Do not add frontend UI features to this backend folder unless the architecture changes.
- Do not add database credentials, database connection logic, or recommender algorithms to the frontend folder.

## Required Startup Reads

Before starting every backend session, read:

1. `LESSONS.md`
2. `AGENTS.md`
3. `CLAUDE.md`
4. Relevant files in `docs/`
5. `package.json` and lockfiles when setup, dependencies, scripts, or framework versions may be affected

## Planned Tech Stack

- Next.js for backend/server-side responsibilities.
- MongoDB Atlas for data storage.
- Separate React frontend folder as the API consumer.
- Content-based recommender MVP, with collaborative or hybrid recommendation later when enough interaction data exists.

## Latest React And Next.js Version Rule

When implementation or dependency work begins, use the latest stable React and Next.js versions that are compatible with the project.

- Verify current versions from official docs or the npm registry before installing, upgrading, or changing framework APIs.
- As of 2026-06-24, npm registry metadata showed React `19.2.7` and Next.js `16.2.9` as latest.
- Do not rely on those exact numbers later without rechecking.
- If the latest stable version cannot be used, document the reason in `docs/DECISION_LOG.md`.

## Code Quality Expectations

For future backend code:

- Keep route handlers small.
- Move business logic into service or library modules.
- Validate all request input.
- Return consistent response and error shapes.
- Keep secrets on the server.
- Keep MongoDB helpers in `src/lib/db/` or another documented backend-only boundary.
- Keep recommender logic in `src/lib/recommender/`.
- Use clear function names and small modules.
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

Before editing:

1. Resolve the actual backend root.
2. Check whether this folder or its parent is a valid git repository.
3. Read `LESSONS.md`, `AGENTS.md`, this file, `README.md`, and relevant docs.
4. Inspect only files related to the task.
5. Treat existing code and docs as the current source of truth.
6. Prefer backend-specific docs over frontend assumptions.

## Future Task Workflow

1. Identify the task type: planning, API, database, recommender, validation, testing, setup, or docs.
2. Make a short plan for multi-file work.
3. Edit only files needed for the task.
4. Validate with the smallest useful check.
5. Update affected backend documentation.
6. Check whether frontend integration docs need updates.
7. Summarize changed files, validation, assumptions, and next steps.

## Documentation Synchronization Rule

Backend documents are living files. Keep them synchronized with backend changes.

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

Update relevant docs in the same task when backend behavior, architecture, data models, APIs, validation, recommender logic, environment variables, commands, package choices, risks, or scope changes.

## No Scraping Or Copying Policy

Do not add scraping unless the user explicitly approves it later and the source permits it. Do not copy external product data into backend seed data.

## No Secrets Policy

Do not commit real secrets, MongoDB connection strings, tokens, passwords, API keys, or private keys. Use `.env.example` placeholders only.

## No Destructive Commands Policy

Do not run destructive commands such as mass deletion, `git reset --hard`, `git checkout --`, or history rewriting unless the user explicitly asks for that exact action.

Do not commit, push, publish, or sync unless the user explicitly asks.

## Handling Uncertainty

If missing information can be handled safely, make a small reversible assumption and document it. If the missing information changes risk, security, cost, project direction, or implementation shape, ask before editing.

## Work Summary After Every Task

After each backend task, summarize:

- Files changed.
- What changed.
- Validation performed or why it was skipped.
- Assumptions and TODOs.
- Recommended next task.


---

## No Emojis (global rule — never skip)

- MUST NOT use emojis anywhere: responses, explanations, code comments, commit messages, documentation, file contents, agent or skill definitions, or any other output.
- MUST use plain text instead ("MUST / SHOULD / OPTIONAL", "Priority 1 / 2 / 3", plain words).
- MUST NOT reintroduce emojis when editing files that previously contained them.
