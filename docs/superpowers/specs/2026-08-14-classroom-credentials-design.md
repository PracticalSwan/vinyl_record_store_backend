# Classroom Credentials Design

## Goal

Make the four classroom logins easy for the project owner and lecturer to use without weakening the application's password-storage design.

The four supported classroom accounts are:

- the single environment-backed administrator;
- `jazzlistener`;
- `rockcollector`;
- `soulseeker`.

No separate `listener` account will be created.

## Design

Create one local plaintext credential sheet at the project root named `CLASSROOM_CREDENTIALS.local.txt`. It will contain the username and plaintext classroom password for exactly the four accounts above. The file is local convenience material only and must never be committed.

Add an ignore rule covering `CLASSROOM_CREDENTIALS.local.txt` so Git does not track the credential sheet.

Keep the existing authentication implementation unchanged:

- customer and administrator passwords continue to be verified with scrypt;
- MongoDB continues to store only password hashes and salts for the three showcase customers;
- the administrator continues to resolve from `AUTH_DEMO_ADMIN_*` environment variables;
- sessions, roles, and authorization behavior remain unchanged.

Reset the administrator password to a known classroom password, generate the matching scrypt hash/salt pair, and update only the local `.env.local` administrator hash/salt values. The plaintext administrator password appears only in the ignored credential sheet.

The three showcase customers keep their existing classroom usernames and passwords. Their persisted MongoDB records remain hashed; no dataset, preferences, feedback, recommendation history, or protected public IDs are changed.

## Credential Sheet Format

The local file will be human-readable and intentionally simple:

```text
GROOVEHAUS CLASSROOM ACCOUNTS

Admin
Username: <admin username>
Password: <known classroom password>

Jazz Demo
Username: jazzlistener
Password: <existing classroom password>

Rock Demo
Username: rockcollector
Password: <existing classroom password>

Soul Demo
Username: soulseeker
Password: <existing classroom password>
```

The design document itself must never contain the chosen administrator plaintext password.

## Implementation Boundaries

This change must not:

- replace scrypt with plaintext password comparison;
- commit `.env.local` or the credential sheet;
- add a new `listener` account;
- alter customer roles or create an admin-promotion path;
- modify DATA-15 dataset lifecycle, protected showcase identities, recommendation data, or recommender configuration;
- reset or reseed the three showcase customers unless required only to verify their existing credentials.

## Verification

After implementation:

1. Confirm the credential sheet is ignored by Git and absent from tracked changes.
2. Confirm the administrator login succeeds using the plaintext credential listed in the sheet after restarting/reloading the backend environment.
3. Confirm `jazzlistener`, `rockcollector`, and `soulseeker` still authenticate with the credentials listed in the sheet.
4. Confirm the administrator still has role `admin` and each showcase account still has role `customer`.
5. Run the focused authentication tests, then the normal backend test/lint verification appropriate for this configuration-only change.
6. Confirm no protected dataset or recommender state was changed.

## Success Criteria

A lecturer can open one local file, copy any of the four username/password pairs, and log in normally. Internally, the application retains proper scrypt password verification and no plaintext credential file is committed to Git.
