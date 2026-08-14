# Classroom Credentials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provide one local plaintext classroom credential sheet for the administrator and the three existing showcase customers while retaining scrypt authentication internally.

**Architecture:** Keep the authentication code path unchanged. Store only the administrator hash/salt in `.env.local`, keep showcase customer hashes in MongoDB, and add a project-root plaintext credential sheet that is explicitly ignored by Git. Reset only the administrator credential to a known classroom password; do not alter user roles, showcase identities, dataset state, or recommender configuration.

**Tech Stack:** Node.js, Next.js backend, MongoDB/Mongoose, Node `crypto.scrypt`, Git ignore rules.

## Global Constraints

- Exactly four classroom accounts: administrator, `jazzlistener`, `rockcollector`, `soulseeker`.
- No separate `listener` account.
- `CLASSROOM_CREDENTIALS.local.txt` must never be committed.
- Do not replace scrypt with plaintext password comparison.
- Do not commit `.env.local`.
- Administrator remains environment-backed through `AUTH_DEMO_ADMIN_*`.
- Showcase customers remain MongoDB-backed customers with their existing public IDs and roles.
- Do not mutate DATA-15 lifecycle, recommendation data, protected demo identities, or recommender configuration.

---

### Task 1: Protect and create the local credential sheet

**Files:**
- Modify: `.gitignore`
- Create local-only: `CLASSROOM_CREDENTIALS.local.txt`

**Interfaces:**
- Consumes: existing showcase usernames/passwords from `src/data/demoUsers.js`; existing administrator username from local `.env.local`.
- Produces: one local human-readable credential sheet containing exactly four username/password pairs.

- [ ] **Step 1: Add an explicit ignore rule**

Append this repository-local ignore entry in `.gitignore`:

```gitignore
CLASSROOM_CREDENTIALS.local.txt
```

- [ ] **Step 2: Verify the ignore rule before writing secrets**

Run a safe Git ignore check against `CLASSROOM_CREDENTIALS.local.txt`. Expected: Git reports the path as ignored.

- [ ] **Step 3: Create the local credential sheet**

Write exactly this structure, using the actual current admin username and a newly chosen classroom admin password of at least 10 characters:

```text
GROOVEHAUS CLASSROOM ACCOUNTS

Admin
Username: <actual-admin-username>
Password: <new-classroom-admin-password>

Jazz Demo
Username: jazzlistener
Password: jazz-groove-2026

Rock Demo
Username: rockcollector
Password: rock-groove-2026

Soul Demo
Username: soulseeker
Password: soul-groove-2026
```

- [ ] **Step 4: Verify the sheet is absent from tracked changes**

Run Git status/review tooling and confirm the credential sheet itself does not appear as an untracked or tracked change.

### Task 2: Reset only the administrator credential

**Files:**
- Local-only modify: `.env.local`
- Read-only helper: `scripts/create-password-hash.mjs`
- Read-only auth implementation: `src/lib/auth/password.js`

**Interfaces:**
- Consumes: the newly chosen plaintext administrator classroom password.
- Produces: matching `AUTH_DEMO_ADMIN_PASSWORD_HASH` and `AUTH_DEMO_ADMIN_PASSWORD_SALT` values in `.env.local`.

- [ ] **Step 1: Preserve the administrator username**

Read only the value needed for `AUTH_DEMO_ADMIN_USERNAME`; do not expose unrelated secrets from `.env.local` in logs or documentation.

- [ ] **Step 2: Generate a new scrypt credential pair**

Use the repository's `hashPassword()` implementation or `npm run auth:hash` with the chosen classroom admin password. Capture only the new password hash and salt.

- [ ] **Step 3: Update `.env.local`**

Replace only:

```text
AUTH_DEMO_ADMIN_PASSWORD_HASH=...
AUTH_DEMO_ADMIN_PASSWORD_SALT=...
```

Do not change `AUTH_SECRET`, MongoDB settings, personalization flags, or dataset configuration.

- [ ] **Step 4: Confirm `.env.local` remains ignored**

Use Git ignore/status tooling to prove `.env.local` does not become tracked.

### Task 3: Verify all four classroom logins and roles

**Files:**
- Test/read: `tests/auth.test.mjs`
- Runtime read: `src/services/auth.js`
- Runtime read: `src/data/demoUsers.js`

**Interfaces:**
- Consumes: classroom credential sheet and current MongoDB showcase accounts.
- Produces: evidence that each credential authenticates and resolves to the intended role without changing account data.

- [ ] **Step 1: Run focused authentication tests**

Run:

```powershell
node --test tests/auth.test.mjs
```

Expected: authentication tests pass.

- [ ] **Step 2: Verify administrator authentication**

Use the existing login service or HTTP login route with the admin username and new plaintext password. Expected role: `admin`.

- [ ] **Step 3: Verify the three showcase customer credentials**

Authenticate `jazzlistener`, `rockcollector`, and `soulseeker` using the passwords listed in the local sheet. Expected role for each: `customer`.

Do not modify preferences, ratings, wishlist, cart, feedback, or recommendation history during verification.

- [ ] **Step 4: Verify protected state did not change**

Run the existing read-only dataset verification appropriate to the project and confirm the protected showcase users still exist with their original public IDs.

### Task 4: Final regression and review

**Files:**
- Review: `.gitignore`
- Review: `docs/superpowers/specs/2026-08-14-classroom-credentials-design.md`
- Review: `docs/superpowers/plans/2026-08-14-classroom-credentials.md`

**Interfaces:**
- Consumes: completed Tasks 1-3.
- Produces: a verified configuration with only non-secret repository changes.

- [ ] **Step 1: Run backend tests**

Run:

```powershell
npm.cmd test
```

Expected: full backend suite passes, allowing only the already-known intentional Windows symlink-permission skip if it remains applicable.

- [ ] **Step 2: Run lint**

Run:

```powershell
npm.cmd run lint
```

Expected: exit 0.

- [ ] **Step 3: Review repository changes**

Confirm tracked changes contain no plaintext administrator password, no `.env.local`, and no credential sheet. The only intended tracked implementation change is the ignore rule plus the approved spec/plan documentation.

- [ ] **Step 4: Do not commit secrets**

If committing repository changes, stage only non-secret tracked files. Never stage `.env.local` or `CLASSROOM_CREDENTIALS.local.txt`.
