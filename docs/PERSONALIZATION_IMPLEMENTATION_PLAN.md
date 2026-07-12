# Personalization Implementation Plan (Backend)

This roadmap converts the existing deterministic demo recommender into a genuine personalized recommender system for the Vinyl Record Store (CSX4207). PERS-00 through PERS-02 were implemented and verified on 2026-07-10. PERS-03 through PERS-09 remain planning-only and authorize no implementation by themselves.

This plan is scheduled AFTER the entire existing documented roadmap: BFP-07 (admin backend), FFP-07 (admin frontend), FFP-08 (simulated checkout), and any backend support already planned for the simulated checkout. It does not reorder, replace, remove, or silently redefine any existing BFP/FFP plan. BFP-05 (recommender algorithm selection) remains its own on-hold placeholder; PERS-00 records the method decision that resolves BFP-05's open question without reusing the BFP-05 ID.

Audience: the developers implementing the Next.js backend and the frontend developers consuming its contracts.

Source of truth for current state: live backend source, `PROJECT_CONTEXT.md`, `API_CONTRACT_PLAN.md`, `DATA_MODEL_PLAN.md`, `RECOMMENDER_SYSTEM_PLAN.md`, `EVALUATION_PLAN.md`, and the matching frontend personalization plan. Re-verify every file path, constant, and enum against the source before implementing any milestone.

## Hard Scope Boundaries

Included in this plan:

- Proper identity enforcement for recommendation routes.
- A real session-owned signed-in-user recommendation endpoint.
- A unified backend-owned profile and feedback domain.
- Preference-aware ranking, negative feedback, behavioral signals, a popularity baseline, and a hybrid orchestration.
- Cross-repository integration, migration, regression protection, and documentation closure.

Explicitly excluded from this plan and from every milestone:

- Gathering real users or additional real-world evaluation data.
- User studies.
- Any claim of measured recommendation quality.
- Completing the current evidence threshold (20 eligible subjects with 5 final positive products each).
- Publishing Precision@k, Recall@k, MAP@k, NDCG@k, or any other quality result without leakage-safe held-out evidence.
- Collaborative filtering and matrix factorization. The project is not collecting sufficient real-user evidence. They are not added to make the project appear more advanced.

The project may use deterministic synthetic fixtures and clearly labelled classroom demo profiles for development and testing. Synthetic data must never be presented as real evaluation evidence.

The existing offline evaluator, interaction logging, recommendation logging, algorithm versioning, and privacy boundaries are preserved so evaluation can be performed later. "Evaluation with sufficient evidence" is not part of this roadmap.

## Current State (Re-Verified Against Source On 2026-07-10)

These facts were verified by reading the source, not by trusting doc status tables. Implementation agents must re-verify before editing.

- The legacy route `GET /api/recommendations/user/[userId]` validates the URL but immediately maps it to an explicit demo or generic cold-start descriptor. Only `demo-user` selects the synthetic profile; every other ID produces identical cold-start ranking and cannot read private state. `PERS_IDENTITY_STRICT` defaults on, rejects administrators, and keeps any resolved customer session limited to logging ownership.
- `GET /api/recommendations/me` is implemented behind the default-on `PERS_ME_ENDPOINT` rollback flag. It derives a verified customer descriptor from the signed session, rejects administrators, and otherwise serves `anonymous-fallback`; the response never exposes a customer ID.
- The product-similarity route is `GET /api/recommendations/product/[id]` (`src/app/api/recommendations/product/[id]/route.js:6`). It does not read the session at all.
- The literal `"demo-user"` is isolated to `legacyRecommendationSubject`; `recommendForUser` accepts only validated subject descriptors. Verified customers still use cold-start item ranking, so PERS-02 changes identity ownership and mode labelling without activating preference or behavioral personalization.
- The content-based weights are `sameArtist 6, sameGenre 4, sameDecade 2, sameLabel 1, preferredGenre 2` with stock boosts `in 1, low 0.5, out excluded` (`src/lib/recommender/contentBased.js:6-14`). The artist cap is 2 (`diversify`, `contentBased.js:49-62`).
- The algorithm version label is `content-demo-v1` from `RECOMMENDER_ALGORITHM_VERSION` (`contentBased.js:4`).
- The hard-coded demo profile is `purchasedIds [1], wishlistIds [2,3,4], favoriteGenres [Jazz, Soul, Electronic, Folk]` (`contentBased.js:16-20`).
- The User preferences schema has `favoriteGenres, dislikedGenres, favoriteArtists, budget.{min,max}, conditions, formats, completedAt, schemaVersion` (`src/models/User.js:10-33`). These fields are validated and persisted but the ranker never reads them. There are zero references to `user.preferences` anywhere in `src/lib/recommender/` or `src/services/recommendations.js`.
- The interaction type enum has 16 values (`src/models/constants.js:17-34`): `recommendation_impression, recommendation_click, recommendation_wishlist_add, recommendation_cart_add, recommendation_dismiss, product_view, wishlist_add, wishlist_remove, cart_add, cart_remove, cart_quantity, rating_set, rating_remove, search_submit, search_result_click, demo_checkout_complete`. `recommendation_dismiss` exists but is write-only telemetry; no code reads it back.
- The recommendation log schema is `requestId, listId, subjectType, subjectId (select:false), mode, algorithmVersion, sourceProductId, excludedProductIds, surface, items[{productPublicId, score, rank, reasons}], servedAt, expiresAt` with a 90-day TTL (`src/models/RecommendationLog.js:15-47`).
- Ownership for all write routes comes from `requireSession(request)`, never from a body or URL value (`src/lib/auth/requireSession.js`). `resolveSessionSubject` rejects missing, inactive, and role-mismatched subjects (`src/services/auth.js:103-114`).
- The exact-origin check is `assertMutationOrigin` reading `FRONTEND_ORIGIN` (`src/lib/request.js:9-15`). The interaction cap is 120 events/minute/identity (`src/lib/interactionCap.js`).
- The tracking opt-out header `x-tracking-enabled: false` suppresses recommendation logging only (`src/services/recommendations.js:24-25`). It does not suppress interaction persistence. This is an open gap that PERS-06 closes.
- Data source selection never silently falls back from explicit MongoDB to seed (`src/lib/db/dataSource.js:8-22`).
- The offline evaluator requires 20 subjects with 5 positives, currently reports `insufficient-evidence`, uses random/popularity/content-based baselines with leave-one-out, and is decoupled from the live ranker except for the pure function `rankCatalogFromHistory` (`src/lib/recommender/offlineEvaluation.js`, `evaluationDataset.js`, `scripts/evaluate-recommender.mjs`).
- Account deletion removes user, wishlist, cart, ratings, interactions, recommendation logs (`subjectType:"user"`), and guest-merges in one transaction (`src/repositories/accountRepository.js:24-42`).

## Dependency-Safe Milestone Order And ID Mapping

Each PERS milestone maps to the next unused backend and/or frontend plan IDs. The order is fixed; it is changed only if a source audit during PERS-00 proves a different order is required, and any change must be explicitly justified in PERS-00.

| Milestone | Title | Backend subplan | Frontend subplan |
| --- | --- | --- | --- |
| PERS-00 | Audit and decision freeze | (decisions BDEC-016, risks BR-020/BR-021) | (decision FDEC-011, risks FR-013/FR-014) |
| PERS-01 | Proper identity enforcement | BFP-08 | (contract tests only) |
| PERS-02 | Session-owned signed-in-user endpoint | BFP-09 | FFP-09 |
| PERS-03 | Unified recommendation profile and feedback domain | BFP-10 | (consumed via API) |
| PERS-04 | Preference-aware ranking | BFP-11 | FFP-10 |
| PERS-05 | Negative-feedback capture and durable suppression | BFP-12 | FFP-11 |
| PERS-06 | Behavioral-signal personalization | BFP-13 | FFP-12 |
| PERS-07 | Popularity baseline and fallback | BFP-14 | (consumed via API) |
| PERS-08 | Hybrid recommendation orchestration | BFP-15 | FFP-13 |
| PERS-09 | Cross-repository integration, migration, regression protection, documentation closure | BFP-16 | FFP-14 |

Backend uses BFP-08 through BFP-16. Frontend uses FFP-09 through FFP-14. No existing BFP, FFP, task, decision, or risk ID is reused. The next-unused task IDs are B-016 (backend) and F-016 (frontend); decision IDs BDEC-016 / FDEC-011; risk IDs BR-020 / FR-013. Each milestone may also register additional sequential IDs as needed.

## Milestone Template

Every milestone below contains the 22 required sections: ID and title, Status, Goal, Why required, Current gap, Dependencies, Non-goals, Backend changes, Frontend changes, API contract, Data-model changes, Algorithm/business rules, Privacy/security rules, Edge cases, Failure/recovery, Migration strategy, Tests, Documentation updates, Definition of done, Rollback criteria, Risks, Decisions still requiring approval.

---

## PERS-00: Audit And Decision Freeze

### ID And Title

PERS-00 — Repository audit and architecture decision freeze (cross-cutting). Registers backend decision BDEC-016 and frontend decision FDEC-011, and risks BR-020, BR-021, FR-013, FR-014. Resolves the open question held in BFP-05 without reusing the BFP-05 ID.

### Status

Completed 2026-07-10. BFP-07, FFP-07, and FFP-08 were already complete, and the user explicitly opened PERS-00 through PERS-02.

### Goal

Freeze every architecture decision the later milestones depend on, and record the exact current behavior that must not regress, before any personalization code is written.

### Why It Is Required

PERS-01 through PERS-09 share identity, data, and contract foundations. If those foundations are not decided up front, later milestones will rediscover dependencies mid-implementation and produce contradictory contracts. BFP-05 is on hold precisely because the method was undecided; PERS-00 records that decision under new IDs.

### Current Implementation Gap

Closed for the architecture layer. BDEC-016 and FDEC-011 now freeze the endpoint, identity, privacy, version/mode, normalization, fallback, and honesty decisions. Preference use, feedback, and the passive-analytics opt-out gap remain for their later milestones.

### Dependencies

- FFP-08 (simulated checkout) complete, including any backend order support it bundles.
- BFP-05's open method decision resolved here (recorded, not implemented).
- MongoDB mode available for development (showcase demo accounts and registered users require it).

### Non-goals

- Implementing any code, schema, route, model, index, migration, or test.
- Reopening the offline evaluator or changing its evidence threshold.
- Selecting collaborative filtering or matrix factorization (explicitly excluded throughout).

### Backend Changes

None. PERS-00 produces decisions and this plan only.

### Frontend Changes

None.

### API Contract

No contract change in PERS-00. The decisions below define the contracts that PERS-01 onward implements.

### Data-Model Changes

None in PERS-00. Decisions define the durable-vs-TTL split that PERS-03 implements.

### Algorithm Or Business Rules

Decisions to freeze (recorded in BDEC-016 and FDEC-011):

- Canonical signed-in endpoint: `GET /api/recommendations/me`, session-owned.
- The old `GET /api/recommendations/user/:userId` route is restricted, not removed. `demo-user` keeps `demo-profile` for the showcase. Every other `userId` returns `cold-start` and must never read private profile data. The route must not become a private-profile endpoint.
- Anonymous `GET /api/recommendations/me` (no session) returns the anonymous fallback ladder, never a profile.
- Product similarity `GET /api/recommendations/product/:id` stays public and product-based and must not read user state.
- Durable account state: preferences, ratings, wishlist, cart, and explicit feedback (`not-interested`, `already-own`, optional `show-fewer-like-this`).
- TTL-limited analytics (90-day, existing): impressions, views, clicks, searches.
- Explicit functional actions (ratings, wishlist, cart, not-interested, already-own) are account state AND interaction evidence. Passive analytics (impressions, views, clicks, searches) are TTL-only and honor the tracking opt-out.
- Tracking opt-out suppresses passive analytics entirely, including persistence. Explicit functional actions remain account state regardless of opt-out because they are user-initiated features, not tracking. This closes the current gap where opt-out suppresses rec-logging but not interaction persistence.
- Demo and showcase accounts receive deterministic seeded preference profiles (added to `src/data/demoUsers.js`), clearly labelled as demonstrations, never real personalization.
- The recommendation profile is recomputed on demand per request. No permanently stored derived profile unless PERS-03 proves recomputation is insufficient and defines invalidation rules.
- Component scores are normalized to `[0,1]` per request via min-max within the candidate set. When a component is unavailable, weights are renormalized over the available components rather than treating the missing component as zero, unless a milestone justifies zero explicitly.
- Algorithm version names: keep `content-demo-v1` for regression; add `preference-profile-v1`, `behavior-profile-v1`, `popularity-v1`, `personalized-hybrid-v1`. Cold-start stays a mode, not a version.
- Algorithm modes: `demo-profile`, `cold-start`, `preference-profile`, `behavior-profile`, `popularity`, `personalized-hybrid`, `content-similarity` (product), `anonymous-fallback`.
- Candidate filtering excludes soft-deleted, out-of-stock (unless availability preference says otherwise), suppressed, and already-owned exact items per the milestone rules.
- Explanations remain truthful and are generated from actual score contributions and filters.
- Account deletion removes all personalization state (it already removes interactions and rec logs; PERS-03/PERS-05 add the feedback collection and any profile cache).

### Privacy And Security Rules

- No client-supplied identity is trusted for any personalization data.
- Private raw interaction rows never appear in a public response.
- The opt-out boundary between passive analytics and explicit functional actions is fixed here and enforced in PERS-06.

### Edge Cases

PERS-00 records the "existing behavior that must not regress" checklist used by every later milestone's tests:

- `demo-user` still returns `demo-profile` with the existing synthetic profile summary.
- Non-`demo-user` IDs still return `cold-start` (until PERS-02 adds the session-owned path).
- Product similarity output is unchanged for the same source product.
- Recommendation logging still records exact served lists in MongoDB mode and is still suppressed in seed mode and on opt-out.
- Interaction ingestion remains idempotent by `eventId` and bounded by the per-identity cap.
- Account deletion remains transactional and removes the same owned state plus the new feedback collection.
- The evaluator still reports `insufficient-evidence` and its baselines still run unchanged.
- Algorithm version `content-demo-v1` remains reproducible for regression comparison.

### Failure And Recovery Behavior

PERS-00 defines no new failure paths. It records that every later milestone must preserve safe failure: missing session, expired session, tampered cookie, disabled account, deleted account, database unavailable, and seed mode all fail safe and never leak private data.

### Migration Strategy

No migration in PERS-00. The release pattern all later milestones follow is defined in the "Migration And Rollout" appendix.

### Tests

No tests in PERS-00. The regression checklist above becomes the baseline assertions for PERS-01 onward.

### Documentation Updates

- Create this plan.
- Record BDEC-016 and FDEC-011 (decisions).
- Record BR-020, BR-021, FR-013, FR-014 (risks).
- Add PERS placeholder rows to both `FUTURE_IMPLEMENTATION_PLAN.md` status tables, both `ROADMAP.md` files, both `TASK_BACKLOG.md` files, and `implementation_plan_order.txt`.
- Leave BFP-05 as on-hold with a note that its open decision is resolved by PERS-00 under new IDs.

### Definition Of Done

- This plan exists in both repositories with the same milestone order.
- All frozen decisions are recorded in the decision logs.
- All personalization risks are recorded in the risk registers.
- The existing roadmap is unchanged; personalization is appended after FFP-08.
- No source code changed.

### Rollback Criteria

PERS-00 is documentation only. Rollback is deleting the added plan and decision/risk entries; no code is affected.

### Risks

- BR-020 / FR-013: Personalization is presented as real measured quality. Mitigation: honesty wording locked in PERS-00, enforced in every milestone's tests and docs.
- BR-021 / FR-014: The old arbitrary-user route becomes a private-profile leak. Mitigation: PERS-01 restricts it and proves with contract tests.

### Decisions Still Requiring Approval

None for PERS-00. The implementation request confirms that personalization opens after FFP-08, keeps `/api/recommendations/me`, and freezes the explicit-functional-action versus passive-tracking opt-out split. Later milestone-specific decisions remain listed under those milestones.

---

## PERS-01: Proper Identity Enforcement (BFP-08)

### ID And Title

PERS-01 / BFP-08 — Proper identity enforcement for recommendation routes.

### Status

Completed and verified 2026-07-10. No ranking weights, candidate rules, or quality claims changed.

### Goal

Ensure the recommendation subject is derived only from the verified signed session, that no client-supplied identity is trusted, and that the existing arbitrary-user route cannot leak private profile data.

### Why It Is Required

Before PERS-01 the URL `userId` was the identity contract and the session affected logging only. The completed restriction prevents that legacy route from becoming a private-profile exposure when PERS-03 arrives.

### Current Implementation Gap

- Closed. The legacy URL maps only to demo or generic cold-start descriptors, verified customer identity comes from `recommendationSubject.js`, and contract tests prove arbitrary IDs cannot select distinct/private results.

### Dependencies

- PERS-00 decisions frozen.
- Existing `requireSession`, `getOptionalSession`, `resolveSessionSubject`, and `assertMutationOrigin` helpers unchanged.

### Non-goals

- Changing ranking, scoring, or explanations.
- Adding the `/api/recommendations/me` endpoint (that is PERS-02).
- Removing the old route (restricted, not removed).

### Backend Changes

- Implemented `src/lib/auth/recommendationSubject.js` with optional and required verified-customer derivation plus legacy demo/cold-start mapping.
- Restricted `src/app/api/recommendations/user/[userId]/route.js`; the URL never selects a registered profile, administrator access is rejected under the default-on strict flag, and anonymous IDs are ignored when a customer session resolves.
- Refactored `recommendForUser` to reject legacy string subjects before catalog access.
- Added `tests/recommendation-identity.test.mjs`, including cross-user parity, admin/invalid/inactive-session cases, feature rollback, and a product-route no-user-state source guard.

### Frontend Changes

None in PERS-01. The frontend still calls the old route with `demo-user` until PERS-02/FFP-09 switches it.

### API Contract

No public contract change yet. The old route's documented behavior (`demo-user` → `demo-profile`, others → `cold-start`) is unchanged and now enforced as a hard rule: non-`demo-user` ids never return private data.

### Data-Model Changes

None.

### Algorithm Or Business Rules

None. Ranking is untouched.

### Privacy And Security Rules

- The recommendation subject is always the verified session subject or anonymous. No `userId`, role, ownership field, or profile identifier from the client is trusted.
- Protected recommendation paths revalidate the active account on every request (already true via `resolveSessionSubject`; PERS-01 extends the pattern to recommendations).
- Anonymous ids cannot become registered-user ids.
- Administrator sessions receive the documented behavior: admins are not personalized as customers; the personalization endpoints either reject admin sessions or return the anonymous fallback (decision in PERS-00, default: reject with `403 FORBIDDEN` because admin is not a customer profile).

### Edge Cases

- Missing session on the old route: return `cold-start` (or `demo-profile` for `demo-user`). Never error for anonymity.
- Expired or tampered cookie: treated as anonymous by `getOptionalSession`.
- Disabled account: `resolveSessionSubject` returns null; treated as anonymous on optional-session routes, rejected on required-session routes.
- Deleted account mid-request: session resolution fails closed.
- Admin session hitting a customer-personalization path: rejected.
- MongoDB showcase accounts (`demo-jazz/rock/soul`) and ordinary registered accounts return `cold-start` on the old route (they are not `demo-user`). On the PERS-02 endpoint they receive their own session-owned profile. BDEC-018 removed the former environment-backed `demo-customer`; the only environment identity is the administrator, which customer-personalization routes reject.
- Concurrent sign-in and recommendation request: the verified subject on each request is independent; no cross-identity leakage.
- Sign-out during an in-flight request: the in-flight request resolves against the subject captured at request start; the next request is anonymous.
- Multiple tabs: each request is independently authorized.
- Stale frontend responses after identity change: PERS-02/FFP-09 handles abort and resource-key invalidation; PERS-01 ensures the backend never serves a stale subject.

### Failure And Recovery Behavior

- Database unavailable on the old route: seed-mode candidates still serve `cold-start`; MongoDB mode returns `PERSISTENCE_UNAVAILABLE` per the existing no-silent-fallback rule.
- Seed catalog mode: identity enforcement is unchanged.

### Migration Strategy

- Behind `PERS_IDENTITY_STRICT`, enabled by default after the identity suite passed. Explicit `false` restores the prior optional-session logging behavior without making the ranker accept arbitrary subjects.
- No data migration.

### Tests

- `tests/recommendation-identity.test.mjs` passes for verified customer derivation, missing/tampered/inactive sessions, administrator rejection, two-ID cold-start parity, legacy-string rejection before catalog access, product-route isolation, and rollback flags.
- Browser integration additionally proves a signed-in customer cannot use the legacy URL to select a distinct list.

### Documentation Updates

- `API_CONTRACT_PLAN.md`: document the restricted behavior of the old route.
- `RECOMMENDER_SYSTEM_PLAN.md`: note identity source is the verified session for personalization.
- `RISK_REGISTER.md`: BR-021 (old route leak) moves toward controlled.

### Definition Of Done

- Achieved: the old route never reads private profile data for non-`demo-user` ids; cross-user and product-route guards pass; existing ranking behavior remains reproducible.

### Rollback Criteria

Disable `PERS_IDENTITY_STRICT`. The route reverts to current behavior. No data to roll back.

### Risks

- BR-021: incomplete restriction leaks profile data once PERS-03 lands. Mitigation: the PERS-01 contract test is the gate PERS-03 must pass.

### Decisions Still Requiring Approval

None. Customer-personalization endpoints reject verified administrator sessions with `403 FORBIDDEN`.

---

## PERS-02: Session-Owned Signed-In-User Endpoint (BFP-09 / FFP-09)

### ID And Title

PERS-02 / BFP-09 (backend) + FFP-09 (frontend) — Canonical session-owned recommendation endpoint `GET /api/recommendations/me`.

### Status

Completed and verified 2026-07-10 after PERS-01.

### Goal

Provide one canonical endpoint whose subject is always the verified signed-in user, with a separate anonymous fallback, while preserving current demo behavior until the switch is stable.

### Why It Is Required

The old route cannot safely carry private data (PERS-01). Personalization needs a route whose subject is structurally guaranteed to be the session owner.

### Current Implementation Gap

- Closed. `/api/recommendations/me` exists, the production client has no arbitrary-user parameter, `CatalogProvider` is below `AuthProvider`, and recommendation loading is gated until auth restoration resolves.

### Dependencies

- PERS-01 identity helper.
- Existing recommendation service and logging.

### Non-goals

- Changing ranking. PERS-02 preserves the existing generic cold-start item ordering for customers and anonymous fallback; ranking changes begin in PERS-04.
- Deprecating the old route entirely (it stays restricted).

### Backend Changes

- Implemented `src/app/api/recommendations/me/route.js` with optional-session customer derivation, administrator denial, limit 12/cap 20, controlled surfaces, anonymous-only ID handling, safe errors, and the default-on `PERS_ME_ENDPOINT` rollback flag.
- Refactored recommender/service calls to explicit subject and actor descriptors. Registered and anonymous lists retain identical `content-demo-v1` item ranking while modes differ honestly.
- Logging uses the verified public ID for a customer and a bounded anonymous ID only when no customer resolves; neither subject is returned.

### Frontend Changes (FFP-09)

- Implemented provider reorder plus `auth.status !== "loading"` gating, fixed-subject `fetchMyRecommendations`, anonymous-only headers, subject-aware resource keys, abort on identity change, and generation guards that discard transports which ignore abort.
- The fixed `fetchShowcaseRecommendations` rollback helper cannot accept a user ID and always calls `demo-user`.

### API Contract

New endpoint:

- `GET /api/recommendations/me`
- Authentication: optional. Authenticated → the user's recommendations. Anonymous → the anonymous fallback.
- Query: `limit` (default 12, cap 20), `surface` (controlled).
- Headers: `X-Tracking-Enabled` (opt-out), `X-Anonymous-Id` (anonymous only).
- Response data: `{ mode, algorithmVersion, requestId, listId, recommendationLogged, profileSummary, recommendations[{ product, score, reasons, rank, algorithmVersion }] }`.
- `mode` is one of the PERS-00 mode names. Anonymous returns `anonymous-fallback` (or `cold-start` until PERS-07 adds popularity).
- Safe errors: `UNAUTHENTICATED` only where required; otherwise anonymous fallback. `PERSISTENCE_UNAVAILABLE` in explicit MongoDB mode. No private raw rows, no username leakage, no MongoDB object ids, no internal exclusions.

### Data-Model Changes

None. Uses existing `recommendationLogs`.

### Algorithm Or Business Rules

Parity first. The branch refactor is structural; output for current inputs is identical to today.

### Privacy And Security Rules

- Subject always comes from the verified optional-session resolver; only an active customer session can produce a registered subject.
- Anonymous id only accepted when no session.
- Recommendation log subject is the verified publicId.

### Edge Cases

- Missing/expired/tampered session → anonymous fallback.
- Disabled/deleted account → anonymous fallback (resolution returns null).
- Admin session → reject (`403`) per PERS-00 default.
- Sign-in during an in-flight anonymous request → frontend aborts and re-requests as authenticated.
- Sign-out during an in-flight authenticated request → response is dropped by the resource-key guard.
- Multiple tabs → each tab's request authorized independently.
- Stale frontend response after identity change → resource key mismatch discards it.

### Failure And Recovery Behavior

- Database unavailable: explicit MongoDB mode returns `PERSISTENCE_UNAVAILABLE`; seed mode serves cold-start/anonymous fallback.
- Seed mode: authenticated users get cold-start (no profile data in seed); logging suppressed as today.

### Migration Strategy

- `PERS_ME_ENDPOINT` and `VITE_PERS_ME_ENDPOINT` are enabled by default after parity and integration tests passed; explicit `false` rolls both sides back to the labelled showcase path.
- Authenticated and anonymous frontend surfaces now use `/me`; the legacy route remains restricted.
- Keep the old route restricted (PERS-01).
- No data migration.

### Tests

- Backend tests cover verified ownership, anonymous logging, cold-start/fallback parity, admin denial through the identity helper, malformed actor rejection before catalog access, feature rollback, and no identity in the public result.
- Frontend API/provider/browser tests cover auth-before-load, endpoint selection, anonymous headers/fallback, sign-in abort, sign-out cleanup, stale-response prevention even when abort is ignored, retry, tampered-cookie fallback, admin denial, and legacy cross-user parity.

### Documentation Updates

- Both `API_CONTRACT_PLAN.md` files add `GET /api/recommendations/me`.
- Both `RECOMMENDER_SYSTEM_PLAN.md` files document the session-owned path.
- `implementation_plan_order.txt` updated.

### Definition Of Done

- Achieved: `/api/recommendations/me` is session-owned for customers, anonymous fallback works, administrators are rejected, the frontend is auth-gated and stale-safe, the old route remains demo/cold-start-only, and parity/regression suites pass.

### Rollback Criteria

- Disable backend `PERS_ME_ENDPOINT` and frontend `VITE_PERS_ME_ENDPOINT`; the client falls back to the fixed `demo-user` showcase. No data rolls back.

### Risks

- FR-014: stale identity responses overwrite current results. Controlled by abort plus generation/resource-key guards.
- FR-016: recommendation loading races auth restoration. Controlled by provider order, auth gating, and component/browser tests.

### Decisions Still Requiring Approval

None. The default is 12 with a cap of 20.

---

## PERS-03: Unified Recommendation Profile And Feedback Domain (BFP-10)

### ID And Title

PERS-03 / BFP-10 — One backend-owned profile-construction service and a unified feedback domain.

### Status

Planned. Blocked by PERS-02. No live ranking change yet (profile is built behind a flag and consumed only in PERS-04+).

### Goal

Convert all available data (preferences, explicit feedback, strong/weak implicit behavior, operational state) into one normalized recommendation profile through a single service. Route handlers must not combine repositories or scoring logic directly.

### Why It Is Required

Personalization needs one authoritative profile. Today preferences are inert, dismissal is write-only, and there is no feedback collection. Without a unified domain, PERS-04 through PERS-08 would each re-read repositories and produce inconsistent profiles.

### Current Implementation Gap

- No profile-construction service.
- No feedback collection (no not-interested, already-own, show-fewer).
- Preferences not read by the ranker.
- Passive analytics and explicit actions are not separated.

### Dependencies

- PERS-02 endpoint and subject descriptor.
- Existing preferences, interactions, wishlist, cart, ratings repositories.

### Non-goals

- Permanently storing a derived profile (recompute on demand unless proven insufficient).
- Changing live ranking output (consumed in PERS-04+).
- Adding collaborative filtering.

### Backend Changes

- Add `src/services/recommendationProfile.js` with a pure `buildRecommendationProfile({ subject, preferences, feedback, interactions, catalog, now, opts })` returning a normalized profile object: `{ explicitPreferences, explicitFeedback, strongImplicit, weakImplicit, operational, signals[], completeness, dataSourceFlags }`.
- Add `src/models/Feedback.js` (durable user feedback collection): fields `userPublicId, productPublicId, kind ("not-interested"|"already-own"|"show-fewer-like-this"), scope, reason, createdAt, updatedAt, schemaVersion`. Unique compound `(userPublicId, productPublicId, kind)`. Not TTL-limited (durable account state).
- Add `src/repositories/feedbackRepository.js` and `src/services/feedback.js` (validation, authorization, idempotent upsert, undo).
- Extend `src/repositories/accountRepository.js` deletion transaction to also remove the feedback collection.
- Add new interaction types if needed for explicit feedback events (for example `not_interested`, `already_own`, `feedback_undo`) to `src/models/constants.js`, keeping `recommendation_dismiss` for backward compatibility. Explicit functional actions are written both as durable feedback and as interaction evidence.

### Frontend Changes

Consumed via API in PERS-05 (FFP-11). No frontend change in PERS-03 except reading `profileSummary` (already present) and any new safe data-source flags.

### API Contract

No new public route in PERS-03. The `/me` response gains safe `profileSummary` and `dataSourceFlags` (for example `["preferences","ratings","wishlist","cart","feedback","behavioral"]`) — no raw signals, no counts that leak private behavior.

### Data-Model Changes

- New `feedback` collection (durable, no TTL).
- Optional new interaction enum values for explicit feedback.
- `accountRepository` deletion extended.
- Guest-to-account merge extended to carry explicit feedback authored as a guest (decision: explicit guest feedback merges on sign-up only, like other guest state).

### Algorithm Or Business Rules

Profile signal schema (each signal): `{ key, source (preference|rating|wishlist|cart|feedback|behavioral), polarity (positive|neutral|negative), level (item|artist|genre), target, weight, confidence, recency, firstSeen, lastSeen, provenance }`.

Data classification:

- Durable user state: preferences, ratings, wishlist, cart, explicit feedback.
- Immutable interaction history: all interaction events (90-day TTL).
- TTL-limited analytics: impressions, views, clicks, searches.
- Derived profile data: recomputed per request (no persistence).
- Cached: optional short-lived in-process cache keyed by subject + a profile version, invalidated on any write by that subject.
- Never persisted: the raw recomputed profile object.

Deduplication keys: `(subject, productPublicId)` for item signals; `(subject, level, target)` for artist/genre derived signals. Replay protection: idempotent feedback upsert by `(userPublicId, productPublicId, kind)`. Per-session and per-user caps on behavioral signals (PERS-06).

Clock-skew handling: use `receivedAt` (server-owned, immutable) for ordering; clamp `occurredAt` to the existing `MAX_FUTURE_SKEW_MS`. Missing timestamps fall back to `receivedAt`. Deleted/unknown products are dropped from signals but counted in `dataSourceFlags` as `unknown-products`. Duplicate ratings: newest wins. Rating changes: replace. Wishlist removal: removes the positive signal. Cart quantity changes: re-derive. Conflicting signals: explicit overrides implicit; more recent wins within the same source.

### Privacy And Security Rules

- Passive analytics never feed the profile when opt-out is active.
- Explicit functional actions feed the profile regardless of opt-out.
- The profile object never leaves the server; only safe `profileSummary` and flags are public.
- Feedback is owned by the session subject; cross-user writes are rejected.

### Edge Cases

- Deleted products referenced by feedback/interactions: dropped from signals, flagged.
- Unknown product ids: dropped, flagged.
- Duplicate ratings, rating changes, wishlist removal, cart quantity changes: handled per rules above.
- Conflicting signals (rating 5 and not-interested on same item): explicit negative feedback wins for suppression; rating still counts as positive taste evidence at artist/genre level per PERS-05 rules.
- Guest-to-account merge of feedback: sign-up only, idempotent.
- Seeded-demo reset: showcase accounts reset to canonical profiles on `db:seed:users:apply`.

### Failure And Recovery Behavior

- Database unavailable: profile build fails over to preferences-only (durable, fast) or cold-start; never silently cross identity.
- Partial write in feedback upsert: transactional; idempotent retry safe.

### Migration Strategy

- Add models/repositories/services behind `PERS_PROFILE_DOMAIN` flag, no live ranking consumption.
- Additive indexes only; dry-run backfill not needed (feedback is created on demand).
- Account deletion extension covered by an additive transaction step.

### Tests

- `tests/recommendation-profile.test.mjs`: profile construction from each source; polarity/level derivation; dedup; recency; conflicts; opt-out excludes passive; explicit actions included under opt-out; deleted/unknown products flagged.
- `tests/feedback-repository.test.mjs`: idempotent upsert, undo, cross-user rejection, account deletion cleanup.

### Documentation Updates

- `DATA_MODEL_PLAN.md`: add `feedback` collection and signal schema.
- `RECOMMENDER_SYSTEM_PLAN.md`: document the profile domain.
- Both `API_CONTRACT_PLAN.md`: document new safe profile fields.
- `DECISION_LOG.md`: BDEC-017 (profile recompute-on-demand; explicit-vs-passive opt-out split).

### Definition Of Done

- One service builds the profile; routes do not combine repositories.
- Feedback collection exists, idempotent, deleted with the account.
- Profile never persisted; safe summary only in responses.
- Opt-out split enforced.

### Rollback Criteria

Disable `PERS_PROFILE_DOMAIN`. Ranking reverts to demo/cold-start. Feedback collection remains harmless if left in place; it can be dropped via the additive migration's reverse.

### Risks

- BR-023: profile leaks private behavior in summary. Mitigation: summary allow-list test.
- BR-024: feedback retention conflicts with TTL. Mitigation: feedback is durable by design; documented.

### Decisions Still Requiring Approval

- Whether `show-fewer-like-this` is in the initial scope (proposed: yes, optional, with clear "like this" explanation).
- Cache TTL for the recomputed profile (proposed: none initially; add only if measured cost justifies).

---

## PERS-04: Preference-Aware Ranking (BFP-11 / FFP-10)

### ID And Title

PERS-04 / BFP-11 (backend) + FFP-10 (frontend) — Knowledge-based preference-aware ranking using stored preferences.

### Status

Planned. Blocked by PERS-03. First ranking change; behind a flag; `content-demo-v1` preserved.

### Goal

Rank with the user's stored preferences as hard constraints and soft scores, with truthful explanations, without silently ignoring constraints to fill a list.

### Why It Is Required

Preferences are persisted but inert. PERS-04 makes them actually drive ranking, the first real personalization surface.

### Current Implementation Gap

- Ranker never reads preferences.
- No hard/soft constraint separation.

### Dependencies

- PERS-03 profile domain (preferences portion).

### Non-goals

- Behavioral signals (PERS-06), popularity (PERS-07), hybrid (PERS-08).
- Changing the product-similarity route's content-based logic.

### Backend Changes

- Add `src/lib/recommender/preferenceRanking.js` with pure functions: `applyHardConstraints(candidates, profile)`, `scoreByPreferences(candidates, profile)`, `relaxConstraints(...)`.
- Wire into the `/me` service behind `PERS_PREFERENCE_RANKING`. New mode `preference-profile`, version `preference-profile-v1`.
- Reuse the existing diversify (artist cap 2) and deterministic title tie-break.

### Frontend Changes (FFP-10)

- Surface `preference-profile` mode label honestly.
- Preference edits refresh recommendations (wire `savePreferences` to `reloadRecommendations` for authenticated users).
- Show relaxed-constraint notices when applicable.

### API Contract

`/me` may return `mode: "preference-profile"` and reasons such as `Matches your Jazz preference.`, `Falls within your preferred budget.`, `Available in your preferred condition.`, `Matches an artist you selected.`, `Excluded because you marked this genre as unwanted.` Raw weights are never shown as probabilities.

### Data-Model Changes

None (preferences already exist). `dislikedGenres` becomes a hard constraint by default.

### Algorithm Or Business Rules

Hard constraints (exclude):

- Out-of-stock (unless availability preference explicitly allows backorders — not in initial scope).
- Soft-deleted.
- Explicitly suppressed (not-interested/already-own from PERS-05; until then, none).
- Already-owned exact item (from PERS-05; until then, none).
- Explicitly disliked genre (`dislikedGenres`) by default.
- Unsupported format if configured hard (initial: soft).
- Absolute budget maximum if configured hard (initial: `budget.max` is hard, `budget.min` is soft).

Soft preferences (score):

- Favorite genre, favorite artist, preferred condition, preferred format, preferred budget range, release era, availability.

Rules: candidate generation from the bounded candidate set; hard-filter; soft-score; weight configuration versioned in a constants file; min-max normalization per request; deterministic tie-break by title; minimum score threshold optional; max 2 per artist; genre diversity.

Handling gaps: missing metadata → neutral score (not zero, not excluded unless hard rule); multi-genre products match on any favorite; unknown year/label → decade/label signal neutral; missing price → budget neutral; imported partial metadata → neutral on missing fields; currency assumed USD (existing); conflicting preferences → favorites win over dislikes only at item level, dislikes remain hard at genre level; empty preferences → fall through to next ladder rung; partial onboarding → use whatever is set; extremely narrow preferences → may yield empty list; no candidates after filtering → explicit empty result with explanation, or user-approved relaxation suggestions, or a clearly separated fallback section stating which constraints were not applied.

Transparent relaxation: when no candidate satisfies all hard constraints, the system does not silently relax. It returns either an empty personalized list with explanation, user-approved relaxation suggestions, or a separate fallback section that states which constraints were relaxed.

### Privacy And Security Rules

- Preferences are durable account state; used regardless of opt-out (user-authored feature).
- No private data in explanations beyond what the user themselves set.

### Edge Cases

- Empty preferences, partial onboarding, conflicting favorite/disliked genres, `budget.min > budget.max` (rejected at validation already), unsupported condition/format, preference edits during ranking (next request picks up new prefs), preference deletion, no matching products, extremely narrow preferences, missing product metadata, multi-genre products, unknown year/label, missing price, imported partial metadata.

### Failure And Recovery Behavior

- No candidates → empty list + explanation (no silent fill).
- Database unavailable → preferences unavailable → fall to next ladder rung (behavior-only, popularity, cold-start).

### Migration Strategy

- Behind `PERS_PREFERENCE_RANKING`; default off.
- No data migration.

### Tests

- `tests/preference-ranking.test.mjs`: hard-filter correctness; soft-score; disliked-genre exclusion; budget hard max; empty preferences; narrow preferences → empty+explanation; relaxation notice; deterministic tie-break; missing metadata neutral; explanation correctness.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: preference-aware section, version `preference-profile-v1`.
- Both `API_CONTRACT_PLAN.md`: new mode and reason strings.
- Frontend `RECOMMENDER_SYSTEM_PLAN.md` / `UI_UX_PLAN.md`: mode label and refresh behavior.

### Definition Of Done

- Stored preferences drive ranking for authenticated users.
- Hard constraints never silently ignored.
- Explanations match actual filters.
- `content-demo-v1` unchanged.

### Rollback Criteria

Disable `PERS_PREFERENCE_RANKING`; `/me` reverts to cold-start/demo parity.

### Risks

- BR-025: silent constraint relaxation fills lists with irrelevant items. Mitigation: empty-with-explanation test.
- BR-026: narrow real preferences yield empty storefront. Mitigation: documented relaxation UX.

### Decisions Still Requiring Approval

- Which constraints are hard vs soft by default (proposed defaults above).
- Whether to show relaxation suggestions automatically or on user action.

---

## PERS-05: Negative Feedback (BFP-12 / FFP-11)

### ID And Title

PERS-05 / BFP-12 (backend) + FFP-11 (frontend) — First-class negative feedback: not-interested, already-own, undo, optional show-fewer-like-this.

### Status

Planned. Blocked by PERS-03 (feedback domain) and ideally after PERS-04 so negative signals compose with preference ranking.

### Goal

Make negative feedback a durable, first-class feature that suppresses and down-weights, not just an analytics event.

### Why It Is Required

`recommendation_dismiss` exists but is write-only. Real personalization requires durable suppression and controlled negative evidence, with retention that survives analytics TTL.

### Current Implementation Gap

- No feedback collection; dismissal is write-only; no UI.

### Dependencies

- PERS-03 feedback collection.
- PERS-04 ranking (for composition).

### Non-goals

- Permanent broad genre suppression from a single item unless explicitly chosen.
- Treating already-own as a dislike.

### Backend Changes

- Feedback routes under `src/app/api/me/feedback/`:
  - `PUT /api/me/feedback/:productId` body `{ kind, scope?, reason? }` → idempotent upsert.
  - `DELETE /api/me/feedback/:productId?kind=` → undo (idempotent).
  - `GET /api/me/feedback` → list (account feature).
- Wire feedback into `applyHardConstraints` (exact-item suppression for `not-interested` and `already-own`) and into negative feature evidence (configurable, bounded) for matching artist/genre.
- Retention: durable (no TTL). Account deletion removes it (PERS-03).
- Undo idempotent; duplicate submission does not double-penalize (compound key).

Semantics:

- `not-interested`: suppress exact item; apply configurable negative evidence to matching attributes; avoid permanent broad genre suppression from one item unless the user explicitly chooses a genre-level dislike.
- `already-own`: suppress exact item from purchase-oriented recommendations; treat artist/genre/style as possible positive taste evidence; not a dislike.
- `show-fewer-like-this`: reduce similar-item scores; require a clear explanation of what "like this" means; avoid over-penalizing broad genres.
- Low rating (1-2): strong negative item evidence; controlled negative feature evidence; rating changes update the effective profile (already supported via rating replace).

Storage decision: dedicated `feedback` collection is the authoritative state source; interaction events are also written for evidence/audit. Ratings remain in `ratings`. Preferences remain separate. One authoritative source per signal kind.

### Frontend Changes (FFP-11)

- Add accessible feedback controls on recommendation cards and product detail: "Not interested", "Already own", optional "Show fewer like this", and "Undo".
- Placement: card footer and detail-page actions; visible keyboard focus; touch-target size; mobile layout verified.
- Loading/disabled states; prevent double-click (disable while pending).
- Update strategy: pessimistic for creates (await server confirmation before removing from list) to avoid optimistic removal that a late network failure reverts; undo is optimistic with rollback on error. (Final choice recorded in FDEC-012.)
- On success: remove or re-rank the item in the current list; announce via live region for screen readers; update explanations.
- Error/offline: keep the item, show recoverable error; queue nothing (feedback is a functional action, not analytics).
- Cross-tab consistency: refresh feedback state on focus when authenticated.

### API Contract

- `PUT /api/me/feedback/:productId` → `{ data: { productPublicId, kind, ... } }`; idempotent.
- `DELETE /api/me/feedback/:productId?kind=` → `{ data: { productPublicId, kind, removed: true } }`; idempotent.
- `GET /api/me/feedback` → `{ data: { items: [...] } }`.
- Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `NOT_FOUND`, `PERSISTENCE_UNAVAILABLE`.
- `/me` recommendations respect feedback in exclusions and re-ranking.

### Data-Model Changes

Uses PERS-03 `feedback` collection. No additional schema.

### Algorithm Or Business Rules

Exact-item suppression is a hard constraint. Negative feature evidence is bounded: a single dismiss must not exclude a whole genre; accumulation across multiple items is capped and decays. Conflict resolution (rating 5 + not-interested): suppression wins for the item; positive taste evidence at artist/genre may still apply.

### Privacy And Security Rules

- Feedback is durable account state, authored by the session subject.
- Available regardless of opt-out (functional feature).
- Auditability without exposing private data: interaction evidence stored without PII.

### Edge Cases

- Duplicate dismiss → one penalty.
- Undo twice → idempotent.
- Dismiss a since-deleted product → stored, dropped from signals, flagged.
- Already-owned item becomes unavailable → stays suppressed from purchase recs.
- Conflict rating 5 vs not-interested → suppression wins for item.
- Conflict already-own vs low rating → already-own not a dislike; low rating still negative item evidence.
- Item-level dislike vs genre preference → item suppressed, genre untouched unless explicit genre dislike.
- Feedback during a refreshing recommendation request → next request reflects it; in-flight request is not mutated.
- Network failure after optimistic removal → rollback (pessimistic strategy avoids this for creates).

### Failure And Recovery Behavior

- Backend unavailable → create rejected with recoverable error; existing feedback remains; ranking falls back without feedback.
- Partial write → transactional; idempotent retry.

### Migration Strategy

- Additive routes + collection behind `PERS_NEGATIVE_FEEDBACK`.
- No destructive migration.

### Tests

- `tests/feedback.test.mjs`: validation, authorization, idempotency, undo idempotency, replay, conflict handling, unknown/deleted product, account deletion cleanup.
- `tests/preference-ranking.test.mjs` extended: not-interested suppresses; already-own suppresses without dislike; show-fewer reduces; low rating negative; rating change updates profile.
- Frontend FFP-11: submission, undo, error recovery, loading/empty states, keyboard, mobile, screen-reader announcements, cross-tab.

### Documentation Updates

- Both `API_CONTRACT_PLAN.md`: feedback routes.
- `DATA_MODEL_PLAN.md`: feedback authoritative-source decision.
- Frontend `UI_UX_PLAN.md`: control placement and states.
- `DECISION_LOG.md`: BDEC-018 (durable feedback authoritative source; pessimistic vs optimistic).

### Definition Of Done

- All four feedback kinds work; durable; undo idempotent; cross-user denied; account deletion cleans up; ranking respects feedback.

### Rollback Criteria

Disable `PERS_NEGATIVE_FEEDBACK`; routes return `NOT_FOUND`; ranking ignores feedback. Collected feedback remains harmless.

### Risks

- BR-027: one dismiss suppresses a genre. Mitigation: bounded negative evidence test.
- FR-016: optimistic removal + network failure strands UI. Mitigation: pessimistic creates.

### Decisions Still Requiring Approval

- Pessimistic vs optimistic create strategy (proposed pessimistic).
- Genre-level dislike as an explicit separate control (proposed: optional, off by default).

---

## PERS-06: Behavioral-Signal Personalization (BFP-13 / FFP-12)

### ID And Title

PERS-06 / BFP-13 (backend) + FFP-12 (frontend) — Differentiated behavioral personalization from interaction history.

### Status

Planned. Blocked by PERS-03 (profile) and PERS-05 (negative semantics). First use of interaction history in live ranking.

### Goal

Use behavioral signals with differentiated strength, recency decay, frequency saturation, dedup, and caps, while preserving exact recommendation attribution and the opt-out boundary.

### Why It Is Required

Behavior is the largest signal source, but every event is not equally reliable. PERS-06 defines the aggregation rule that PERS-08 hybrid consumes.

### Current Implementation Gap

- Live ranker reads no interactions.
- Opt-out does not suppress interaction persistence (gap).

### Dependencies

- PERS-03 profile (behavioral portion).
- Existing interaction repository and recommendation-context attribution.

### Non-goals

- Treating all events as equally reliable.
- Using passive history when opt-out is active.
- Quality claims (still `insufficient-evidence`).

### Backend Changes

- Add `src/lib/recommender/behavioralProfile.js` with the aggregation rule.
- Wire into `/me` behind `PERS_BEHAVIORAL_RANKING`; mode `behavior-profile`, version `behavior-profile-v1`.
- Fix the opt-out gap: `src/app/api/interactions/route.js` and `src/services/userState.js` suppress persistence of passive analytics events when `x-tracking-enabled: false`. Explicit functional actions (ratings, wishlist, cart, feedback) persist regardless (they are not passive analytics).
- Preserve exact recommendation attribution (`recommendationContext.requestId/listId/algorithmVersion/mode/rank`) on consumed events.

### Frontend Changes (FFP-12)

- Continue sending attributed events; ensure opt-out stops passive capture (already implemented) and that explicit functional actions are still sent (they are user actions, not tracking).
- Mode label `behavior-profile` rendered honestly.

### API Contract

`/me` may return `mode: "behavior-profile"` and reasons derived from behavioral evidence (for example `Popular with records you have saved.`). When opt-out is active, behavioral reasons are not generated (no passive evidence used).

### Data-Model Changes

None to schemas. Opt-out suppression is a route/service change.

### Algorithm Or Business Rules

Signal polarity and strength:

- Positive: rating 5 (strong), rating 4 (medium), add to cart (strong), add to wishlist (strong), already-own (positive taste), recommendation click (weak), product view (weak), search-result click (weak), repeated artist/genre search (medium).
- Neutral/ambiguous: rating 3, single product view, impression without action, search without click.
- Negative: rating 1-2, not-interested, show-fewer-like-this, wishlist removal, rapid cart removal (only if evidence supports).

Aggregation rule: `effectiveContribution = baseWeight × confidence × recencyFactor × frequencySaturation`. Initial base weights and decay constants are documented as configurable assumptions in a versioned constants file, not validated optimal values.

Confidence: explicit (ratings, wishlist, cart, feedback) > implicit (clicks, views). Recency decay: exponential with a documented half-life. Frequency saturation: diminishing returns after a per-signal cap. Dedup by `(subject, type, productPublicId, day)` for impression-style events. Session cap, daily cap, repeated-refresh handling (a refresh-generated view does not inflate interest). Bot-like/abnormal volume: dropped by the existing cap and by a per-signal sanity ceiling.

Event-order conflicts: order by `receivedAt`. Late delivery and duplicate `eventId`: idempotent. Rating replacement: newest wins. Wishlist add/remove cycles and cart quantity changes: re-derive final state. Search privacy: searches are weak signals and opt-out-gated. Anonymous-session signals: session-only; promoted to the account only on sign-up merge. Authenticated signals: durable to the account. Identity change during queued delivery: generation guard discards stale-identity batches (already implemented in the frontend).

Protections:

- One accidental click cannot dominate (frequency saturation + confidence).
- One record cannot exclude a whole genre (bounded negative evidence from PERS-05).
- Refreshes do not inflate interest (dedup + cap).
- Self-generated demo traffic cannot dominate popularity (PERS-07 demo-account handling).
- Mixed anonymous/authenticated histories are not combined across identities (merge only on sign-up).
- Events from recommendations the user never saw are not counted (attribution must reference a served list; PERS-07/PERS-08 validate list id existence and recency).
- Stale recommendation attribution and events referencing an expired/unknown list id or a different algorithm version are dropped or down-weighted per a documented rule.

### Privacy And Security Rules

- Passive analytics honored opt-out (no persistence, no profile use).
- Explicit functional actions persist regardless of opt-out.
- No PII in behavioral signals; no cross-user inference.

### Edge Cases

- Duplicate events, out-of-order events, clock skew, replayed events, refresh-generated views, bot-like volume, add/remove cycles, rating changes, rating deletion, passive tracking disabled, anonymous-to-authenticated transition, guest-state merge retry, interaction references deleted product, interaction references unknown/expired recommendation list id.

### Failure And Recovery Behavior

- No behavioral evidence → component unavailable → renormalize (PERS-08).
- Database unavailable → behavior-only ranking unavailable → next ladder rung.

### Migration Strategy

- Behind `PERS_BEHAVIORAL_RANKING`; default off.
- Opt-out fix is a standalone change that can ship independently.

### Tests

- `tests/behavioral-profile.test.mjs`: aggregation rule, recency decay, dedup, frequency saturation, caps, opt-out excludes passive, explicit actions included under opt-out, attribution preserved, stale/unknown list id dropped, bot-like volume dropped, anonymous-to-auth merge.
- `tests/interaction-optout.test.mjs`: opt-out suppresses passive persistence; explicit actions persist.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: behavioral section, version `behavior-profile-v1`, aggregation formula.
- `INTERACTION_LOGGING_PLAN.md` (frontend): opt-out boundary update.
- `EVALUATION_PLAN.md`: note live behavioral ranking is separate from offline baselines.
- `DECISION_LOG.md`: BDEC-019 (opt-out split between passive and explicit; aggregation assumptions).

### Definition Of Done

- Behavioral signals drive ranking for authenticated users with evidence.
- Opt-out fully suppresses passive analytics (persistence + use).
- Attribution preserved; protections in place.
- No quality claim.

### Rollback Criteria

Disable `PERS_BEHAVIORAL_RANKING`; behavior component off. Opt-out fix stays (it only tightens privacy).

### Risks

- BR-028: opt-out gap not fully closed. Mitigation: dedicated opt-out persistence test.
- BR-029: noisy clicks dominate. Mitigation: saturation/cap tests.

### Decisions Still Requiring Approval

- Initial base weights and decay half-life values (documented assumptions).
- Whether to count search-result clicks toward taste before any other positive signal.

---

## PERS-07: Popularity Baseline And Fallback (BFP-14)

### ID And Title

PERS-07 / BFP-14 — A real aggregate-evidence popularity recommender plus the fallback ladder.

### Status

Planned. Blocked by PERS-06 (so the anonymous fallback and demo-traffic handling are defined). Also requires the offline popularity baseline to remain separately testable.

### Goal

Provide a true popularity recommender built from aggregate interaction evidence, plus a documented fallback ladder, and keep popularity available as a separately testable baseline.

### Why It Is Required

A popularity fallback is needed for anonymous users and empty profiles, and must be a real aggregate signal rather than the current newest-year/stock ordering. It must also avoid feedback loops.

### Current Implementation Gap

- No live popularity recommender. Popularity exists only as an offline baseline (`offlineEvaluation.js:124-127`).

### Dependencies

- Existing interactions and recommendation logs.
- PERS-06 signal semantics (eligible event types).

### Non-goals

- Replacing the offline popularity baseline.
- Quality claims.

### Backend Changes

- Add `src/lib/recommender/popularity.js` with `rankByPopularity({ from, to, catalog, opts })` returning a deterministic ranked list with per-item evidence counts.
- Add `src/services/popularityAggregation.js` to compute aggregate scores over a time window with caching and invalidation.
- Wire as a live component and as the anonymous fallback behind `PERS_POPULARITY`.
- Add indexes for popularity aggregation: compound `(productPublicId, occurredAt)` exists; add `(type, productPublicId, occurredAt)` if measured necessary.
- Add a cache (in-process or MongoDB) with explicit invalidation on catalog change and on a configured TTL.

Concepts (select one initial production fallback and justify):

- All-time popularity, recent popularity, trending, highest-rated, most-wishlisted, most-added-to-cart. Proposed initial production fallback: recent popularity (30-day window, Bayesian smoothed), justified as balance of recency and evidence stability.

Definition:

- Eligible event types: positive signals from PERS-06 (rating 4-5, wishlist add, cart add, already-own as positive taste, recommendation click weighted low).
- Relative weights: explicit > implicit (versioned assumptions).
- Time window: 30 days default (configurable).
- Minimum evidence: Bayesian/confidence smoothing with a global prior so one-event items do not dominate.
- Unique-user counting (not raw event counts) to prevent one user generating many events from dominating.
- Event dedup by `(subject, type, productPublicId, day)`.
- Removal/reversal events (wishlist remove, rating remove) subtract.
- Anonymous activity counts toward popularity (opt-out anonymous activity does not).
- Demo-account activity excluded from popularity (so self-generated demo traffic cannot dominate — PERS-06 protection).
- Deleted products excluded; out-of-stock products down-ranked or excluded per availability rule; missing metadata neutral.
- Low-volume catalog / no interaction data → fall to deterministic recent in-stock catalog.
- Deterministic tie-break by numeric product id then title.
- Artist cap 2; genre diversity.
- Caching with invalidation on catalog mutation and TTL.

Feedback-loop safeguards:

- Exposure bias: cap items already heavily exposed (deduplicate against recent served lists where feasible).
- One user dominating counts: unique-user counting.
- Demo traffic: excluded.
- New items never surfacing: small discovery allowance / content recency tie-break.
- Niche suppression: diversity rerank.
- One artist occupying the list: artist cap.

Fallback ladder (each response identifies the actual mode used):

1. Personalized hybrid (PERS-08).
2. Preference-only ranking (PERS-04).
3. Behavior-only ranking (PERS-06).
4. Popularity ranking (PERS-07).
5. Deterministic recent in-stock catalog.

### Frontend Changes

- Render `popularity` and `anonymous-fallback` mode labels honestly.

### API Contract

`/me` anonymous and fallback paths return `mode: "popularity"` or `mode: "anonymous-fallback"` with truthful reasons (for example `Popular recent picks.`). No popularity scores exposed as probabilities; only rank and a safe reason.

### Data-Model Changes

- Additive index for popularity aggregation (no schema change).
- Optional popularity cache collection (additive).

### Algorithm Or Business Rules

See Backend Changes. Popularity must remain a separately testable baseline: keep the offline baseline in `offlineEvaluation.js` independent of the live popularity recommender.

### Privacy And Security Rules

- Aggregate only; no per-user leakage in responses.
- Opt-out anonymous activity excluded.

### Edge Cases

- No events, one event, one user dominating, synthetic demo traffic, old events, removed ratings, deleted products, out-of-stock products, new catalog products, same artist dominating, cached score stale.

### Failure And Recovery Behavior

- No popularity evidence → deterministic recent in-stock catalog.
- Cache corruption → recompute.
- Aggregation timeout → serve last good cache or fall through.

### Migration Strategy

- Behind `PERS_POPULARITY`; additive indexes; cache optional.

### Tests

- `tests/popularity.test.mjs`: aggregation, smoothing, unique-user counting, reversal subtraction, demo exclusion, opt-out exclusion, deleted/out-of-stock handling, diversity, deterministic tie-break, cache invalidation, fallback ladder ordering, separate-baseline independence.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: popularity section, version `popularity-v1`, fallback ladder.
- `DATA_MODEL_PLAN.md`: new indexes/cache.
- `EVALUATION_PLAN.md`: live popularity vs offline baseline distinction.

### Definition Of Done

- Live popularity recommender works from aggregate evidence.
- Anonymous fallback returns popularity then deterministic catalog.
- Demo traffic excluded; feedback-loop safeguards in place.
- Offline baseline remains independently testable.

### Rollback Criteria

Disable `PERS_POPULARITY`; anonymous fallback returns deterministic recent in-stock catalog.

### Risks

- BR-030: demo/seeded traffic dominates popularity. Mitigation: demo-exclusion test.
- BR-031: popularity feedback loop. Mitigation: diversity + exposure cap.

### Decisions Still Requiring Approval

- Initial production fallback variant (proposed recent popularity, 30-day, smoothed).
- Cache TTL and invalidation granularity.

---

## PERS-08: Hybrid Recommendation Orchestration (BFP-15 / FFP-13)

### ID And Title

PERS-08 / BFP-15 (backend) + FFP-13 (frontend) — Hybrid orchestration of preference, content, behavioral, popularity, and availability components with diversity reranking.

### Status

Planned. Blocked by PERS-04, PERS-06, PERS-07 (all component recommenders must have stable contracts).

### Goal

Combine the component recommenders into one hybrid with documented (assumption) weights, normalized scores, diversity reranking, truthful explanations, and a clear fallback.

### Why It Is Required

The components are only useful together. PERS-08 defines the final `personalized-hybrid` mode that the storefront surfaces as the authenticated recommendation.

### Current Implementation Gap

- No hybrid; only the demo content-based ranker.

### Dependencies

- PERS-04 preference, PERS-06 behavioral, PERS-07 popularity, existing content similarity, PERS-05 negative feedback.

### Non-goals

- Collaborative filtering and matrix factorization (excluded).
- Quality claims.

### Backend Changes

- Add `src/lib/recommender/hybrid.js` orchestrating: candidate generation → component scoring → normalization → final weighting → reranking → explanation → fallback.
- Wire into `/me` behind `PERS_HYBRID`; mode `personalized-hybrid`, version `personalized-hybrid-v1`.
- Preserve `content-demo-v1` unchanged.

Architecture:

- A. Candidate generation: full active catalog or bounded indexed subset; product availability; soft-delete exclusion; known-item exclusion; suppression exclusion; already-owned handling.
- B. Component scoring: preference score, content score, behavioral score, popularity score, availability score.
- C. Score normalization: min-max to `[0,1]` per component per request; missing component → renormalize weights over available components (not zero) unless justified.
- D. Final weighting: documented initial weights as assumptions (proposed: preference 0.35, content 0.25, behavioral 0.25, popularity 0.15). Configuration-controlled; every change increments version.
- E. Reranking: artist cap 2, genre diversity, minimum relevance threshold, discovery allowance, stable deterministic tie-break, avoid duplicate releases/near-duplicate pressings where applicable.
- F. Explanation generation: reasons from actual score contributions and filters; do not claim behavioral evidence when passive tracking is disabled; do not claim popularity when aggregate evidence is below the minimum; do not describe a score as a probability; explain fallback mode; limit to useful user-facing reasons; keep internal scoring server-side.
- G. Fallback: empty/partial profile, no behavioral evidence, no popularity evidence, no candidates, database unavailable, seed mode, external metadata unavailable → documented ladder from PERS-07.

Algorithm-version migration:

- Keep `content-demo-v1` unchanged for regression comparison.
- Introduce new versions rather than silently changing existing behavior.
- Preserve historical recommendation logs; never recompute old logs with new weights.
- Include version in every recommendation and attributed interaction.
- Rollback behavior: disable flag → previous version serves.

### Frontend Changes (FFP-13)

- Render `personalized-hybrid` mode label and truthful reasons.
- Attribution carries the hybrid version.

### API Contract

`/me` returns `mode: "personalized-hybrid"`, `algorithmVersion: "personalized-hybrid-v1"`, ranked items with reasons, fallback reason when a lower ladder rung is used, and `profileCompleteness`. No raw component weights in the response.

### Data-Model Changes

None to schemas; recommendation logs already carry mode/version.

### Algorithm Or Business Rules

See architecture above.

### Privacy And Security Rules

- Explanations reveal no more than the user's own data and safe aggregates.
- Behavioral reasons suppressed under opt-out.

### Edge Cases

- Missing component score, all component scores equal, negative total score (clamp at 0 then renormalize), one component dominating due to scale (normalization prevents), no candidate after hard filtering, duplicate releases, stable ordering across requests (deterministic tie-break), weight changes (version bump), rollback, historical logs from older versions (never recomputed), explanation does not match actual score (explanation generator reads the same normalized contributions).

### Failure And Recovery Behavior

- Any component unavailable → renormalize over available; all unavailable → fallback ladder.
- Database unavailable → `PERSISTENCE_UNAVAILABLE` in MongoDB mode; cold-start in seed mode.

### Migration Strategy

- Behind `PERS_HYBRID`; default off; rollback to `content-demo-v1`.

### Tests

- `tests/hybrid.test.mjs`: normalization, missing-component renormalization, weighting, reranking (artist cap, diversity), explanation correctness, fallback ladder, deterministic ordering, version stamping, opt-out suppresses behavioral reasons, low-evidence suppresses popularity reasons.
- Regression: `content-demo-v1` output unchanged by the same inputs.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: hybrid section, version `personalized-hybrid-v1`, weight assumptions.
- Both `API_CONTRACT_PLAN.md`: hybrid mode/reasons.
- `EVALUATION_PLAN.md`: note hybrid is not quality-validated.

### Definition Of Done

- Hybrid orchestrates all components; normalization correct; explanations truthful; fallback works; `content-demo-v1` preserved; version stamped.

### Rollback Criteria

Disable `PERS_HYBRID`; `/me` reverts to preference/behavior/popularity components individually, then to `content-demo-v1` parity.

### Risks

- BR-032: weight drift undocumented. Mitigation: version-controlled weights + test.
- BR-033: explanation/score mismatch. Mitigation: explanation generated from normalized contributions.

### Decisions Still Requiring Approval

- Final component weights (proposed assumptions above).
- Minimum relevance threshold value.

---

## PERS-09: Integration, Migration, Regression Protection, Documentation Closure (BFP-16 / FFP-14)

### ID And Title

PERS-09 / BFP-16 (backend) + FFP-14 (frontend) — Full cross-repository integration, regression protection, and documentation closure.

### Status

Planned. Blocked by PERS-01 through PERS-08.

### Goal

Land the personalization system end-to-end with thin route handlers, pure scoring, repository separation, safe public response mapping, exact logging, idempotent feedback, indexes, cache invalidation, account-deletion cleanup, seed/MongoDB parity, safe failure, and full documentation.

### Why It Is Required

Each prior milestone is flag-gated. PERS-09 is the integration, hardening, and documentation closure that makes the system coherent and safe to enable.

### Current Implementation Gap

- Personalization is fragmented across flag-gated milestones; no end-to-end integration tests or closed documentation yet.

### Dependencies

- All PERS-01 through PERS-08.

### Non-goals

- Quality evaluation with sufficient evidence.
- Removing `content-demo-v1` or the old restricted route (both retained).

### Backend Changes

- Enforce thin route handlers (validate + authorize + call service + map safe response).
- Pure scoring functions in `src/lib/recommender/`; no MongoDB calls inside scoring.
- Repository separation maintained; services orchestrate repositories.
- Safe public response mapping (strip internal exclusions, object ids, raw signals).
- Exact recommendation logging (already present; verified across all new modes/versions).
- Algorithm versioning across every mode.
- Idempotent feedback writes (PERS-05).
- Indexes for popularity and profile reads.
- Cache invalidation on catalog change and subject writes.
- Account deletion cleanup includes feedback and any profile cache.
- Seed/MongoDB parity wherever supported; no silent fallback from explicit MongoDB to seed.
- No private state in public product routes.

### Frontend Changes (FFP-14)

- Authenticated users use `/api/recommendations/me`; anonymous visitors use the documented fallback.
- Recommendation loading does not start before auth restoration resolves.
- Sign-in changes the recommendation resource key; sign-out clears personalized recommendations.
- In-flight requests aborted on identity changes; stale responses cannot overwrite new-user results.
- Tracking queues flushed or discarded before identity changes.
- Recommendation attribution remains attached to cards and detail navigation.
- Preferences update and refresh recommendations safely.
- Negative feedback updates the displayed list.
- Distinct loading/empty/retry/partial/fallback states.
- Demo-profile language removed from true personalized surfaces; synthetic showcase accounts remain clearly labelled as demonstrations.
- Accessibility and responsive behavior covered.

### API Contract

Final consolidated contract for `/api/recommendations/me`, feedback routes, and the restricted old route, reflected in both `API_CONTRACT_PLAN.md` files.

### Data-Model Changes

- Consolidated additive indexes.
- Feedback collection live.
- Account deletion transaction final.

### Algorithm Or Business Rules

All modes and versions live; fallback ladder documented; `content-demo-v1` retained for regression.

### Privacy And Security Rules

- Full opt-out boundary enforced end-to-end.
- No PII in interactions; no private raw events in responses; no cross-user inference.
- Account deletion removes all personalization state.
- Recommendation logs and feedback retention documented (90-day logs; durable feedback).

### Edge Cases

Consolidated edge-case coverage from every milestone (see appendix). Notably:

- Identity and authorization: anonymous, expired, tampered, disabled, deleted, admin, seeded, MongoDB demo, registered, cross-user attempt, auth transition, multiple tabs, concurrent login/logout.
- Persistence and availability: MongoDB unavailable, seed mode, missing env vars, transaction failure, partial write, retry after timeout, cache corruption, migration interrupted, index missing, account deleted during ranking, product changed during ranking.
- Privacy: tracking opt-out, no PII, no raw events in response, no cross-user inference, account deletion, TTL expiration, durable suppression vs expiring analytics, recommendation-log and feedback retention, synthetic data clearly labelled.

### Failure And Recovery Behavior

Every mode fails safe to the next ladder rung; explicit MongoDB mode never silently serves seed; seed mode serves cold-start/anonymous fallback.

### Migration Strategy

Follow the release pattern in the appendix. Cross-repository release order: backend models/repositories first, then identity, then endpoint, then profile, then preference, then feedback, then behavioral, then popularity, then hybrid, then frontend switch-over, then restrict legacy paths last.

### Tests

- Backend integration: session-owned identity, cross-user denial, route validation, preference filtering/scoring, feedback persistence/undo, behavioral aggregation/recency/dedup/saturation, popularity aggregation/smoothing/diversity, hybrid normalization/missing-component/tie-break, explanation correctness, fallback ladder, algorithm versioning, recommendation logging, account-deletion cleanup, seed/MongoDB parity, database failure paths, migration/index verification.
- Frontend integration: auth restoration before load, authenticated endpoint selection, anonymous fallback, sign-in refresh, sign-out cleanup, stale-response prevention, preference-edit refresh, feedback submission/undo, error recovery, loading/empty states, fallback labels, reason rendering, accessibility, keyboard, mobile, attribution, tracking opt-out, cross-tab/storage behavior.
- End-to-end (both repos running together): registered account with preferences; showcase demo accounts with distinct deterministic profiles; rating changes recommendation input; wishlist/cart affect profile per rules; not-interested removes and suppresses; already-own excludes without implying dislike; anonymous user receives popularity/catalog fallback; one account cannot access another's profile-derived results; historical `content-demo-v1` behavior remains testable; admin and checkout functionality do not regress.
- Synthetic fixture tests are never called recommendation-quality evaluation.

### Documentation Updates

- Both `FUTURE_IMPLEMENTATION_PLAN.md`: PERS rows integrated.
- Both `ROADMAP.md`, both `TASK_BACKLOG.md`: PERS tasks.
- Both `API_CONTRACT_PLAN.md`: final contracts.
- Both `DATA_MODEL_PLAN.md`: feedback collection, indexes.
- Both `RECOMMENDER_SYSTEM_PLAN.md`: final algorithm.
- Both `PROJECT_CONTEXT.md`, `PRODUCT_REQUIREMENTS.md`/`BACKEND_REQUIREMENTS.md`: honest personalization scope.
- Both `DECISION_LOG.md`: all PERS decisions.
- Both `RISK_REGISTER.md`: all PERS risks.
- Both `SETUP_LATER.md`: post-personalization deferred items.
- `PRESENTATION_NOTES.md`: honest updated wording (still no quality claim).
- Both `README.md`: register the new plan doc.
- `CLAUDE.md`/`AGENTS.md`: only if project instructions genuinely need updating.
- `implementation_plan_order.txt`: PERS sequence appended.

### Definition Of Done

- All milestones integrated behind coherent flags; end-to-end tests pass; documentation closed and consistent; honesty constraints hold; no quality claim made; `content-demo-v1` and old route retained and restricted.

### Rollback Criteria

- Each flag disables independently; full rollback returns the storefront to `content-demo-v1` demo behavior; no destructive data migration was performed, so rollback needs no data restore.

### Risks

- BR-034 / FR-017: Integration exposes a cross-repo contract gap. Mitigation: shared contract tests in both repos.
- BR-035: Documentation drift after integration. Mitigation: documentation-closure checklist in Definition of Done.

### Decisions Still Requiring Approval

- Whether to enable any PERS flag by default at PERS-09 closure, or leave all off pending a separate enablement decision (proposed: leave off; enable in a separate explicit step).

---

## Edge-Case Appendix (Consolidated)

Every case below is covered by at least one milestone's tests.

- Identity and authorization: anonymous request; expired session; tampered session; disabled account; deleted account; admin account; seeded environment account; MongoDB demo account; registered account; cross-user request attempt; auth transition during request; multiple tabs; concurrent login/logout.
- Preferences: empty preferences; partial onboarding; conflicting favorite and disliked genres; minimum budget greater than maximum budget (rejected at validation); unsupported condition; unsupported format; preference edits during ranking; preference deletion; no matching products; extremely narrow preferences; missing product metadata.
- Behavior: duplicate events; out-of-order events; clock skew; replayed events; refresh-generated views; bot-like event volume; add/remove cycles; rating changes; rating deletion; passive tracking disabled; anonymous-to-authenticated transition; guest-state merge retry; interaction references deleted product; interaction references unknown recommendation list.
- Negative feedback: duplicate dismiss; undo twice; dismiss already-deleted product; already-owned item becomes unavailable; conflict between rating 5 and not-interested; conflict between already-own and low rating; item-level dislike versus genre preference; feedback submitted while request is refreshing; network failure after optimistic removal.
- Popularity: no events; one event; one user dominating counts; synthetic demo traffic; old events; removed ratings; deleted products; out-of-stock products; new catalog products; same artist dominating; cached score becoming stale.
- Hybrid: missing component score; all component scores equal; negative total score; one component dominating due to scale; no candidate after hard filtering; duplicate releases; stable ordering; weight changes; rollback; historical logs from older versions; explanation does not match actual score.
- Persistence and availability: MongoDB unavailable; seed mode; missing environment variables; transaction failure; partial write; retry after timeout; cache corruption; migration interrupted; index missing; account deleted during ranking; product changed during ranking.
- Privacy: tracking opt-out; no PII in interactions; no private raw events in recommendation response; no cross-user inference; account deletion; TTL expiration; durable suppression versus expiring analytics; recommendation logs and feedback retention; synthetic data clearly labelled.

## Test And Verification Plan

Deterministic synthetic fixtures and labelled classroom demo profiles only. No real-user data, no user studies, no quality claims, no completion of the evidence threshold.

- Backend unit/integration tests per milestone as listed.
- Frontend unit/component/e2e tests per milestone as listed.
- End-to-end integration tests with both repos running (PERS-09).
- Synthetic fixture tests are never labeled recommendation-quality evaluation.
- The offline evaluator is preserved and remains `insufficient-evidence`; it is not part of this roadmap.

## Migration And Rollout Plan

Each stage is reversible. Recommended release pattern:

1. Add identity enforcement and tests (PERS-01, completed 2026-07-10).
2. Add the new endpoint with current-behavior parity and switch the auth-gated frontend (PERS-02, completed 2026-07-10).
3. Add data models, repositories, and profile construction without changing live ranking (PERS-03 behind a flag).
4. Add preference ranking behind a flag (PERS-04).
5. Add negative feedback (PERS-05).
6. Add behavioral ranking behind a flag (PERS-06).
7. Add popularity baseline (PERS-07).
8. Add hybrid mode behind a flag (PERS-08).
9. Complete cross-repository hardening and documentation closure (PERS-09).
10. Retain rollback to `content-demo-v1`.
11. Keep the legacy route restricted and never private.

Rules: schema migrations additive and dry-run-verified; no destructive migration without export; feature flags per milestone; algorithm-version flags; route rollout behind flags; frontend switch-over after endpoint stability; backward compatibility maintained; old route deprecation documented; cache invalidation on writes; rollback procedure per milestone; seed-mode and MongoDB-mode verification; cross-repository release order backend-first.

## Decision Register (Recorded Or Proposed)

Recorded at PERS-00:

- BDEC-016 / FDEC-011 — Personalization architecture freeze (endpoint, durable-vs-TTL, opt-out split, version/mode names, profile recompute-on-demand, normalization, hybrid weight assumptions, demo account labelling).

Recorded across milestones:

- BDEC-017 — Profile recompute-on-demand; explicit-vs-passive opt-out split.
- BDEC-018 — Durable feedback authoritative source; pessimistic vs optimistic create.
- BDEC-019 — Opt-out split between passive and explicit; behavioral aggregation assumptions.

PERS-00 through PERS-02 resolved opening personalization after FFP-08, the `/api/recommendations/me` name, the explicit-functional-action versus passive-tracking opt-out model, administrator rejection, limit 12, auth gating/provider order, and default-on reversible identity/endpoint flags. Decisions still requiring approval belong to later milestones: hard-vs-soft preference defaults, pessimistic feedback creates, initial popularity variant/window, initial hybrid weights, and final closure defaults.

## Honesty Contract

No milestone, doc, test, or UI copy may claim measured recommendation quality, real-customer personalization (beyond the authenticated session-owned ranking defined here), or that behavior tests equal quality evidence. Synthetic fixtures and showcase accounts are clearly labelled as demonstrations. The existing `insufficient-evidence` evaluator status and its evidence threshold are unchanged and not completed by this roadmap.
