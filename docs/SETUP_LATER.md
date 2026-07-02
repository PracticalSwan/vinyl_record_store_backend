# Backend Setup Later

This file records backend setup work for future implementation tasks.

## Current State

The backend folder contains a Next.js starter with `package.json`, `package-lock.json`, `.gitignore`, and default app files.

No backend product API, database connection, or recommender service has been implemented by this planning task.

## Version Check Requirement

Before dependency work:

- Check official docs or npm registry for latest stable React and Next.js versions.
- Confirm compatibility with the current project.
- Update `docs/DECISION_LOG.md` if the latest stable version cannot be used.

As of 2026-06-24, npm registry metadata showed:

- React: `19.2.7`
- Next.js: `16.2.9`

Recheck before acting because these values can change.

## Future Commands

Possible future commands:

```bash
npm install mongodb
npm run lint
npm run build
```

Do not install packages or run setup-changing commands unless the user approves implementation or dependency work.

## MongoDB Atlas Setup Notes

Future setup should:

- Use `MONGODB_URI` in `.env.local`.
- Use `MONGODB_DB_NAME` in `.env.local`.
- Keep real credentials out of source control.
- Confirm network access and database permissions.
- Add clear errors for missing configuration.

## Documentation Updates Required During Setup

If backend setup changes packages, scripts, framework versions, environment variables, database configuration, or commands, update:

- `README.md`
- `AGENTS.md`
- `CLAUDE.md`
- `LESSONS.md`
- `docs/ARCHITECTURE_PLAN.md`
- `docs/DATA_MODEL_PLAN.md`
- `docs/API_CONTRACT_PLAN.md`
- `docs/DECISION_LOG.md`
- `docs/TASK_BACKLOG.md`
- `.env.example`
