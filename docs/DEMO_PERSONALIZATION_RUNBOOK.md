# Personalization Demo Runbook

## Selected Profile

The current classroom and production configuration is **Profile C: Showcase Hybrid** against the active MongoDB/v3 catalog. It enables the session-owned endpoint, saved preferences, exact feedback, durable behavior, aggregate historical popularity, and `personalized-hybrid-v1`.

The hybrid is the existing deterministic three-component method: preference `0.45`, behavior `0.35`, and popularity `0.20`, with truthful lower-mode fallback when a required component is unavailable. These weights are documented classroom assumptions, not learned or validated-optimal parameters. Source defaults remain fail-closed.

Do not over-engineer, over-complicate, or over-test. Use the existing deterministic components and the bounded checks below. Do not add a new model merely to look advanced.

## Canonical Showcase State

`src/data/demoUsers.js` is the human-reviewable source of truth and `scripts/seed-demo-users.mjs` is the idempotent state reconciler. The persona label is fixture metadata, not an authorization role; all three identities remain `customer` accounts.

| Public ID | Persona | Completed preference | Durable direct signals | Expected Profile C mode |
| --- | --- | --- | --- | --- |
| `demo-jazz` | `jazz_listener` | Jazz; Miles Davis and John Coltrane; Vinyl | 3 Jazz ratings, 2 Jazz wishlist items | `personalized-hybrid-v1` |
| `demo-rock` | `rock_collector` | Rock; Queen and Led Zeppelin; Vinyl | 3 Rock ratings, 2 Rock wishlist items | `personalized-hybrid-v1` |
| `demo-soul` | `soul_seeker` | Soul; Al Green and Otis Redding; Vinyl | 3 Soul ratings, 2 Soul wishlist items | `personalized-hybrid-v1` |

The seed keeps carts empty and clears exact feedback so the shared starting state is predictable. Rating and wishlist products contribute to behavior affinity but are removed from the recommendation candidate set, so a known record is not recommended back to its owner.

This state demonstrates implemented behavior only. It is synthetic classroom data, not evaluation evidence and not a bridge from Amazon historical subjects to Groovehaus customers.

## Exact Environment

Set these values in the backend's uncommitted `.env.local`. Supply the already configured MongoDB URI and a strong authentication secret separately; never copy either into documentation or source control.

```text
MONGODB_DB_NAME=vinyl_record_store
CATALOG_DATA_SOURCE=mongodb
FRONTEND_ORIGIN=http://localhost:5173
PERS_ME_ENDPOINT=true
PERS_PROFILE_DOMAIN=true
PERS_PREFERENCE_RANKING=true
PERS_NEGATIVE_FEEDBACK=true
PERS_BEHAVIORAL_RANKING=true
PERS_POPULARITY=true
PERS_HYBRID=true
```

Set these values in the frontend's uncommitted `.env.local`:

```text
VITE_API_BASE_URL=http://localhost:3000
VITE_PERS_ME_ENDPOINT=true
VITE_PERS_PROFILE_DOMAIN=true
VITE_PERS_NEGATIVE_FEEDBACK=true
VITE_TRACKING_ENABLED=true
```

These are environment overrides. Committed profile, preference, feedback, behavior, popularity, and hybrid defaults remain off; `/me` remains the independently reversible default-on endpoint.

## Preflight And Seed

From `vinyl_record_store_backend`:

```powershell
npm.cmd run db:ping
npm.cmd run dataset:verify
npm.cmd run db:clean:test
npm.cmd run db:seed:users
npm.cmd run db:seed:users:apply
```

Require the following observable state:

- MongoDB is reachable and `amazon-reviews-2023-cds-vinyl-5core-v3` is active;
- v3 has 2,305 sealed products and 20,288 isolated historical ratings from 2,387 pseudonymous subjects;
- v2 remains the immediate rollback release and v1 remains the identity/base release;
- the seed dry-run targets exactly three profiles, nine ratings, six wishlist items, and no skipped identities;
- the apply result reports three profiles, nine ratings, and six wishlist items;
- the cleanup dry-run reports no `e2e_` residue before presentation.

The cleanup policy fully clears only test-only `interactions`, `recommendationLogs`, and `guestMerges`. It removes carts, wishlists, ratings, and feedback only for matched `e2e_` users, preserving showcase and ordinary-customer durable state.

Do not continue in a silently substituted seed mode. After startup, `GET http://localhost:3000/api/health` must report `catalogMode: "mongodb"` and a successful database status. A MongoDB configuration or connection failure must remain visibly unavailable rather than falling back to seed.

## Startup Order

1. Start the backend from `vinyl_record_store_backend`:

   ```powershell
   npm.cmd run dev -- --hostname 127.0.0.1
   ```

2. Verify `http://localhost:3000/api/health` reports `status: "ok"` and `catalogMode: "mongodb"`.
3. Start the frontend from `vinyl_record_store_frontend`:

   ```powershell
   npm.cmd run dev -- --host 127.0.0.1
   ```

4. Open `http://localhost:5173` in a fresh browser context.

## Presentation Flow

1. Open Home while signed out. With aggregate evidence available, expect `Popularity picks` backed by `popularity-v1`.
2. Sign in as `jazzlistener`, open Recommendations, and expect:
   - mode `personalized-hybrid`;
   - algorithm `personalized-hybrid-v1`;
   - visible label `Personalized picks`;
   - Jazz as the dominant returned genre;
   - wishlist count `2`;
   - none of the five canonical Jazz signal records returned.
3. Repeat for `rockcollector` and `soulseeker`; Rock and Soul should respectively be the dominant returned genres.
4. Check explanations. They must describe actual preference or behavior matches and must not expose component weights, private rows, subject IDs, or excluded IDs.
5. Use `Not interested`, confirm `Removed from recommendations.`, and verify focus moves to `Undo`. Undo must restore the original control and focus.
6. Use `Already own`, confirm neutral ownership wording, then undo. Exact feedback suppresses only that item.
7. Clear the pseudonymous usage-data preference. Passive interaction delivery and recommendation logging must stop; direct preference, wishlist, rating, cart, feedback, and Undo actions remain available.
8. Sign out and verify the UI returns to the anonymous popularity state without a stale customer list.

Administrators remain outside the customer-personalization domain. `GET /api/recommendations/me` must return `403 FORBIDDEN` for an administrator session.

## Bounded Browser Verification

The focused showcase flow signs into all three protected users without changing their canonical state, disables passive tracking, captures one screenshot per persona, and invokes approved cleanup in global teardown:

```powershell
$env:E2E_ENABLE_PERS_INTEGRATION='1'
$env:E2E_PERS_CATALOG_DATA_SOURCE='mongodb'
npm.cmd run test:e2e -- tests/e2e/showcase-personalization.spec.js --project=chromium-desktop
```

Use the broader existing `personalization.spec.js` and `recommendation-contract.spec.js` only when the changed boundary warrants mutation, accessibility, or full route-contract coverage. Do not run the full matrix merely for presentation rehearsal.

After any write-capable browser run, verify cleanup from the backend:

```powershell
npm.cmd run db:clean:test
```

## Performance Boundary

MongoDB recommendation-candidate reads use a scoring-field projection, coalesce concurrent reads, and keep a 60-second warm-runtime cache. Repository-owned catalog create/update/delete/restore/import operations invalidate it immediately; a dataset activation performed by CLI becomes visible after the bounded TTL or a new runtime. This improves warm requests without changing ranking or promising zero cold-start latency.

## Emergency Seed Path And Rollback

If Atlas is unavailable, stop both servers and explicitly set `CATALOG_DATA_SOURCE=seed` plus every default-off PERS flag to `false`. Set the frontend profile and feedback flags to `false`, then restart backend before frontend. Verify `/api/health` reports `catalogMode: "seed"` and the 116-record bundled catalog loads.

The seed path is an anonymous/catalog and restricted `demo-profile` emergency demonstration. Ordinary registration, MongoDB showcase login, persistent account state, v3 research records, and MongoDB popularity are unavailable. Do not present it as equivalent to Profile C.

For a ranking rollback while Atlas remains available, set the default-off PERS flags to `false`, retain `PERS_ME_ENDPOINT=true` if the session-owned cold-start route is desired, and restart. Canonical preferences, ratings, wishlist items, and feedback remain stored but inert. Do not delete customer or dataset data as part of rollback.

## Claim Boundaries

Permitted statements:

- the application implements and functionally verifies session-owned preference, behavior, aggregate-popularity, exact-feedback, and true-hybrid orchestration;
- the three protected accounts contain small role-aligned synthetic classroom profiles and durable direct signals;
- the historical benchmark evaluated deterministic random, positive historical popularity, positive-seed content, and one observed-only biased matrix-factorization candidate;
- content was strongest descriptively on the conditional historical test cohort, while biased MF was a negative offline-only result.

Do not claim that the live preference, behavior, or hybrid rankers were quality-evaluated by the Amazon experiment, that content is statistically superior, that Amazon pseudonyms personalize signed-in customers, that fixed hybrid weights are learned, or that passing behavior tests proves production recommendation quality. The historical final test is permanently consumed and must not be rerun.
