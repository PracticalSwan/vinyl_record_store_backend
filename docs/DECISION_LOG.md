# Backend Decision Log

Use this file for backend decisions that affect architecture, setup, APIs, data models, recommender logic, validation, or workflow.

## Decision Template

```text
### BDEC-XXX: Title

Date: YYYY-MM-DD
Status: Proposed | Accepted | Changed | Replaced

Context:
What situation caused this decision?

Decision:
What was decided?

Rationale:
Why is this the preferred choice?

Impact:
What files, workflow, or future tasks does this affect?

Review Trigger:
When should this decision be revisited?
```

## Initial Decisions

### BDEC-001: Backend Owns Server-Side Next.js Responsibilities

Date: 2026-06-24
Status: Accepted

Context:
The project is split into frontend and backend folders.

Decision:
The backend folder owns Next.js API, server validation, MongoDB Atlas access, interaction logging, and recommender services.

Rationale:
This keeps backend logic separate from React UI and matches the user's requested folder split.

Impact:
Frontend docs should describe API consumption, not database or recommender implementation.

Review Trigger:
Review if the folder split changes.

### BDEC-002: Start With Content-Based Recommendation

Date: 2026-06-24
Status: Accepted

Context:
The project needs an MVP recommender before a large interaction dataset exists.

Decision:
Start with content-based recommendation.

Rationale:
Metadata similarity can work from vinyl record fields such as artist, genre, tags, release era, label, and stock.

Impact:
Backend recommender planning lives in `docs/RECOMMENDER_SYSTEM_PLAN.md`.

Review Trigger:
Review after enough interaction data exists for collaborative filtering.

### BDEC-003: Keep Backend And Frontend Instruction Files Aligned

Date: 2026-06-24
Status: Accepted

Context:
Both folders have agent instruction files.

Decision:
Each folder's `AGENTS.md` and `CLAUDE.md` must be similar in context and checked together when one changes.

Rationale:
Future agents should receive consistent instructions no matter which host reads them.

Impact:
Instruction-file edits require a paired check.

Review Trigger:
Review when workflow rules change.

### BDEC-004: Read LESSONS.md Before Every Backend Session

Date: 2026-06-24
Status: Accepted

Context:
The user requested durable lessons in frontend and backend folders.

Decision:
Future agents must read `LESSONS.md` before backend work.

Rationale:
The file records user preferences, project position, and mistakes to avoid.

Impact:
Startup workflow in `AGENTS.md` and `CLAUDE.md` includes `LESSONS.md`.

Review Trigger:
Review when lessons become stale.

### BDEC-005: Use Safe Cleanup After Every Backend Task

Date: 2026-06-24
Status: Accepted

Context:
The user requested cleanup instructions that remove obsolete files, caches, and temporary files after tasks without accidental deletion.

Decision:
Backend agents must clean only exact intended removal files after each task, verify paths are inside the backend folder, avoid broad deletion, and leave uncertain files in place.

Rationale:
This keeps generated backend output tidy while protecting source files, docs, assets, config, and user work.

Impact:
`AGENTS.md`, `CLAUDE.md`, and `LESSONS.md` include the cleanup rule.

Review Trigger:
Review if backend tooling creates new generated folders.

### BDEC-006: Keep Agentic Workflow Files Trackable

Date: 2026-06-24
Status: Accepted

Context:
The user wants a friend to receive as many project files as possible and asked not to ignore agentic workflow files.

Decision:
Backend `.gitignore` must ignore dependencies, environment files, generated output, logs, and local editor/OS files only. It must not ignore `AGENTS.md`, `CLAUDE.md`, `LESSONS.md`, docs, or planning files.

Rationale:
Future contributors need the same project guidance and planning context.

Impact:
`.gitignore` was simplified.

Review Trigger:
Review if new generated files appear.
