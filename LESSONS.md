# Backend Lessons

Read this file before every backend session.

## Project Position

- The project is split into separate frontend and backend folders.
- `vinyl_record_store_backend` owns Next.js backend responsibilities: API routes, server validation, MongoDB Atlas access, recommender services, interaction logging, and backend evaluation support.
- `vinyl_record_store_frontend` owns React UI and API consumption.
- The backend currently has a Next.js starter. Do not treat starter pages as finished product behavior.
- The current phase remains planning/setup unless the user explicitly asks for implementation.

## User Preferences

- Be careful and verify the actual folder on disk before editing.
- Keep frontend and backend responsibilities separate.
- Keep `AGENTS.md` and `CLAUDE.md` similar in context.
- Check `LESSONS.md` at the start of every session.
- Keep docs synchronized with behavior, setup, architecture, API, data model, recommender, risk, and environment changes.
- Make small, focused changes. Avoid unrelated rewrites.
- Use beginner-friendly explanations for academic work.

## Mistakes And Corrections

- Earlier planning docs were created in the frontend folder while the project later split into frontend and backend folders. Backend-specific planning now belongs in this backend folder.
- Do not assume a folder name from memory. The active folders are `vinyl_record_store_frontend` and `vinyl_record_store_backend`.
- Do not assume git is valid. The parent `.git` folder has previously failed `git status`.
- Do not add backend secrets or database connection logic to the frontend.

## Technical Lessons

- Before dependency work, verify the latest stable React and Next.js versions from official docs or the npm registry.
- As of 2026-06-24, npm registry metadata showed React `19.2.7` and Next.js `16.2.9` as latest. Recheck later because this can change.
- Keep route handlers thin and move logic into backend service modules.
- Keep database helpers under `src/lib/db/`.
- Keep recommender scoring and explanation logic under `src/lib/recommender/`.
- Validate inputs before database writes.
- Run backend lint/build checks when implementation changes make them relevant.

## Safety Lessons

- Do not commit real credentials.
- Keep `.env.example` as placeholders only.
- Do not scrape or copy external product data unless the user approves it and the source allows it.
- Treat user interactions, orders, ratings, and emails as privacy-sensitive.
- Clean up obsolete files, caches, and temporary artifacts after tasks, but only when the exact intended removal path is verified inside the backend folder.
