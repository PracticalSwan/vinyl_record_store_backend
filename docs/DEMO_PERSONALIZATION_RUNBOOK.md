# Final Personalization Demo Runbook

## Selected Profile

The final classroom configuration is **Profile B: Selective Personalization** with the MongoDB catalog as the primary data source. It enables the session-owned recommendation endpoint, saved-preference ranking, and exact negative feedback. Behavioral ranking, aggregate popularity, and hybrid ranking stay disabled.

This is a controlled feature demonstration, not a production enablement or a claim that the live customer ranker has measured recommendation quality. Source defaults remain fail-closed.

## Decision Evidence

The read-only 2026-08-13 showcase audit found the following aggregate state:

| Protected showcase | Preferences | Ratings | Wishlist | Cart | Feedback | Usable behavior | Expected selected-profile mode |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Showcase 1 | no | no | no | no | no | no | `cold-start` / `content-demo-v1` |
| Showcase 2 | no | no | no | no | no | no | `cold-start` / `content-demo-v1` |
| Showcase 3 | no | no | no | no | no | no | `cold-start` / `content-demo-v1` |

The three protected accounts remain neutral and unchanged. Do not edit them to manufacture a personalized presentation. Register a temporary ordinary customer and save a preference during the demonstration instead.

Profile C was rejected for the final presentation because the protected accounts have no behavioral evidence. Enabling the complete stack would not reliably demonstrate a true hybrid and could blur the boundary between feature integration and measured quality. Popularity is also kept off so the selected profile has a simple, explainable mode ladder.

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
PERS_BEHAVIORAL_RANKING=false
PERS_POPULARITY=false
PERS_HYBRID=false
```

Set these values in the frontend's uncommitted `.env.local`:

```text
VITE_API_BASE_URL=http://localhost:3000
VITE_PERS_ME_ENDPOINT=true
VITE_PERS_PROFILE_DOMAIN=true
VITE_PERS_NEGATIVE_FEEDBACK=true
VITE_TRACKING_ENABLED=true
```

These are environment overrides for the classroom session. The committed defaults remain profile, preference, feedback, behavior, popularity, and hybrid off; `/me` remains the independently reversible default-on endpoint.

## Preflight

From `vinyl_record_store_backend`:

```powershell
npm.cmd run db:ping
npm.cmd run dataset:verify
npm.cmd run dataset:evaluation:readiness
npm.cmd run db:indexes
npm.cmd run db:clean:test
```

The checks must show:

- MongoDB is reachable;
- `amazon-reviews-2023-cds-vinyl-5core-v3` is active;
- 2,305 v3 products, 20,288 v3 historical ratings, 2,387 pseudonymous historical subjects, and 1,708 structurally test-ready subjects;
- v2 remains the immediate rollback release and v1 remains the identity/base release;
- no `e2e_` residue is pending;
- the three protected showcase customers remain present.

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

### Anonymous and protected-showcase checks

1. Open Home while signed out. The ranking label should be `Anonymous fallback`; popularity is intentionally disabled.
2. Sign in to any protected showcase customer. Its empty profile should truthfully show `Session-owned cold-start`, not preference, behavior, popularity, or hybrid.
3. Sign out. Home and Recommendations must return to anonymous-safe state with no stale customer list.

### Selective personalization

1. Register a new temporary ordinary customer.
2. Complete onboarding and save at least one favorite genre, such as Jazz.
3. Open Recommendations. Expect:
   - mode `preference-profile`;
   - algorithm `preference-profile-v1`;
   - visible label `Saved preferences`;
   - backend-owned item reasons such as `Matches your Jazz preference.`
4. Open Home. Expect `Saved preference profile` and the same session-owned mode.
5. Add or remove a wishlist item and rating as direct customer actions if desired. They remain functional but do not enable behavioral ranking in this profile.

### Exact feedback and Undo

1. Choose `Not interested` on one displayed recommendation.
2. Wait for the server-confirmed state `Removed from recommendations.` Focus must move to `Undo`.
3. Fetch Recommendations normally again and confirm only that exact product is excluded.
4. Select `Undo`; after the server confirms deletion, the original feedback control must be restored and focused.
5. Choose `Already own`. Expect `Marked as already owned.` with no dislike wording and focus on `Undo`.
6. Undo again. These controls express exact item ownership/interest only; they do not suppress an artist or genre.

### Privacy opt-out and administration

1. Clear `Help improve Groovehaus with pseudonymous usage data` in the footer or account preferences.
2. Confirm passive interaction delivery and recommendation-request logging stop. Direct preference, wishlist, rating, cart, feedback, and Undo actions remain available.
3. Sign in as the configured administrator only when needed for the administration smoke. `GET /api/recommendations/me` must return `403 FORBIDDEN`; administrators never receive a customer recommendation profile.

## Exact Browser Verification Command

The repository harness maps the selected profile to `E2E_ENABLE_PERS_FIRST_BATCH=1`. It creates invented temporary customers, never edits protected showcases, and invokes the approved cleanup in global teardown.

```powershell
$env:E2E_ENABLE_PERS_FIRST_BATCH='1'
$env:E2E_PERS_CATALOG_DATA_SOURCE='mongodb'
npm.cmd run test:e2e:seed -- tests/e2e/personalization.spec.js tests/e2e/recommendation-contract.spec.js
```

The run covers desktop and 375x667 Chromium plus tablet, Firefox, and WebKit smoke using the same live v3 configuration. It verifies the route/privacy contract, loaded Home and Recommendations states, exact feedback, Undo focus, serious/critical axe checks, and horizontal-overflow checks. After any write-capable run, confirm cleanup:

```powershell
npm.cmd run db:clean:test
```

## Emergency Seed Path

If Atlas is unavailable, stop both servers and explicitly set:

```text
CATALOG_DATA_SOURCE=seed
PERS_PROFILE_DOMAIN=false
PERS_PREFERENCE_RANKING=false
PERS_NEGATIVE_FEEDBACK=false
PERS_BEHAVIORAL_RANKING=false
PERS_POPULARITY=false
PERS_HYBRID=false
```

Set the frontend profile and feedback flags to `false`, then restart backend before frontend. Verify `/api/health` reports `catalogMode: "seed"` and the 116-record bundled catalog loads.

The seed path is an anonymous/catalog and restricted `demo-profile` emergency demonstration. Ordinary registration, MongoDB showcase login, persistent account state, v3 research records, and MongoDB popularity are unavailable when the database itself is unavailable. Do not present it as equivalent to the primary selective-personalization flow.

## Rollback

No code or data rollback is required. Stop both servers, set all default-off PERS flags to `false`, retain `PERS_ME_ENDPOINT=true` if the session-owned cold-start route is desired, and restart backend before frontend. To return to the fully database-independent catalog, explicitly set `CATALOG_DATA_SOURCE=seed`.

Existing preferences and feedback are retained but inert while their flags are off. Do not delete customer or dataset data as part of configuration rollback. Use only `npm.cmd run db:clean:test:apply` for documented test-residue cleanup.

## Claim Boundaries

Permitted presentation statements:

- the application implements and functionally verifies session-owned preference ranking, exact feedback, opt-out, cold-start, popularity, behavior, and hybrid components;
- this selected profile deliberately demonstrates preference ranking and exact feedback only;
- the historical benchmark evaluated deterministic random, positive historical popularity, positive-seed content, and one observed-only biased matrix-factorization candidate;
- content was strongest descriptively on the conditional historical test cohort, while biased MF was a negative offline-only result.

Do not claim that the live preference, behavior, or hybrid rankers were measured by the Amazon experiment, that content is statistically superior, that Amazon pseudonyms personalize signed-in customers, or that passing regression tests establishes production recommendation quality. DATA-15, source defaults, real orders, payments, deployment, and historical/live identity isolation remain unchanged.
