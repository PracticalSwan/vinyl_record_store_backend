# Personalization Implementation Plan (Backend)

This roadmap converts the existing deterministic demo recommender into a genuine personalized recommender system for the Vinyl Record Store (CSX4207). PERS-00 through PERS-05 were implemented on the `feat/personalization-pers-03-05` branches on 2026-08-10, and PERS-06 through PERS-08 were implemented on the `feat/personalization-pers-06-08` branches on 2026-08-10; all new personalization flags remain default-off. DATA-00 through DATA-15 were re-verified with the final lifecycle evidence on 2026-08-08. PERS-09 remains deferred and was not implemented or used to authorize dataset changes.

This plan is scheduled AFTER the entire existing documented roadmap: BFP-07 (admin backend), FFP-07 (admin frontend), FFP-08 (simulated checkout), and any backend support already planned for the simulated checkout. It does not reorder, replace, remove, or silently redefine any existing BFP/FFP plan. BFP-05 (recommender algorithm selection) remains its own on-hold placeholder; PERS-00 records the method decision that resolves BFP-05's open question without reusing the BFP-05 ID.

Audience: the developers implementing the Next.js backend and the frontend developers consuming its contracts.

Source of truth for current state: live backend source, `PROJECT_CONTEXT.md`, `API_CONTRACT_PLAN.md`, `DATA_MODEL_PLAN.md`, `RECOMMENDER_SYSTEM_PLAN.md`, `EVALUATION_PLAN.md`, and the matching frontend personalization plan. Re-verify every file path, constant, and enum against the source before implementing any milestone.

## DATA-15 Adaptation Gate (2026-08-08)

The active MongoDB catalog is immutable `amazon-reviews-2023-cds-vinyl-5core-v3`: 2,305 source-derived vinyl products and 20,288 historical ratings from 2,387 HMAC-pseudonymous subjects. V1, v2, the 116-record legacy catalog, `content-demo-v1`, and exactly three showcase customers remain intact. The final artwork decision set is 208 accepted, 6 ambiguous, 2,091 unresolved, and 0 errors, with 208 accepted local fallbacks. V3 adds authoritative MusicBrainz release-group first-release-date enrichment for the 208 accepted products (208 of 2,305 products now have a non-null original-release year, versus zero in v2). `dataset:evaluation:readiness` reports 1,708 eligible historical subjects, but no ranking model or quality experiment was run.

The remaining PERS milestones are revised as follows:

- PERS-03 is server-internal and adds no public profile/source fields. Historical pseudonyms and historical rating rows never enter the live customer profile or API.
- PERS-04 must handle nullable artist/genre/format/price/stock without inventing preferences or commercial facts. It must name whether ranking uses the active version.
- PERS-05 through PERS-06 are implemented as live-account features; neither writes into or reinterprets `historicalAmazonRatings`.
- PERS-07 production planning may use aggregate historical ratings only for the exact active dataset; offline evaluation remains a separate train-only code path and must not reuse all-split production counts.
- PERS-08 must score one shared active candidate set, keep live personalized evidence separate from aggregate historical popularity, and never map historical subjects to app users.
- PERS-09 remains a separately deferred integration/closure milestone. This batch performs no dataset lifecycle write and does not claim its verification work.

Historical-data `ready` status does not satisfy the live evidence threshold and does not authorize Precision@k, Recall@k, MAP@k, NDCG@k, or a personalization claim. Future implementation requires a new explicit user request after this gate is revalidated.

## PERS-04 Through PERS-09 Re-review (2026-08-09)

This revision is authoritative when older wording in this document conflicts with it.

- Keep the existing public product-to-product content similarity route unchanged. Do not add collaborative filtering, SVD, matrix factorization, or another learned model in this roadmap. The historical matrix has only 20,288 ratings across 2,387 subjects × 2,305 products (about 0.37% density) and the live app has only three showcase customers. Item-item CF is technically possible without identity mapping, but it would add a second historical model/artifact/evaluation path for limited project value; user-user CF cannot use historical subjects as live app identities.
- PERS-04 is a knowledge-based preference scorer, not a hard-filter engine. The current UI says disliked genres are genres the user would "rather avoid"; therefore favorite/disliked genres, favorite artists, and formats are scoring signals. Budget/condition are used only when the active catalog actually exposes commercial fields. Research-only null commercial fields are neutral.
- PERS-05 is cross-cutting exact-item feedback, not a separate recommender. Initial scope is `not-interested`, `already-own`, and undo. `show-fewer-like-this` is deferred because it requires an additional similarity-policy decision and duplicates the later behavioral-affinity logic.
- PERS-06 builds one bounded content-affinity score from the customer's current durable state plus weak, opt-in passive events. Wishlist/cart removals remove prior positive state; they are not negative taste. Search text is not stored, so `search_submit` cannot infer artist/genre taste. Under tracking opt-out, direct rating/wishlist/cart/feedback features still work, but analytics mirrors are absent.
- PERS-07 uses aggregate `historicalAmazonRatings` for the candidate set's exact dataset key as the production popularity fallback in MongoDB research mode. Rank primarily by rating count, then mean rating, then mapped public `product.id`. Historical user keys never leave the repository layer. Seed/legacy mode or missing historical evidence uses the deterministic catalog fallback. Do not build a second live-event popularity pipeline or cache collection unless profiling proves it necessary.
- PERS-08 has only three possible user-list score components: preference, behavioral affinity, and historical popularity. It blends scores only when preference + behavior are both available; popularity joins that true hybrid when available. Otherwise the response uses the pure lower component. Negative feedback is an exclusion rule, and product-to-product content similarity stays separate.
- Each component returns a complete deterministic score map already bounded to `[0,1]`; hybrid code must not run a second min-max normalization. Weight renormalization occurs only inside a true hybrid, never to mix popularity into a lower `preference-profile` or `behavior-profile` result.
- PERS-09 integrates and verifies the above; it does not change or re-import DATA-15, does not create a new dataset version, and does not claim quality metrics. V3 must remain active, v2 rollback and v1 identity-base must remain verifiable, the legacy 116 products and exactly three showcase customers must remain intact.

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
- Collaborative filtering, SVD/matrix factorization, and learned ranking. User-user CF has no live identity bridge; item-item CF is technically possible from the sparse historical matrix but would require an additional historical model/artifact/evaluation pipeline that is unnecessary for this project scope. They are not added merely to make the project appear more advanced.

The project may use deterministic synthetic fixtures and clearly labelled classroom demo profiles for development and testing. Synthetic data must never be presented as real evaluation evidence.

The existing live evaluator, interaction logging, recommendation logging, algorithm versioning, privacy boundaries, and isolated historical readiness adapter are preserved so a separately approved evaluation can be performed later. "Evaluation with sufficient evidence" is not part of this roadmap.

## Current State (Re-Verified Against Source On 2026-08-08)

These facts were verified by reading the source, not by trusting doc status tables. Implementation agents must re-verify before editing.

- The legacy route `GET /api/recommendations/user/[userId]` validates the URL but immediately maps it to an explicit demo or generic cold-start descriptor. Only `demo-user` selects the synthetic profile; every other ID produces identical cold-start ranking and cannot read private state. `PERS_IDENTITY_STRICT` defaults on, rejects administrators, and keeps any resolved customer session limited to logging ownership.
- `GET /api/recommendations/me` is implemented behind the default-on `PERS_ME_ENDPOINT` rollback flag. It derives a verified customer descriptor from the signed session, rejects administrators, serves the default-off preference branch only when enabled and applicable, and otherwise serves `cold-start` or `anonymous-fallback`; the response never exposes a customer ID.
- The product-similarity route is `GET /api/recommendations/product/[id]` (`src/app/api/recommendations/product/[id]/route.js:6`). It does not read the session at all.
- The literal `"demo-user"` is isolated to `legacyRecommendationSubject`; `recommendForUser` accepts only validated subject descriptors. Verified customers still use cold-start item ranking, so PERS-02 changes identity ownership and mode labelling without activating preference or behavioral personalization.
- The content-based weights are `sameArtist 6, sameGenre 4, sameDecade 2, sameLabel 1, preferredGenre 2` with stock boosts `in 1, low 0.5, out excluded` (`src/lib/recommender/contentBased.js:6-14`). The artist cap is 2 (`diversify`, `contentBased.js:49-62`).
- The algorithm version label is `content-demo-v1` from `RECOMMENDER_ALGORITHM_VERSION` (`contentBased.js:4`).
- The hard-coded demo profile is `purchasedIds [1], wishlistIds [2,3,4], favoriteGenres [Jazz, Soul, Electronic, Folk]` (`contentBased.js:16-20`).
- The User preferences schema has `favoriteGenres, dislikedGenres, favoriteArtists, budget.{min,max}, conditions, formats, completedAt, schemaVersion` (`src/models/User.js:10-33`). These fields are validated and persisted; the default-off preference branch reads them through the server-internal profile service.
- The interaction type enum has 16 values (`src/models/constants.js:17-34`): `recommendation_impression, recommendation_click, recommendation_wishlist_add, recommendation_cart_add, recommendation_dismiss, product_view, wishlist_add, wishlist_remove, cart_add, cart_remove, cart_quantity, rating_set, rating_remove, search_submit, search_result_click, demo_checkout_complete`. `recommendation_dismiss` exists but is write-only telemetry; no code reads it back.
- The recommendation log schema is `requestId, listId, subjectType, subjectId (select:false), mode, algorithmVersion, sourceProductId, excludedProductIds, surface, items[{productPublicId, score, rank, reasons}], servedAt, expiresAt` with a 90-day TTL (`src/models/RecommendationLog.js:15-47`).
- Ownership for all write routes comes from `requireSession(request)`, never from a body or URL value (`src/lib/auth/requireSession.js`). `resolveSessionSubject` rejects missing, inactive, and role-mismatched subjects (`src/services/auth.js:103-114`).
- The exact-origin check is `assertMutationOrigin` reading `FRONTEND_ORIGIN` (`src/lib/request.js:9-15`). The interaction cap is 120 events/minute/identity (`src/lib/interactionCap.js`).
- The tracking opt-out header `x-tracking-enabled: false` suppresses recommendation logging only (`src/services/recommendations.js:24-25`). It does not suppress interaction persistence. This is an open gap that PERS-06 closes.
- Data source selection never silently falls back from explicit MongoDB to seed (`src/lib/db/dataSource.js:8-22`).
- The offline evaluator requires 20 subjects with 5 positives, currently reports `insufficient-evidence`, uses random/popularity/content-based baselines with leave-one-out, and is decoupled from the live ranker except for the pure function `rankCatalogFromHistory` (`src/lib/recommender/offlineEvaluation.js`, `evaluationDataset.js`, `scripts/evaluate-recommender.mjs`).
- Account deletion removes user, wishlist, cart, ratings, interactions, recommendation logs (`subjectType:"user"`), guest-merges, and feedback in one transaction (`src/repositories/accountRepository.js:24-43`).

## Dependency-Safe Milestone Order And ID Mapping

Each PERS milestone maps to the next unused backend and/or frontend plan IDs. The order is fixed; it is changed only if a source audit during PERS-00 proves a different order is required, and any change must be explicitly justified in PERS-00.

| Milestone | Title | Backend subplan | Frontend subplan |
| --- | --- | --- | --- |
| PERS-00 | Audit and decision freeze | (decisions BDEC-016, risks BR-020/BR-021) | (decision FDEC-011, risks FR-013/FR-014) |
| PERS-01 | Proper identity enforcement | BFP-08 | (contract tests only) |
| PERS-02 | Session-owned signed-in-user endpoint | BFP-09 | FFP-09 |
| PERS-03 | Unified recommendation profile and feedback domain | BFP-10 | (no frontend change) |
| PERS-04 | Preference-aware ranking | BFP-11 | FFP-10 |
| PERS-05 | Negative-feedback capture and durable suppression | BFP-12 | FFP-11 |
| PERS-06 | Behavioral-signal personalization | BFP-13 | FFP-12 |
| PERS-07 | Popularity baseline and fallback | BFP-14 | (consumed via API) |
| PERS-08 | Hybrid recommendation orchestration | BFP-15 | FFP-13 |
| PERS-09 | Cross-repository integration, migration, regression protection, documentation closure | BFP-16 | FFP-14 |

Backend uses BFP-08 through BFP-16. Frontend uses FFP-09 through FFP-14. Do not reuse IDs already allocated by later admin/dataset work. This plan reserves BDEC-027 through BDEC-031 for PERS-03/05/06/07/08 and registers BR-037 for PERS-06. The next unreserved supporting IDs are B-027 / F-025, BDEC-032 / FDEC-018, and BR-038 / FR-030. Existing PERS task/risk IDs stay as already registered; allocate a new ID only for a genuinely new item.

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
- Durable account state: preferences, ratings, wishlist, cart, and explicit exact-item feedback (`not-interested`, `already-own`). `show-fewer-like-this` is deferred.
- TTL-limited analytics (90-day, existing): impressions, views, clicks, and privacy-safe search events.
- Explicit functional actions remain authoritative in their own repositories. They may also produce analytics events while tracking is enabled, but ranking correctness never depends on those duplicate analytics rows. Passive analytics honor tracking opt-out.
- Tracking opt-out suppresses passive analytics entirely, including persistence. Rating/wishlist/cart/feedback routes still work because they are user-requested account features, not tracking.
- Demo and showcase accounts remain clearly labelled demonstrations; do not fabricate behavioral history or historical-user identity links for them.
- The recommendation profile is recomputed on demand per request. No permanently stored derived profile unless measured cost later justifies it.
- Preference, behavioral, and popularity components each return deterministic scores bounded to `[0,1]`. BDEC-016's generic weight-renormalization rule is refined by planned BDEC-031: renormalize only inside a true preference+behavior hybrid (popularity optional); lower component modes remain pure. No second min-max pass is allowed.
- Algorithm version names: keep `content-demo-v1` for regression; add `preference-profile-v1`, `behavior-profile-v1`, `popularity-v1`, `personalized-hybrid-v1`. Cold-start stays a mode, not a version.
- Algorithm modes: `demo-profile`, `cold-start`, `preference-profile`, `behavior-profile`, `popularity`, `personalized-hybrid`, `content-similarity` (product), `anonymous-fallback`.
- Candidate eligibility excludes soft-deleted products and exact items suppressed by PERS-05. Stock is an eligibility rule only when the active catalog has a non-null commercial stock field; research-only missing stock is neutral. Preference fields are not silently converted into hard constraints.
- Explanations remain truthful and are generated from actual score contributions and filters.
- Account deletion removes all durable customer personalization state. It already removes interactions and recommendation logs; PERS-03/PERS-05 add feedback cleanup. No derived profile/popularity cache collection is planned initially.

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

Implemented on 2026-08-10 behind `PERS_PROFILE_DOMAIN=false` by default. PERS-03 changes no live ranking; it creates the profile/feedback domain consumed by PERS-04+.

### Goal

Build one bounded, server-internal source-state profile from saved preferences, current ratings/wishlist/cart, exact feedback, and optional recent passive interactions. Keep repository reads in one service and keep all scoring rules in PERS-04/PERS-06.

### Why It Is Required

Personalization needs one authoritative profile. Before this batch, preferences were inert, dismissal was write-only, and there was no feedback collection. The implemented domain prevents PERS-04 through PERS-08 from independently re-reading repositories and producing inconsistent profiles.

### Current Implementation Gap

The PERS-03 gap is closed: the profile-construction service, durable exact feedback collection, flag-gated preference reads, and passive-analytics/direct-action split are implemented. `show-fewer-like-this` remains deferred beyond the initial roadmap.

### Dependencies

- PERS-02 endpoint and subject descriptor.
- Existing preferences, interactions, wishlist, cart, ratings repositories.

### Non-goals

- Permanently storing a derived profile (recompute on demand unless proven insufficient).
- Changing live ranking output (consumed in PERS-04+).
- Adding collaborative filtering.

### Backend Changes

- Add `src/lib/recommender/recommendationProfile.js` with pure `buildRecommendationProfile({ subject, preferences, ratings, wishlist, cart, feedback, interactions })`. Return only bounded normalized source state needed later: `{ explicitPreferences, ratings, wishlist, cart, explicitFeedback, passiveInteractions }`. Do not query the catalog, pre-score preferences/behavior, or add public completeness/source-flag fields in PERS-03.
- Add `src/services/recommendationProfile.js` as the only account-state repository orchestrator. It receives the verified session subject plus `{ trackingAllowed, feedbackAllowed }`; it always reads preferences/ratings/wishlist/cart, reads feedback only when `feedbackAllowed === true`, and calls the pure builder with an empty feedback list otherwise. When `trackingAllowed === true`, also read at most 500 recent interaction rows for that exact `userPublicId`; otherwise do not query interactions. Do not load product/catalog metadata here: PERS-04/PERS-06 must join profile product IDs against the one active candidate set already loaded by the recommendation service.
- Add `src/models/Feedback.js` (durable user feedback collection): fields `userPublicId, productPublicId, kind ("not-interested"|"already-own"), createdAt, updatedAt, schemaVersion`. Unique compound `(userPublicId, productPublicId)` so one product has one current feedback intent per customer; changing kind replaces the prior kind instead of storing contradictory rows. Not TTL-limited. Do not add `show-fewer-like-this`, free-text reason, or broad scope in the initial schema.
- Add `src/repositories/feedbackRepository.js` and `src/services/feedback.js` (validation, authorization, idempotent upsert, undo).
- Extend `src/repositories/userStateRepository.js` with one read-only `listRecentInteractions(userPublicId, limit = 500)` method. Filter by the verified `userPublicId`, sort by `occurredAt DESC` with `receivedAt DESC` as the tie-break, and cap the limit at 500. The existing `{ userPublicId: 1, occurredAt: -1 }` index is the initial query path; add no new index unless `explain()` later proves it necessary.
- Extend `src/repositories/accountRepository.js` deletion transaction to also remove the feedback collection.
- Do not require new interaction types for ranking correctness. The feedback collection is authoritative. If an attributed analytics mirror is retained, reuse/extend interaction enums only under tracking-enabled analytics and make that write best-effort; feedback success must not depend on it.

### Frontend Changes

No frontend change in PERS-03. The profile domain remains server-internal until later ranking milestones consume it; keep the existing recommendation response shape unchanged.

### API Contract

No public API change in PERS-03. Do not expose the unified profile, source flags, raw signals, or source counts. Existing `/me` response fields remain unchanged until a later ranking milestone needs a documented user-facing mode/reason.

### Data-Model Changes

- New `feedback` collection (durable, no TTL) with only the two initial exact-item kinds.
- Extend `accountRepository` deletion to remove feedback in the existing transaction.
- Do not add guest feedback, feedback migration, or ranking-required interaction enums in PERS-03. Initial feedback is an authenticated account feature; any analytics mirror is optional and belongs to PERS-05.

### Algorithm Or Business Rules

PERS-03 returns normalized source state, not a universal weighted `signals[]` schema. PERS-04 owns preference weights; PERS-06 owns behavioral polarity/weights/caps. This prevents the profile layer from encoding two algorithms' scoring rules.

Data classification:

- Durable user state: preferences, ratings, wishlist, cart, explicit feedback.
- Passive interaction analytics: existing 90-day TTL interaction rows; tracking opt-out may make them absent.
- Derived profile data: recomputed per request and never persisted.
- No profile cache in the initial implementation. Add one only after measured request cost and explicit invalidation rules justify it.

PERS-03 does not invent a second state machine. Ratings, wishlist, cart, preferences, and feedback are read from their current authoritative repositories. Feedback replay protection is the unique/idempotent `(userPublicId, productPublicId)` upsert; writing the other allowed kind replaces the current intent. Return only a bounded recent passive-interaction slice for PERS-06; PERS-06 owns its event dedup/caps and attribute aggregation.

For passive rows, keep the validated `occurredAt` timestamp for recency and use server-owned `receivedAt` only as a stable tie-break. PERS-03 does not query the catalog or decide whether a product is still active; PERS-04/PERS-06 drop unknown/inactive references when they join this profile to the request's active candidate map. Wishlist/cart removal is represented by absence from current durable state, not by a negative profile signal. PERS-03 does not resolve cross-source conflicts.

### Privacy And Security Rules

- When `/me` receives `X-Tracking-Enabled: false`, the profile service does not query/use passive interaction rows.
- Current durable preferences/ratings/wishlist/cart/feedback remain available regardless of analytics opt-out because they are direct account state, not passive tracking.
- The unified profile object never leaves the server. PERS-03 adds no new public summary/source-flag fields.
- Feedback is owned by the session subject; cross-user writes are rejected.

### Edge Cases

- Deleted/unknown products may remain as internal IDs in the source-state profile; PERS-05/PERS-06 must ignore them when joining to the active candidate map. Never expose those IDs/counts publicly.
- Rating replacement/deletion and current wishlist/cart membership come from their authoritative repositories; PERS-03 does not replay event history to reconstruct them.
- Rating 5 + not-interested can coexist in source state. PERS-05 owns exact suppression; PERS-06 owns how both affect attribute affinity.
- Guest feedback does not exist in the initial scope, so guest-state merge has nothing to migrate for feedback.
- Showcase reset behavior stays whatever `db:seed:users:apply` already defines; PERS-03 does not fabricate additional interaction history.

### Failure And Recovery Behavior

- In explicit MongoDB mode, a required profile repository failure returns `PERSISTENCE_UNAVAILABLE`; preferences are stored in the same persistence boundary, so do not invent a preferences-only fallback when MongoDB is unavailable.
- Feedback upsert/delete is a single-document atomic operation and idempotent; no transaction is needed for that write. Account deletion remains transactional across all owned collections.

### Migration Strategy

- Add model/repository/service behind `PERS_PROFILE_DOMAIN`; no live ranking consumption in PERS-03.
- Create only the feedback uniqueness/lookup indexes required by its schema; no backfill because feedback is created on demand.
- Extend the existing account-deletion transaction with feedback cleanup and verify rollback on failure.

### Tests

- `tests/recommendation-profile.test.mjs`: pure builder receives preferences/ratings/wishlist/cart/feedback/passive rows; service reads feedback only when `feedbackAllowed` is true; service reads at most 500 interactions for the exact customer and reads none when tracking is off; ordering is `occurredAt` then `receivedAt`; current durable state remains; no catalog query/scoring occurs; output has no algorithm weights or database object IDs.
- `tests/feedback-repository.test.mjs`: one-row-per-user/product uniqueness, same-kind idempotent upsert, kind replacement, repeated undo, cross-user rejection, account-deletion cleanup/rollback.

### Documentation Updates

- `DATA_MODEL_PLAN.md`: add the one-row-per-user/product feedback collection and document the non-persisted normalized source-state profile; no universal weighted signal schema.
- `RECOMMENDER_SYSTEM_PLAN.md`: document the profile domain.
- Both `API_CONTRACT_PLAN.md`: record that PERS-03 has no public profile-field change; feedback routes are documented only in PERS-05.
- Decision BDEC-027 (recorded 2026-08-10): recommendation profile is recomputed on demand; durable account state remains usable while passive analytics honor opt-out.

### Definition Of Done

- One service builds the profile; routes do not combine repositories.
- Feedback collection exists, idempotent, deleted with the account.
- Unified profile is recomputed and server-internal; PERS-03 adds no new public profile/source fields.
- Passive interaction reads are bounded and skipped under opt-out; durable account state remains available.

### Rollback Criteria

Disable `PERS_PROFILE_DOMAIN`. All dependent live profile features (preference ranking, exact feedback use, behavioral ranking, and hybrid) must become effectively disabled even if their raw environment flags are accidentally true; popularity may still operate independently. Leave any collected feedback rows intact and ignored; do not make rollback destructive.

### Risks

- BR-021: once a real profile exists, the legacy arbitrary-user route could become a private-profile leak. Mitigation: keep the PERS-01 identity contract test as a hard gate.
- BR-028 / FR-017: feedback cleanup is incomplete or the server-internal profile leaks into the public contract. Mitigation: transactional deletion tests plus response-contract tests proving no new profile/source fields are exposed.

### Decisions Still Requiring Approval

- None for feedback shape: initial feedback is fixed to `not-interested` and `already-own`; `show-fewer-like-this` is deferred.
- Profile cache remains out of scope initially. Add one only if measured request cost later justifies it and invalidation is explicit.

---

## PERS-04: Preference-Aware Ranking (BFP-11 / FFP-10)

### ID And Title

PERS-04 / BFP-11 (backend) + FFP-10 (frontend) — Knowledge-based preference-aware ranking using stored preferences.

### Status

Implemented on 2026-08-10 behind the fail-closed dependency `PERS_PROFILE_DOMAIN && PERS_PREFERENCE_RANKING`; both flags remain off by default and `content-demo-v1` is preserved when disabled.

### Goal

Use the customer's stored preferences as deterministic knowledge-based score signals over the active catalog, with truthful reasons and safe handling of research-only null fields.

### Why It Is Required

Preferences were persisted but inert before this batch. PERS-04 is the first live ranking change and uses only preference semantics the current UI actually collects.

### Current Implementation Gap

The PERS-04 gap is closed behind `PERS_PROFILE_DOMAIN && PERS_PREFERENCE_RANKING`: the ranker reads the server-internal profile, uses null-safe soft signals over one active candidate set, and does not score release era or availability fields.

### Dependencies

- PERS-03 profile domain (preferences portion).

### Non-goals

- Behavioral signals (PERS-06), popularity (PERS-07), hybrid (PERS-08).
- Changing the product-similarity route's content-based logic.

### Backend Changes

- Add `src/lib/recommender/preferenceRanking.js` with pure `scorePreferenceCandidate(product, preferences, catalogMode)`, `scorePreferenceCandidates(candidates, preferences, opts)`, and `rankByPreferences(candidates, preferences, opts)`. `scorePreferenceCandidates` returns request-level `available` plus a score/reasons entry for every candidate and never truncates/applies diversity; `rankByPreferences` uses that complete score map, then sorts/applies the artist cap for the standalone `preference-profile` mode. No repository or environment access inside this module.
- Wire it into `src/services/recommendations.js` only for the session-owned `/me` path, behind `PERS_PREFERENCE_RANKING`. Use mode `preference-profile`, version `preference-profile-v1`.
- Keep `GET /api/recommendations/product/[id]` and `content-demo-v1` unchanged.
- Reuse the current artist cap of 2 only in the standalone ranked list. Tie-break by mapped public product ID (`product.id`), then title.

### Frontend Changes (FFP-10)

- Surface `preference-profile` honestly.
- Do not force a recommendation reload from `ProfilePreferencesPage` or onboarding. The current `CatalogProvider` loads recommendations only on `/` and `/recommendations`; those preference routes have no active recommendation resource. When the user later enters a recommendation surface, the existing route/resource-key effect performs a fresh `/me` request with the saved preferences. Do not couple `AuthProvider` to catalog state.
- Do not add relaxation UI; PERS-04 has no user preference that means "hard filter".

### API Contract

`/me` may return `mode: "preference-profile"` with reasons such as `Matches your Jazz preference.`, `Matches an artist you selected.`, or `You prefer this format.` Budget/condition reasons are allowed only in `commerce-preview` when the product and preference fields are both non-null. Raw weights are never exposed.

### Data-Model Changes

None. Use the existing User preference schema exactly: `favoriteGenres`, `dislikedGenres`, `favoriteArtists`, `budget`, `conditions`, `formats`.

### Algorithm Or Business Rules

1. Read one active-catalog candidate set from the catalog repository. Never mix v1/v2/v3 rows.
2. Repository soft-delete filtering stays authoritative. If a commercial candidate has `stock === "out"`, exclude it; `stock === null` in research mode is neutral.
3. Build at most six request-level preference groups: favorite genre, disliked genre, favorite artist, format, budget, condition. Values inside one list are alternatives, not separate denominator entries: a candidate matching any selected favorite genre receives that group's one positive weight, not one weight per selected genre. Compare `product.genre`, `product.artist`, and `product.format` by trimmed, case-insensitive exact value; artist matching is never substring/regex. The current `toPublicProduct` candidate shape exposes the primary `genre` only, not raw `genres[]`, so use that primary genre and do not widen the public product contract. Remove any normalized genre appearing in both favorite/disliked sets from both before deciding whether those groups are active. A disliked-genre group is a bounded negative score, never an exclusion. Budget/condition groups are active only outside research-only mode. Budget matches when non-null `product.price` falls inclusively within the saved bounds (missing min = no lower bound; missing max = no upper bound). Condition matches when non-null `product.condition` is in the selected condition set.
4. Do not score release era, availability preference, label preference, or any field that the current preference schema does not contain.
5. Every active preference group contributes its absolute group weight once to the denominator for every candidate. A positive group match contributes `+weight`, a disliked-genre match contributes `-weight`, and a non-match/missing candidate field contributes `0`. This keeps null metadata neutral without making sparse records easier to score highly. Never turn null into zero-price, out-of-stock, or a fabricated category.
6. If no preference group is active, return `available: false`. Otherwise compute `raw = signedContributionSum / activeAbsoluteWeightSum` (bounded `[-1,1]`), then `score = clamp((raw + 1) / 2, 0, 1)`. After scoring the candidate set, return `available: false` if every candidate had zero signed contribution; preferences that match nothing must not produce a misleading `preference-profile` mode. Keep the six group weights in one versioned constants object.
7. `scorePreferenceCandidates` keeps all eligible candidates keyed by `product.id`. `rankByPreferences` sorts score DESC, `product.id` ASC, then title and applies artist cap 2 for the standalone mode. Recommendation reasons come only from positive contributions actually used; negative penalties affect score but must not be presented as a positive recommendation reason.
8. Empty/no-applicable preferences return the existing cold-start path in PERS-04. PERS-07/PERS-08 replace that fallback later; do not reference future components before they exist.

### Exact Implementation Order

1. Add pure scorer + unit tests.
2. Add service wiring + mode/version tests.
3. Update recommendation response validation/logging allow-lists for the new mode/version.
4. Update frontend mode/copy handling and add a navigation regression proving the next Home/Recommendations load uses the saved preferences; do not add an off-surface reload.
5. Run backend tests/lint/build, frontend tests/lint/build, then the existing auth/recommendation E2E path. Stop if product-similarity output changes.

### Privacy And Security Rules

- Preferences are durable account state; used regardless of opt-out (user-authored feature).
- No private data in explanations beyond what the user themselves set.

### Edge Cases

- Empty preferences, partial onboarding, conflicting favorite/disliked genres, `budget.min > budget.max` (rejected at validation already), unsupported condition/format, preference edits during ranking (next request picks up new prefs), preference deletion, no matching products, extremely narrow preferences, missing product metadata, null primary genre, unknown year/label, missing price, imported partial metadata.

### Failure And Recovery Behavior

- No applicable preference signal → return the current cold-start mode at this milestone.
- MongoDB unavailable in explicit MongoDB mode → return `PERSISTENCE_UNAVAILABLE`; never switch to seed.

### Migration Strategy

- Behind `PERS_PREFERENCE_RANKING`; default off.
- No schema or data migration.

### Tests

- `tests/preference-ranking.test.mjs`: each list field is one group (multiple selected values do not multiply denominator weight); positive genre/artist/format matches; disliked genre bounded penalty rather than exclusion; favorite+disliked overlap removed before group activation; inclusive min/max budget including one-sided bounds; condition-set membership; research-only budget/condition ignored; null metadata neutral; empty/no-applicable/no-matching preference fallback; complete score map before diversity; `[0,1]` bound; deterministic `product.id` tie-break; standalone artist cap; negative penalties never become recommendation reasons.
- Extend `/me`, recommendation logging, and frontend tests so the new mode/version is accepted without changing `content-demo-v1` or product similarity.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: preference-aware section, version `preference-profile-v1`.
- Both `API_CONTRACT_PLAN.md`: new mode and reason strings.
- Frontend `RECOMMENDER_SYSTEM_PLAN.md` / `UI_UX_PLAN.md`: mode label and refresh behavior.

### Definition Of Done

- Stored applicable preferences change authenticated `/me` ordering deterministically.
- Research-only null commercial fields never exclude or boost a product.
- Reasons match actual non-zero score contributions.
- No preference field is treated as a hard constraint unless the UI/API later adds explicit hard semantics.
- `content-demo-v1` and the product-similarity route are unchanged.

### Rollback Criteria

Disable `PERS_PREFERENCE_RANKING`; `/me` reverts to the existing cold-start/demo behavior without data rollback.

### Risks

- BR-023: research-only null fields or a missing preference signal distorts scoring. Mitigation: fixed request-level denominator plus null-neutral tests.
- BR-025 / FR-018: implementation semantics/copy drift from the current soft-preference UI or the frontend adds a useless off-surface reload. Mitigation: disliked-genre semantics, feature-aware copy, and a navigation test proving the next recommendation surface fetch is fresh.

### Decisions Still Requiring Approval

- Initial preference weights. Record them as versioned assumptions; do not call them learned or optimal.

---

## PERS-05: Negative Feedback (BFP-12 / FFP-11)

### ID And Title

PERS-05 / BFP-12 (backend) + FFP-11 (frontend) — First-class exact-item negative feedback: not-interested, already-own, and undo.

### Status

Implemented on 2026-08-10 behind `PERS_PROFILE_DOMAIN && PERS_NEGATIVE_FEEDBACK`; both flags remain off by default. Negative feedback composes with preference ranking when both effective flags are enabled.

### Goal

Make exact-item feedback durable and first-class so `/me` can exclude records the customer marked `not-interested` or `already-own`. Broader taste effects belong only to PERS-06.

### Why It Is Required

`recommendation_dismiss` exists but is write-only. Real personalization requires durable suppression and controlled negative evidence, with retention that survives analytics TTL.

### Current Implementation Gap

The PERS-05 gap is closed: durable exact-item feedback routes, exclusion wiring, and customer-only pessimistic controls with contextual Undo are implemented behind default-off flags. `recommendation_dismiss` remains analytics-only.

### Dependencies

- PERS-03 feedback collection.
- PERS-04 ranking (for composition).

### Non-goals

- Permanent broad genre suppression from a single item unless explicitly chosen.
- A persistent feedback-management/history API or screen. V1 Undo is contextual to the current confirmed card placeholder; no public feedback-list route is added.
- Treating already-own as a dislike.

### Backend Changes

- Feedback routes under `src/app/api/me/feedback/`:
  - `PUT /api/me/feedback/:productId` body `{ kind }`, where `kind` is only `not-interested` or `already-own`, → idempotent upsert; if the product already has the other kind, replace it.
  - `DELETE /api/me/feedback/:productId` → idempotently remove the current exact-item feedback, regardless of its kind.
- Do not add a public feedback-list route in v1. Ranking reads feedback internally through the repository; the card already knows the product id/kind needed for immediate Undo. A later feedback-management screen can add listing under a separate task if needed.
- Validate that the product exists in the active catalog before a new feedback write. If a previously valid product is later deleted/inactive, keep the durable row but ignore it during ranking.
- Add one shared `applyUserExclusions(candidates, feedback)` helper used by PERS-05 onward. Both feedback kinds exclude the exact item from `/me`; neither excludes an artist or genre.
- Retention is durable/no TTL and account deletion removes it via the PERS-03 transaction.
- Ranking correctness reads the `feedback` collection directly. An attributed analytics mirror may be emitted only when tracking is enabled; failure to write analytics must not fail the feedback action.

Semantics:

- `not-interested`: exact-item suppression. PERS-06 may use it as bounded negative taste evidence, but PERS-05 itself does not propagate the dislike to artist/genre.
- `already-own`: exact-item suppression and neutral-to-positive taste evidence for PERS-06; it is never a dislike.
- Ratings remain authoritative in `ratings`; PERS-05 does not duplicate rating semantics.
- `show-fewer-like-this` is deferred. Do not add its enum, route behavior, UI, test, or explanation in this milestone.

Storage decision: the dedicated PERS-03 `feedback` collection is authoritative. Preferences, ratings, wishlist, and cart remain separate authoritative sources.

### Frontend Changes (FFP-11)

- Add recommendation-card feedback with exactly `Not interested`, `Already own`, and `Undo`. Do not widen to product detail or add `Show fewer like this` in v1.
- Create is pessimistic: disable while pending. After durable success, replace that card locally with a compact `role="status"` message such as `Removed from recommendations.` plus `Undo`. Keep the same component mounted and move focus to Undo; do not reload merely to remove the card.
- Undo is pessimistic: after successful DELETE, restore the card locally and restore focus to the feedback control. If create/delete fails, keep the previous visible state/focus and show a recoverable error.
- Any later normal recommendation load is server-authoritative and will omit stored feedback items. Do not hand-rerank/refill the remaining list in the browser.
- Functional feedback does not depend on the analytics tracker; an optional tracking event may run only after durable success and only when tracking is enabled.

### API Contract

- `PUT /api/me/feedback/:productId` → `{ data: { productPublicId, kind } }`; idempotent for the same kind and replaces the other allowed kind for that product.
- `DELETE /api/me/feedback/:productId` → `{ data: { productPublicId, removed: boolean } }`; always safe to repeat. `removed` reports whether a current row existed; frontend correctness must not depend on it being `true`.
- No public `GET /api/me/feedback` in v1.
- Errors: `UNAUTHENTICATED`, `FORBIDDEN`, `INVALID_INPUT`, `NOT_FOUND`, `PERSISTENCE_UNAVAILABLE`.
- `/me` recommendations respect feedback in exclusions and re-ranking.

### Data-Model Changes

Uses PERS-03 `feedback` collection. No additional schema.

### Algorithm Or Business Rules

- Exact-item feedback suppression is the only PERS-05 hard user exclusion.
- `not-interested` and `already-own` suppress the same exact item from `/me`; they differ only as later taste evidence.
- There is at most one feedback row per customer/product. Writing the other allowed kind replaces the current kind; `applyUserExclusions` therefore needs only the set of feedback product ids.
- Conflict `rating 5 + not-interested`: exact item stays suppressed; PERS-06 may still use the rating as positive artist/genre evidence.
- No genre/artist propagation is implemented here. No recency decay or similarity penalty is needed in PERS-05.

### Privacy And Security Rules

- Feedback is durable account state, authored by the session subject.
- Available regardless of opt-out (functional feature).
- Auditability without exposing private data: interaction evidence stored without PII.

### Edge Cases

- Rapid duplicate create → one durable row; pending UI prevents duplicate requests.
- Undo twice → idempotent.
- Product becomes inactive after feedback was stored → keep the row but ignore the product during ranking.
- Rating 5 + not-interested → exact item remains excluded; PERS-06 may still use the rating as positive attribute evidence.
- Already-own + low rating → exact item remains excluded; PERS-06 treats the low rating as negative and already-own as non-negative evidence.
- Feedback while a recommendation request is in flight → the next request reflects it; existing frontend generation guards reject a stale older response.

### Failure And Recovery Behavior

- Feedback write/delete failure → return the existing safe API error; do not change visible state optimistically unless rollback is guaranteed.
- If required feedback state cannot be read in explicit MongoDB mode, return `PERSISTENCE_UNAVAILABLE`; never silently rank as if durable exclusions did not exist.
- Upsert/delete is idempotent, so retry is safe.

### Migration Strategy

- Additive routes + collection behind `PERS_NEGATIVE_FEEDBACK`.
- No destructive migration.

### Tests

- `tests/feedback.test.mjs`: customer-only authorization, only two allowed kinds, active-product validation, same-kind idempotent upsert, changing kind replaces the prior row, repeated undo returns safely with `removed: false`, since-deleted product ignored by ranking, account-deletion cleanup, analytics-mirror failure does not fail durable feedback.
- Extend recommendation tests: `not-interested` suppresses exact item; `already-own` suppresses exact item without negative reason; undo makes the item eligible again; `content-demo-v1` product similarity is unchanged.
- Frontend FFP-11: submission, undo, error recovery, loading/empty states, keyboard/mobile/screen-reader behavior. No `show-fewer-like-this` control.

### Exact Implementation Order

1. Confirm PERS-03 feedback model/repository exists and account deletion covers it.
2. Add/validate feedback service and routes; keep routes thin.
3. Add shared exact-item exclusion helper and wire it into `/me` after candidate loading and before scoring.
4. Add frontend API helpers and two feedback controls plus undo.
5. Add tests above; run both repos' tests/lint/build and the feedback E2E flow.

### Documentation Updates

- Both `API_CONTRACT_PLAN.md`: feedback routes.
- `DATA_MODEL_PLAN.md`: feedback authoritative-source decision.
- Frontend `UI_UX_PLAN.md`: control placement and states.
- Planned decision BDEC-028: durable exact-item feedback is authoritative; v1 uses only not-interested/already-own with pessimistic creates and idempotent undo. Record it in `DECISION_LOG.md` only when PERS-05 is implemented.

### Definition Of Done

- `not-interested`, `already-own`, and undo are durable, idempotent, customer-owned, removed on account deletion, and affect only exact-item eligibility in PERS-05.
- No `show-fewer-like-this` behavior or broad similarity penalty exists.

### Rollback Criteria

Disable `PERS_NEGATIVE_FEEDBACK`; routes return `NOT_FOUND` and `/me` ignores existing feedback for both exact exclusions and PERS-06 affinity. Existing durable rows remain stored but inert so rollback is non-destructive.

### Risks

- BR-024 / BR-028: feedback broadens beyond exact-item suppression or is not removed with the account. Mitigation: exact-public-id ranking tests plus transactional deletion coverage.
- FR-019 / FR-020: frontend feedback state diverges after failure or Undo becomes unreachable after suppression. Mitigation: pessimistic writes, keep the card mounted as a compact status+Undo placeholder after success, recovery tests, and keyboard/screen-reader checks.

### Decisions Still Requiring Approval

None for initial scope. `show-fewer-like-this` is a separately deferred enhancement, not part of PERS-05.

---

## PERS-06: Behavioral-Signal Personalization (BFP-13 / FFP-12)

### ID And Title

PERS-06 / BFP-13 (backend) + FFP-12 (frontend) — Behavioral content-affinity personalization from live customer state and opt-in passive events.

### Status

Implemented 2026-08-10 on `feat/personalization-pers-06-08`, behind default-off `PERS_BEHAVIORAL_RANKING`. The server opt-out backstop, pure scorer, `/me` wiring, and focused regression tests are complete; no quality claim is made.

### Goal

Build one deterministic `[0,1]` behavioral content-affinity score from the customer's current durable state plus weak passive interaction evidence that exists only when tracking is enabled.

### Why It Is Required

Ratings, wishlist, cart, and explicit feedback already express stronger intent than passive analytics. PERS-06 turns those live-account signals into artist/genre/format affinity without adding collaborative filtering or treating every event as equal.

### Current Implementation Gap

- Closed for the PERS-06 scope: live `/me` ranking can consume the bounded server profile when the flag is enabled.
- The interaction route now has a server-side exact `X-Tracking-Enabled: false` backstop; direct durable account actions remain separate.
- Persisted search events still contain only query length/rank, not search text, so `search_submit` remains excluded from taste evidence.

### Dependencies

- PERS-03 profile (behavioral portion).
- PERS-05 feedback semantics. Read feedback evidence only while effective `PERS_NEGATIVE_FEEDBACK` is enabled; stored rows are inert when that feature is rolled back.
- Existing interaction repository and recommendation-context attribution.

### Non-goals

- Treating all events as equally reliable.
- Using passive history when opt-out is active.
- Quality claims (still `insufficient-evidence`).

### Backend Changes

- Add `src/lib/recommender/behavioralProfile.js` with pure `buildBehaviorAffinity(profile, candidates, opts)`, `scoreBehaviorCandidates(candidates, affinity, opts)`, and `rankByBehavior(candidates, affinity, opts)` functions. `scoreBehaviorCandidates` returns request-level `available` plus one score/reasons entry for every candidate and never truncates/applies diversity; `rankByBehavior` uses that complete map and applies standalone sorting/artist cap. No MongoDB calls inside this module.
- Reuse the PERS-03 profile service to supply current ratings, wishlist, cart, feedback, and recent interaction rows for the verified session subject only.
- Wire into `/me` behind `PERS_BEHAVIORAL_RANKING`; mode `behavior-profile`, version `behavior-profile-v1`.
- Add defense-in-depth at `POST /api/interactions`: after origin validation, if `X-Tracking-Enabled` is exactly `false`, return the normal success envelope with `{ accepted: 0, duplicates: 0 }` and do not call the interaction repository. The current frontend normally sends no interaction request at all while opted out; this is only a server-side backstop. The header never controls rating/wishlist/cart/feedback routes.
- Preserve recommendation attribution on passive events that are used (`requestId`, `listId`, `algorithmVersion`, `mode`, `rank`). Do not require attribution for direct durable state.
- Never read `historicalAmazonRatings` for a live customer's behavioral profile.

### Frontend Changes (FFP-12)

- Keep the existing tracker behavior: opt-out sends no passive tracking events.
- Ratings, wishlist, cart, and feedback continue through their functional APIs even when tracking is disabled; do not route them through `track()` to preserve functionality.
- Render `behavior-profile` honestly and render only reasons returned by the backend.

### API Contract

`/me` may return `mode: "behavior-profile"` with reasons tied to actual live-account evidence, for example `Similar to records you saved.` or `Matches artists you rated highly.` Tracking opt-out removes passive-event evidence only; reasons based on current ratings/wishlist/cart/feedback may still be valid.

### Data-Model Changes

No new collection. Reuse durable account-state repositories and the existing 90-day `interactions` collection. Add an interaction index only if an explain/query plan shows the existing `(userPublicId, occurredAt)` index is insufficient.

### Algorithm Or Business Rules

Source rules, strongest first:

- Current rating 5: strong positive item taste; rating 4: medium positive; rating 3: neutral; rating 1-2: strong negative item taste. Rating replacement/deletion uses only the current durable rating state.
- Current wishlist membership: strong positive. Wishlist removal means "no current wishlist signal"; it is not negative taste.
- Current cart membership: strong positive only where cart is a valid feature. Cart removal/quantity decrease removes or adjusts the positive signal; it is not negative taste.
- `already-own`: positive taste evidence for the item's known artist/genre/format, while PERS-05 still excludes that exact item.
- `not-interested`: bounded negative artist/genre/format evidence from that item, while PERS-05 excludes the exact item. One row must never exclude an attribute.
- Passive weak positives: `recommendation_click`, `product_view`, and `search_result_click` when a valid product id exists. `recommendation_wishlist_add`/`recommendation_cart_add` are analytics mirrors and must not double-count the authoritative wishlist/cart state.
- Ignore for taste: `recommendation_impression`, `search_submit` (query text is not persisted), `wishlist_remove`, `cart_remove`, `cart_quantity`, `rating_remove`, and `demo_checkout_complete` except as needed to reconstruct/validate state outside this scorer.

Aggregation:

1. Join each signal product id to the same active-catalog candidate metadata. Drop unknown/inactive products; never borrow another dataset version.
2. Convert product evidence only into the current recommendation-candidate attributes `artist`, primary `genre`, and `format`. Use the same trimmed, case-insensitive exact keys as PERS-04; never use substring/regex artist matching. Do not reach into raw `genres[]` or widen the public product contract. Missing attributes contribute nothing.
3. Durable current state does not decay in PERS-06. Passive 90-day events use three simple recency bands: 0-7 days `1.0`, 8-30 days `0.5`, 31-90 days `0.25`.
4. Deduplicate passive events by `(type, productPublicId, UTC day)` and cap passive contribution per product to three events. Apply an absolute cap per artist/genre/format so repeated events cannot dominate.
5. After caps, the request-level affinity profile is the signed artist/genre/format evidence map. If that map has no non-zero evidence, return `available: false`. Otherwise compute one fixed `profileAbsoluteEvidenceSum` from the capped profile. For each candidate, sum only the profile evidence matching the candidate's known artist/genre/format; missing attributes contribute `0` and do not change the denominator.
6. Compute `raw = matchedSignedEvidence / profileAbsoluteEvidenceSum` (bounded `[-1,1]`), then `score = clamp((raw + 1) / 2, 0, 1)`. After scoring, return `available: false` if every eligible candidate has zero matched signed evidence; behavioral history that cannot affect the active catalog must not produce a misleading behavior mode. Keep constants in one versioned object and label them assumptions, not learned weights.
7. `scoreBehaviorCandidates` keeps all eligible candidates keyed by mapped public `product.id`. `rankByBehavior` sorts score DESC, `product.id` ASC, then title and applies artist cap 2 only for the standalone `behavior-profile` list.
8. Recommendation reasons come only from positive matched evidence actually used for that candidate. Negative affinity lowers the score but is not presented as a positive recommendation reason. Never produce a passive-view/click reason if those events were absent.

Privacy/identity protections:

- When tracking is disabled, omit all passive interaction rows but continue using current durable ratings/wishlist/cart/feedback.
- Do not infer taste from `anonymousId` after sign-in unless an existing, verified guest-merge path explicitly transfers that state; do not create a new anonymous behavioral-profile migration in PERS-06.
- Duplicate `eventId` and out-of-order passive events are handled by existing ingestion/`receivedAt`; the scorer consumes the deduplicated result.
- Do not add recommendation-log existence lookups to the behavioral scorer. Consume only interaction rows already accepted for the verified subject; preserve any stored attribution for audit/explanations, but weak-event ranking must not create an extra recommendation-log query path.

### Privacy And Security Rules

- Passive analytics honor opt-out: no passive `/interactions` persistence and no passive profile use.
- Direct rating/wishlist/cart/feedback state remains functional and available to the profile regardless of analytics opt-out; optional analytics mirrors may be absent.
- No PII in behavioral signals; no cross-user inference.

### Edge Cases

- Duplicate events, out-of-order events, clock skew, replayed events, refresh-generated views, bot-like volume, add/remove cycles, rating changes, rating deletion, passive tracking disabled, anonymous-to-authenticated transition, guest-state merge retry, interaction references deleted product, interaction references unknown/expired recommendation list id.

### Failure And Recovery Behavior

- No usable durable or passive evidence → return the lower available mode; before PERS-07 that is `preference-profile` if applicable, otherwise existing cold-start.
- Explicit MongoDB persistence unavailable → `PERSISTENCE_UNAVAILABLE`; never silently use seed or another customer's history.
- Passive interaction query failure may be treated as "passive unavailable" only if durable state was read successfully; response reasons must not mention passive evidence.

### Migration Strategy

- Behind `PERS_BEHAVIORAL_RANKING`; default off.
- No historical-rating migration, no anonymous-history backfill, and no derived-profile collection.
- The `/api/interactions` opt-out defense may remain enabled even when behavioral ranking is rolled back because it tightens privacy only.

### Tests

- `tests/behavioral-profile.test.mjs`: rating strengths/replacement/deletion; current wishlist/cart positive; removals not negative; already-own positive taste + exact exclusion; not-interested bounded negative; passive click/view/search-result-click weak; search-submit/impression ignored; analytics mirrors do not double-count durable state; recency bands; dedup/caps; null metadata; complete score map before diversity; `[0,1]` bound; deterministic `product.id` ordering; standalone artist cap; negative affinity never becomes a recommendation reason; no-evidence and no-matching-active-catalog fallback.
- `tests/interaction-optout.test.mjs`: header false suppresses passive persistence; functional rating/wishlist/cart/feedback endpoints remain independently usable; opt-out profile still uses those durable states.
- Extend `/me`/logging/frontend tests for mode/version and truthful reasons; keep `content-demo-v1` and product similarity unchanged.

### Exact Implementation Order

1. Add pure behavioral affinity builder/scorer and unit tests using synthetic live-account fixtures only.
2. Extend the PERS-03 profile service/repository orchestration to provide durable state plus bounded recent interactions.
3. Add server-side opt-out defense to interaction ingestion and its tests.
4. Wire `behavior-profile-v1` into `/me` after exact feedback exclusions.
5. Update frontend label/reason handling only; do not redesign the tracking queue.
6. Run backend tests/lint/build, frontend tests/lint/build, and auth/tracking/recommendation E2E. Stop if opt-out causes any functional state API to stop working.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: behavioral section, version `behavior-profile-v1`, aggregation formula.
- `INTERACTION_LOGGING_PLAN.md` (frontend): opt-out boundary update.
- `EVALUATION_PLAN.md`: note live behavioral ranking is separate from offline baselines.
- Decision BDEC-029 recorded: behavioral affinity uses current durable state plus weak opt-in passive events, with removals treated as loss of positive state rather than negative taste.

### Definition Of Done

- Current durable live-account state changes authenticated ranking when usable.
- Passive clicks/views/search-result-clicks are weak, bounded, opt-in only, and never double-count durable state.
- Wishlist/cart removal is not treated as negative taste; raw search text is never assumed to exist.
- Opt-out suppresses passive persistence/use while ratings/wishlist/cart/feedback still function and can drive ranking.
- Scores stay in `[0,1]`; explanations identify only evidence actually used; no quality claim.

### Rollback Criteria

Disable `PERS_BEHAVIORAL_RANKING`; behavior component is ignored. Keep the server-side passive opt-out defense.

### Risks

- BR-022 / FR-021: tracking opt-out accidentally disables direct account actions or passive analytics still persist/use. Mitigation: route-separation and tracking-off E2E tests.
- BR-037: repeated weak passive events dominate durable intent. Mitigation: direct-state precedence, day dedup, recency bands, per-product cap, and absolute attribute caps.

### Decisions Still Requiring Approval

None for the implemented v1 assumptions. Any future weight or cap change requires a new algorithm version.

---

## PERS-07: Popularity Baseline And Fallback (BFP-14)

### ID And Title

PERS-07 / BFP-14 — Active-dataset historical popularity recommender plus deterministic fallback.

### Status

Implemented 2026-08-10 on `feat/personalization-pers-06-08`, behind default-off `PERS_POPULARITY`. Production popularity uses the already imported historical Amazon ratings; it does not depend on accumulating live interaction volume.

### Goal

Rank active research products by aggregate historical rating evidence without exposing historical identities, then fall back to the existing deterministic catalog order when that evidence is unavailable.

### Why It Is Required

Anonymous and empty-profile requests need a non-personal fallback. The application already has 20,288 isolated historical ratings for the active research dataset, which is a better scoped popularity signal than inventing a sparse live-event/trending pipeline from three showcase customers.

### Current Implementation Gap

- Closed for the PERS-07 scope: the live popularity component and repository aggregate are available behind the flag.
- Historical rating rows remain aggregate-only at the repository boundary and are still separate from offline train-only evaluation.
- Seed/null/no-evidence candidate sets continue to use the deterministic fallback.

### Dependencies

- Active dataset descriptor/version ownership.
- `historicalAmazonRatings` and active-catalog repository.
- Existing deterministic fallback ordering from `contentBased.js`/catalog candidates.
- Offline popularity baseline remains independently testable and leakage-safe.

### Non-goals

- Replacing or weakening the offline popularity baseline.
- Building trending/recent-live-event popularity from the three app showcase customers.
- Adding a popularity cache collection, scheduled aggregation job, Bayesian model, exposure-bias correction, or new index without measured need.
- Quality claims.

### Backend Changes

- Add `src/repositories/historicalPopularityRepository.js` (or the smallest equivalent repository method) that returns aggregate `{ productPublicId, ratingCount, meanRating }` for one requested dataset key. It must never return `userKey`.
- Add `src/lib/recommender/popularity.js` with pure `scorePopularityCandidates(candidates, aggregates)` and `rankByPopularity(candidates, aggregates, opts)`. The score function returns one score/reasons entry for every candidate before diversity/truncation; `rankByPopularity` uses that complete map for the standalone `popularity` mode and then applies ordering/artist cap.
- Production MongoDB mode derives the request dataset key from the already loaded recommendation candidates (`candidate.datasetKey`). Assert that all candidates share the same key, then query aggregates for that exact key. Do not perform a second active-dataset-pointer read after candidate loading; that would allow an activation race to mix candidates from one release with ratings from another. A null key (legacy/seed candidate set) means historical Amazon popularity is unavailable.
- Wire behind `PERS_POPULARITY`; successful aggregate ranking uses mode `popularity`, version `popularity-v1`.
- Do not query the `interactions` collection for production popularity in PERS-07.
- Do not add a cache initially. The active dataset is immutable and only 20,288 historical rows; measure first. If later profiling shows a need, an in-process cache keyed by dataset key is sufficient before considering persistence.
- Do not add an index initially. The existing historical-rating indexes beginning with `datasetKey` are the first implementation target; use `explain()` before proposing another.

Production ranking definition:

1. Read the recommendation candidate set once, verify its non-null `datasetKey` is uniform, and aggregate historical ratings for that exact candidate-owned key. If the key is null or candidates are empty, historical popularity is unavailable.
2. Join each aggregate by `aggregate.productPublicId === candidate.id`. For each candidate, `ratingCount` is the number of historical rating rows and `meanRating` is the arithmetic mean of ratings 1-5; candidates with no aggregate receive count `0` and mean `null`. Schema uniqueness already prevents one historical subject/product pair from being counted twice.
3. Standalone popularity order is `ratingCount DESC`, then `meanRating DESC` with null last, then `product.id ASC`, then title. This is intentionally simple and matches the course popularity concept.
4. `scorePopularityCandidates` returns every eligible candidate with bounded score `ratingCount / maxRatingCount`. If `maxRatingCount === 0`, the component is unavailable. `meanRating` is a standalone tie-break, not a probability and not an extra hybrid score.
5. `rankByPopularity` applies the shared artist cap 2 only to the standalone popularity list. The complete score map used by PERS-08 must not be capped/truncated first. Do not invent genre-diversity penalties or discovery quotas in the first implementation.
6. Research-only null stock/price/condition are neutral. Commercial `stock === "out"` may be excluded by the same candidate-eligibility rule used by the other components.
7. If the active dataset has no historical aggregate evidence, use the existing deterministic catalog fallback and mode `anonymous-fallback`/`cold-start` as appropriate.
8. Seed mode has no historical Amazon popularity and always uses its deterministic catalog fallback.

Offline-evaluation boundary:

- Production popularity may aggregate all immutable historical rows because it is serving a fallback, not measuring quality.
- Any offline metric comparison must compute its popularity baseline from the training split only and rank held-out items without leakage. Do not reuse the production all-split aggregate inside evaluation.

Fallback ladder after PERS-08 (each response reports the mode actually used):

1. `personalized-hybrid` only when both preference and behavioral components are available.
2. `preference-profile` when only preference personalization is available.
3. `behavior-profile` when only behavioral personalization is available.
4. `popularity` when historical aggregate evidence is available.
5. Existing deterministic catalog fallback (`cold-start` for authenticated, `anonymous-fallback` for anonymous).

### Frontend Changes

- Render `popularity` and `anonymous-fallback` honestly. For `popularity`, use wording tied to research rating aggregates, not "recent activity".

### API Contract

`/me` may return `mode: "popularity"`, `algorithmVersion: "popularity-v1"`, and a safe reason such as `Popular in the research ratings dataset.` Anonymous deterministic catalog fallback remains `mode: "anonymous-fallback"`. Do not expose rating counts, mean ratings, user keys, or a score as a probability.

### Data-Model Changes

None initially. Reuse `historicalAmazonRatings` and its current indexes. No popularity collection or TTL cache is planned.

### Algorithm Or Business Rules

See Backend Changes. Keep production popularity and offline evaluation separate: the production component may use all rows of the active immutable dataset; offline evaluation must use only its training partition when computing the baseline.

### Privacy And Security Rules

- Aggregate in the repository/database boundary only. Never return or log historical `userKey` values.
- The production popularity result is non-personal aggregate evidence and is not controlled by the live customer's tracking preference.
- Never merge historical Amazon subjects with application users.

### Edge Cases

- Active dataset has no ratings; inactive v2/v1 ratings coexist; product has zero ratings; equal counts; equal count + equal mean; product no longer active; research fields are null; seed mode; aggregate query returns no rows; dataset activation changes between requests.

### Failure And Recovery Behavior

- No historical aggregate evidence for the active dataset → deterministic catalog fallback.
- Aggregate query failure while MongoDB otherwise remains required → `PERSISTENCE_UNAVAILABLE`; do not silently use another dataset version or seed.

### Migration Strategy

- Behind `PERS_POPULARITY`; default off.
- No schema migration, no dataset import, no historical-row rewrite, no new cache collection.

### Tests

- `tests/popularity.test.mjs`: candidate-owned dataset-key aggregation; mixed-key candidate assertion; v2/v1 isolation; aggregate `productPublicId` joins mapped `candidate.id`; count-first ranking; mean-rating/null then `product.id` tie-break; zero-rating candidates; complete `[0,1]` score map before diversity; standalone artist cap; research null neutrality; seed/no-evidence deterministic fallback; no historical identity in outputs/logs.
- Evaluation regression: train-only popularity baseline remains independent and leakage-safe.

### Exact Implementation Order

1. Add repository aggregate method and repository tests proving dataset-key isolation and no `userKey` output.
2. Add pure popularity ranker and deterministic unit tests.
3. Wire `popularity-v1` into anonymous and lower-fallback `/me` paths behind the flag.
4. Update response/logging allow-lists and frontend labels.
5. Verify with v3 active and, read-only, confirm v2 data cannot affect v3 ranking. Run backend/frontend tests/lint/build. Do not activate/rollback/reimport a dataset for this milestone.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: popularity section, version `popularity-v1`, fallback ladder.
- `DATA_MODEL_PLAN.md`: document reuse of `historicalAmazonRatings` and existing dataset-key indexes; add no cache collection/new index unless profiling later justifies it.
- `EVALUATION_PLAN.md`: live popularity vs offline baseline distinction.
- Decision BDEC-030 recorded: production popularity is a candidate-owned dataset-key aggregate with count/mean/id tie-breaks and no historical identity output.

### Definition Of Done

- Live `popularity-v1` ranks only the active dataset using aggregate historical rating count with documented tie-breaks.
- Historical user identities never leave the repository boundary.
- Anonymous/empty-profile requests use popularity when available, then the deterministic catalog fallback.
- No live-event popularity pipeline, cache collection, or unnecessary index was added.
- Offline train-only popularity baseline remains independently testable.

### Rollback Criteria

Disable `PERS_POPULARITY`; anonymous/authenticated empty-profile paths return the existing deterministic catalog fallback. Historical data is untouched.

### Risks

- BR-026: production popularity may mix dataset versions, expose historical identity, or leak held-out rows into offline evaluation. Mitigation: exact active-dataset aggregation, aggregate-only repository output, and a separate train-only evaluation baseline.

### Decisions Still Requiring Approval

None for the initial method. Historical rating-count popularity with mean-rating/id tie-break is the selected simple production fallback.

---

## PERS-08: Hybrid Recommendation Orchestration (BFP-15 / FFP-13)

### ID And Title

PERS-08 / BFP-15 (backend) + FFP-13 (frontend) — Hybrid orchestration of preference, behavioral affinity, and historical popularity with exact-item feedback exclusions.

### Status

Implemented 2026-08-10 on `feat/personalization-pers-06-08`, behind default-off `PERS_HYBRID`. The component matrix, one-candidate-set orchestration, exact exclusion pass, frontend labels/reasons, and focused regression tests are complete; no quality claim is made.

### Goal

Combine the three user-list components already built for `/me`—preference, behavioral affinity, and historical popularity—without double-counting product content, with deterministic weights, exact feedback exclusions, truthful mode selection, and simple diversity.

### Why It Is Required

Preference and behavioral components represent different customer evidence, while popularity provides a non-personal prior/fallback. The existing product-to-product content route remains useful independently and must not be added again as a fourth user component because PERS-06 already maps user history onto the same content attributes.

### Current Implementation Gap

- Closed for the PERS-08 scope: the pure hybrid combiner and `/me` mode matrix are implemented.
- Product-to-product content similarity remains a separate route and is not duplicated in user-list scoring.

### Dependencies

- PERS-04 preference score contract.
- PERS-05 exact-item exclusions.
- PERS-06 behavioral affinity score contract.
- PERS-07 historical popularity score contract.

### Non-goals

- Collaborative filtering, matrix factorization, learned weights, or model training.
- Adding product-to-product content similarity or availability as separate hybrid components.
- Quality claims.

### Backend Changes

- Add `src/lib/recommender/hybrid.js` as a pure combiner. It accepts one candidate set plus per-candidate component outputs; it does not read repositories or environment variables.
- Service orchestration loads the active catalog once, applies PERS-05 exact-item exclusions once, then asks PERS-04/PERS-06/PERS-07 to score that same candidate set.
- Wire behind `PERS_HYBRID`; mode `personalized-hybrid`, version `personalized-hybrid-v1`.
- Keep `content-demo-v1` and `GET /api/recommendations/product/[id]` byte-for-behavior compatible for the same inputs.

Component contract:

- PERS-08 consumes the complete pre-diversity score functions (`scorePreferenceCandidates`, `scoreBehaviorCandidates`, `scorePopularityCandidates`), never the standalone ranked/capped lists. Each returns `{ available, scoresByProductId }`. `available` is request-level, not candidate-level. If `available === true`, it must contain one numeric `{ score: 0..1, reasons: [] }` entry for every eligible candidate keyed by mapped public `product.id`; neutral/no-match behavior is defined inside that component.
- Preference and behavioral components are personalized. Popularity is a non-personal prior.
- Negative feedback is already applied as exact-item eligibility and has no hybrid score.
- No second min-max normalization is allowed in `hybrid.js`; component contracts are already bounded.

Combination rules:

1. Use one initial versioned weight object: preference `0.45`, behavioral `0.35`, popularity `0.20`. These are classroom assumptions, not learned/optimized values.
2. Decide the response mode before combining scores. Only form a score-level hybrid when both preference and behavioral components are available. In that case, use preference + behavior + popularity when popularity is available; otherwise use preference + behavior only. Renormalize those selected hybrid weights once for the whole request. Never renormalize per candidate.
3. For a true hybrid, every selected component must have one score for every eligible candidate; a missing score is a contract error. Compute `finalScore = Σ(requestNormalizedWeight × componentScore)` and clamp defensively to `[0,1]`.
4. If preference is available but behavior is not, return the pure PERS-04 `preference-profile` ranking/version/reasons; do not blend popularity into that lower mode. If behavior is available but preference is not, return the pure PERS-06 `behavior-profile` ranking/version/reasons; do not blend popularity into that lower mode. If neither personalized component is available, return pure PERS-07 `popularity` when available; otherwise use the deterministic cold-start/anonymous fallback.
5. This rule keeps algorithm versions truthful: `preference-profile-v1` always means the PERS-04 score, `behavior-profile-v1` always means the PERS-06 score, `popularity-v1` always means the PERS-07 score, and only `personalized-hybrid-v1` contains weighted component blending.
6. For a true hybrid, sort by final score DESC, mapped public `product.id` ASC, then title and apply the shared artist cap 2 once. Lower modes use their own component ordering/cap behavior unchanged. Do not add a genre-diversity algorithm, discovery quota, relevance threshold, or near-duplicate release detector in v1.
7. Return at most the existing requested limit. Hybrid reasons are the top two non-empty reasons from the highest weighted positive contributions actually used; lower modes keep their component reasons. Never expose raw weights or component scores.
8. Tracking opt-out removes only passive-event evidence inside PERS-06. A true hybrid may still use preference, remaining durable behavioral evidence, and popularity; explanations must reflect what actually remained.

Algorithm-version rules:

- Keep old recommendation logs immutable; never recompute historical lists with new weights.
- Stamp `personalized-hybrid-v1` only on responses actually combined under rule 4. Lower modes keep their own component algorithm version.
- Any later weight/combination change requires a new algorithm version; do not silently edit v1 semantics.
- Disable `PERS_HYBRID` to return to the component-mode fallback order without data migration.

### Frontend Changes (FFP-13)

- Render `personalized-hybrid` mode label and truthful reasons.
- Attribution carries the hybrid version.

### API Contract

`/me` returns `mode: "personalized-hybrid"` and `algorithmVersion: "personalized-hybrid-v1"` only when both personalized components are available. Items keep the existing `reasons[]`; lower fallback modes keep their own mode/version. Do not add profile-completeness/source-flag fields or expose raw weights/component scores.

### Data-Model Changes

None. Existing recommendation logs already carry mode/version and the exact served list.

### Algorithm Or Business Rules

See the component contract and combination rules above.

### Privacy And Security Rules

- Explanations reveal only the customer's own saved/account evidence plus safe aggregate popularity wording.
- Tracking opt-out removes passive-event contributions but does not erase valid reasons based on ratings/wishlist/cart/feedback.
- Historical popularity contributes only an aggregate score/reason; historical identities never reach hybrid code.

### Edge Cases

- preference unavailable; behavior unavailable; popularity unavailable; all three unavailable; score exactly 0 or 1; an available component omits one candidate score (contract error); all candidate scores tied; exact feedback exclusion removes a high scorer; research null metadata; deterministic ordering; weight-version change; old recommendation logs; opt-out with durable state still present; no candidates after exact exclusions.

### Failure And Recovery Behavior

- Missing component → follow the mode-selection rules above and renormalize only where a true hybrid is formed.
- No usable component → deterministic cold-start/anonymous fallback.
- Explicit MongoDB/catalog failure → `PERSISTENCE_UNAVAILABLE`; a failed required catalog read cannot be hidden by a lower mode.

### Migration Strategy

- Behind `PERS_HYBRID`; default off. No schema/data/dataset migration.
- Rollback disables only hybrid combination; PERS-04/PERS-06/PERS-07 component modes remain independently reversible.

### Tests

- `tests/hybrid.test.mjs`: exact 0.45/0.35/0.20 math with all three components; preference+behavior renormalization when popularity is absent; no second min-max pass; hybrid requires preference+behavior; preference+popularity returns pure preference scores/version; behavior+popularity returns pure behavior scores/version; popularity-only and deterministic fallback; exact-feedback exclusion before scoring; `[0,1]` hybrid bound; artist cap; stable tie-break; top-two hybrid reasons; lower-mode reasons unchanged; opt-out keeps durable reasons but removes passive-only reasons; version stamping.
- Regression: identical `content-demo-v1` and product-similarity inputs produce unchanged output.

### Exact Implementation Order

1. Freeze/verify PERS-04, PERS-06, and PERS-07 component output contracts with unit tests before editing hybrid code.
2. Add pure `hybrid.js` and unit tests for weight/mode/fallback rules.
3. Refactor `/me` service orchestration to load candidates once, apply PERS-05 exclusions once, request component availability/scores, choose the response mode, and call `hybrid.js` only when both personalized components are available.
4. Extend recommendation logging/response validation for exact mode/version semantics.
5. Update frontend hybrid label/reasons/version attribution; lower modes must still render independently.
6. Run both repos' tests/lint/build and end-to-end auth/recommendation/tracking flows. Compare product-similarity and `content-demo-v1` regression fixtures before completion.

### Documentation Updates

- `RECOMMENDER_SYSTEM_PLAN.md`: hybrid section, version `personalized-hybrid-v1`, weight assumptions.
- Both `API_CONTRACT_PLAN.md`: hybrid mode/reasons.
- `EVALUATION_PLAN.md`: note hybrid is not quality-validated.
- Decision BDEC-031 recorded: preference/behavior/popularity use fixed v1 weights only in a true personalized hybrid; lower modes stay pure.

### Definition Of Done

- Hybrid uses exactly preference + behavioral affinity + historical popularity; content similarity and availability are not duplicated as components.
- Component scores are already bounded; weight renormalization occurs only inside a true hybrid (preference + behavior, with popularity optional).
- `personalized-hybrid` requires both personalized components; lower modes use their pure component score/version and are labelled truthfully.
- Exact feedback exclusions happen once before scoring; explanations come from actual contributions; `content-demo-v1` and product similarity are preserved.

### Rollback Criteria

Disable `PERS_HYBRID`; `/me` uses the PERS-04/PERS-06/PERS-07 mode ladder independently. No data rollback.

### Risks

- BR-027 / FR-022: hybrid may double-count content, silently change weights, or label a lower mode as hybrid. Mitigation: exactly-three-component contract, versioned weight test, request-level availability matrix, and contribution-derived reasons.

### Decisions Still Requiring Approval

None for v1 structure. Initial `0.45/0.35/0.20` weights are fixed documented assumptions; changing them later requires a new algorithm version.

---

## PERS-09: Integration, Migration, Regression Protection, Documentation Closure (BFP-16 / FFP-14)

### ID And Title

PERS-09 / BFP-16 (backend) + FFP-14 (frontend) — Full cross-repository integration, regression protection, and documentation closure.

### Status

Deferred and explicitly outside the PERS-06 through PERS-08 batch. No PERS-09 integration/closure implementation or dataset lifecycle work was performed.

### Goal

Integrate and verify PERS-03 through PERS-08 as one coherent `/api/recommendations/me` pipeline without changing DATA-15, the public product-similarity route, historical evaluation rules, or the already completed identity/session architecture.

### Why It Is Required

Each prior milestone is independently flag-gated. PERS-09 verifies cross-repository contracts, failure/rollback behavior, privacy boundaries, dataset-version isolation, account cleanup, frontend state, and documentation before any separate enablement decision.

### Current Implementation Gap

- PERS-03 through PERS-08 are implemented and individually verified; PERS-09 remains a later integration/closure task.
- `/api/recommendations/me` and its auth-restoration/frontend resource-key behavior already exist from PERS-02; PERS-09 must verify them, not redesign or switch endpoints again.

### Dependencies

- PERS-03 through PERS-08 implemented and individually verified.
- PERS-01/PERS-02 identity and `/me` contracts remain regression gates, not unfinished dependencies.

### Non-goals

- Quality evaluation with sufficient evidence.
- Removing `content-demo-v1` or the old restricted route (both retained).

### Backend Changes

- Review the final `/me` route: it must remain thin (`require/optional session` → validate limit/surface → call recommendation service → safe response). Do not move scoring/repository reads into routes.
- Verify pure modules in `src/lib/recommender/` contain no MongoDB/network calls: preference, behavioral affinity, popularity ranker, and hybrid combiner.
- Verify service orchestration reads one active candidate set, applies exact feedback exclusions once, and keeps live customer state separate from historical popularity aggregates.
- Verify safe response mapping strips object ids, raw profile signals, historical aggregates/user keys, internal exclusions, and component weights.
- Verify recommendation logging records exactly the final served list/mode/version/reasons and that opt-out behavior still matches the privacy contract.
- Verify every new mode/version is recognized by validators/loggers/frontend contracts. Keep `content-demo-v1` and product `content-similarity` unchanged.
- Verify feedback upsert/undo is idempotent and account deletion removes feedback. No derived profile/cache collection should exist unless a prior milestone explicitly justified one.
- Do not add popularity/profile indexes at closure unless an actual query plan from PERS-06/PERS-07 demonstrated a need.
- Explicit MongoDB mode never silently falls back to seed. Seed mode uses only features supported by seed data and deterministic fallback behavior.
- Run DATA-15 verification read-only: v3 remains active; v2 remains immediate rollback; v1 remains identity base; 116 legacy products and exactly three showcase customers remain intact. Do not import, activate, rollback, or create v4 in PERS-09.

### Frontend Changes (FFP-14)

- Re-verify the PERS-02 behavior already in production: auth restoration gates recommendation loading; authenticated requests use `/api/recommendations/me`; identity changes abort/stale-guard old requests; sign-out clears personalized resource state.
- Verify preference save does not add an off-surface recommendation reload. After save, navigating to `/` or `/recommendations` must trigger the existing fresh route/resource-key request and use the persisted preferences.
- Verify feedback create/undo keeps the recommendation card mounted as a compact confirmed status+Undo placeholder, uses pessimistic writes, and relies on the next normal recommendation load for server-authoritative suppression.
- Verify `preference-profile`, `behavior-profile`, `popularity`, `personalized-hybrid`, `cold-start`, and `anonymous-fallback` labels/reasons are distinct and truthful.
- Verify tracking opt-out clears/stops passive analytics while functional rating/wishlist/cart/feedback actions still work.
- Preserve request/list/version/rank attribution from rendered recommendation cards into supported passive interactions.
- Keep loading, empty, retry, and fallback states accessible. Do not create a separate "partial hybrid" UI; lower component modes already express partial availability.
- Keep legacy `demo-profile` wording only on the restricted synthetic showcase path; do not label registered-user results as demo personalization.
- Re-run keyboard, visible-focus, screen-reader announcement, and responsive/mobile checks for new feedback/recommendation states.

### API Contract

Final consolidated contract for `/api/recommendations/me`, feedback routes, and the restricted old route, reflected in both `API_CONTRACT_PLAN.md` files.

### Data-Model Changes

No new PERS-09 schema. Verify the PERS-03 feedback collection/index, existing interaction/recommendation TTL indexes, existing historical-rating indexes, and account-deletion transaction. Do not add a profile/popularity cache collection merely for closure.

### Algorithm Or Business Rules

- Final user-list approaches are: preference scoring, behavioral content affinity, historical popularity, and the hybrid. PERS-05 feedback is an exclusion/signal rule, not another recommender.
- Effective flag dependencies must fail closed: `profile = PERS_PROFILE_DOMAIN`; `preference = profile && PERS_PREFERENCE_RANKING`; `feedback = profile && PERS_NEGATIVE_FEEDBACK`; `behavior = profile && PERS_BEHAVIORAL_RANKING`; `popularity = PERS_POPULARITY`; `hybrid = preference && behavior && PERS_HYBRID`. A disabled feedback flag also removes stored feedback from behavioral evidence.
- Public product-to-product content similarity remains separate and unchanged.
- All new component/hybrid flags may remain default-off at PERS-09 completion. Integration completeness does not authorize production enablement; a separate explicit task decides defaults.
- The fallback/mode matrix in PERS-08 is the single source of truth. Blend scores only for a true hybrid; lower modes use their pure component score/version.

### Privacy And Security Rules

- Session identity is the only live customer identity source; historical Amazon `userKey` never becomes an app subject.
- Tracking opt-out suppresses passive analytics persistence/use; direct account actions remain functional.
- No raw profile signals, interaction rows, historical aggregates/identities, MongoDB ids, or component weights in public responses.
- Account deletion removes all durable customer personalization state including feedback; 90-day interactions/recommendation logs are included in the existing deletion transaction.
- Synthetic showcase data stays clearly labelled and must not be reported as real-user quality evidence.

### Edge Cases

Consolidate only implemented cases from PERS-03 through PERS-08. Minimum final matrix:

- identity: anonymous, registered, showcase, admin rejection, expired/tampered/disabled/deleted session, sign-in/sign-out during in-flight request, cross-user attempt;
- catalog/data: research-only null commercial fields, seed mode, v3 active with v2/v1 coexistence, deleted/unknown product, dataset-key mismatch, zero historical popularity evidence;
- preferences/feedback: empty preferences, disliked genre as soft penalty, successful/failed preference save, duplicate feedback, double undo, feedback for later-deleted product, rating-5 plus not-interested conflict;
- behavior/privacy: opt-out with durable state still present, passive events absent, duplicate/out-of-order passive events, wishlist/cart removals not negative, search-submit not used as content taste;
- hybrid: each component availability combination, all tied scores, exact feedback exclusion, deterministic ordering, old algorithm logs, flag rollback;
- failure: MongoDB unavailable, repository query failure, account deleted during ranking. Required persistence failure returns an error; it is not disguised as a lower recommendation mode.

### Failure And Recovery Behavior

- Algorithm evidence unavailable → use the documented lower mode.
- Required catalog/session/persistence unavailable in explicit MongoDB mode → safe error such as `PERSISTENCE_UNAVAILABLE`; never silently serve seed.
- Seed mode uses only seed-supported deterministic behavior; it never pretends historical popularity exists.

### Migration Strategy

There is no DATA-15 or recommendation-data migration in PERS-09. Implement PERS-03 through PERS-08 in dependency order, then perform integration-only closure. Do not rerun imports/activation/rollback. Frontend already uses `/me`; verify it after backend contracts are stable rather than performing another endpoint switch.

### Tests

- Backend integration: session-owned identity/cross-user denial; fail-closed feature dependency matrix; active-catalog single-candidate-set orchestration; PERS-04 complete null-safe preference score map; PERS-05 exact feedback/undo + inert stored rows when disabled; PERS-06 complete durable + opt-in passive affinity score map; PERS-07 candidate-owned dataset-key popularity/v2-v3 isolation; PERS-08 complete pre-diversity score-map contract and exact pure-lower/hybrid mode matrix; safe explanations; algorithm versions; exact served-list logging; account-deletion cleanup; seed behavior; explicit MongoDB failure paths.
- Frontend integration: existing auth-restoration/resource-key/stale-response guards; preference save adds no off-surface reload and the next recommendation-surface navigation fetches fresh persisted preferences; two feedback kinds use a confirmed status+Undo placeholder without immediate reranking; all mode labels/reasons; loading/empty/retry/fallback states; attribution; opt-out with direct functional actions; accessibility/keyboard/mobile.
- End-to-end with both repos: registered account preferences change order; rating/wishlist can change behavioral affinity; not-interested excludes exact item; already-own excludes exact item without dislike wording; anonymous MongoDB user receives historical popularity when available; seed anonymous user receives deterministic fallback; opt-out removes passive capture but direct state remains functional; one account cannot read another's profile; admin remains rejected; product similarity and legacy demo route remain unchanged.
- DATA-15 read-only verification: v3 active; v2 rollback verifiable while v3 active; v1 identity-base evidence intact where supported; 2,305 v3 products / 20,288 ratings / 2,387 subjects / expected splits; 116 legacy products; exactly three showcase customers. PERS-09 performs no write rehearsal.
- Synthetic fixture tests are functional/regression evidence only, never recommendation-quality evaluation.

### Exact Implementation Order

1. Confirm PERS-03 through PERS-08 Definition of Done and feature-flag rollback tests individually; do not repair unrelated features in PERS-09.
2. Audit backend call graph: route → recommendation service → repositories + pure scorers → safe mapper/logger. Remove duplicate candidate/profile reads only when directly caused by PERS work.
3. Run focused backend integration tests, then full backend test/lint/build.
4. Audit frontend current provider/resource flow and all new modes/feedback controls; run focused frontend tests, then full frontend test/lint/build.
5. Run cross-repo E2E for authenticated, anonymous, opt-out, feedback, identity transition, and seed/MongoDB failure boundaries.
6. Run read-only dataset/artwork/index verification required by current project instructions. No dataset apply/activation/rollback.
7. Perform a defect-first semantic diff review. Fix P0-P2 and directly coupled P3 defects; avoid unrelated refactors.
8. Synchronize the planning/status/contract/data-model/recommender/risk/backlog docs. Follow the root append-only memory rule for any session that changes these plans; the later implementation session appends its own separate entry.
9. Leave PERS-04 through PERS-08 flags default-off unless the user separately authorizes enablement.

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
- `implementation_plan_order.txt`: verify the existing PERS sequence/status is still correct; update only if implementation status changed.

### Definition Of Done

- PERS-03 through PERS-08 integrate through the existing session-owned `/me` endpoint with coherent independent flags and the single PERS-08 mode matrix.
- Backend/frontend focused + full tests, lint, builds, required cross-repo E2E, and read-only dataset verification pass.
- v3/v2/v1 boundaries, 116 legacy products, exactly three showcase customers, product similarity, and `content-demo-v1` regression behavior are preserved.
- Documentation consistently treats hard preference relaxation, `show-fewer-like-this`, live-event popularity, and duplicate content hybrid scoring as excluded/deferred rather than planned behavior, and makes no recommendation-quality claim.
- New PERS-04 through PERS-08 flags remain default-off pending separate enablement authorization.

### Rollback Criteria

- Each new algorithm flag disables independently. Full algorithm rollback returns `/me` to its pre-PERS-04 cold-start/anonymous behavior while leaving privacy tightening and durable feedback data harmless.
- No DATA-15 content changed, so rollback never requires dataset restore/import/activation.

### Risks

- BR-027 / FR-022 / FR-023: cross-repo mode/version/reason/copy contracts drift from the selected approach. Mitigation: exact response fixtures, full mode-matrix E2E, and final stale-term review.
- BR-021 / BR-028 / FR-014: integration regresses identity isolation, stale-response protection, or account-deletion cleanup. Mitigation: existing identity guards plus deletion/in-flight-request regression tests.
- BR-034: integration accidentally enters the sealed dataset write lifecycle. Mitigation: PERS-09 performs read-only dataset verification only; no import/apply/activation/rollback command is part of this milestone.

### Decisions Still Requiring Approval

- Production enablement of PERS-04 through PERS-08. Default for implementation/closure is off; enablement is a separate explicit task.

---

## Edge-Case Appendix (Consolidated)

Every case below is covered by at least one milestone's tests.

- Identity and authorization: anonymous request; expired session; tampered session; disabled account; deleted account; admin account; seeded environment account; MongoDB demo account; registered account; cross-user request attempt; auth transition during request; multiple tabs; concurrent login/logout.
- Preferences: empty preferences; partial onboarding; conflicting favorite and disliked genres; minimum budget greater than maximum budget (rejected at validation); unsupported condition; unsupported format; preference edits during ranking; preference deletion; no matching products; extremely narrow preferences; missing product metadata.
- Behavior: duplicate events; out-of-order events; clock skew; replayed events; refresh-generated views; bot-like event volume; add/remove cycles; rating changes; rating deletion; passive tracking disabled; anonymous-to-authenticated transition; guest-state merge retry; interaction references deleted product; interaction references unknown recommendation list.
- Negative feedback: duplicate create; undo twice; feedback product later deleted; rating-5 plus not-interested; already-own plus low rating; exact suppression versus positive genre preference; card becomes status+Undo after confirmed create; undo failure leaves the confirmed placeholder; next normal load enforces stored suppression.
- Popularity: active v3 with v2/v1 rows present; no active-dataset ratings; zero-rating candidate; equal count; equal count/mean; deleted product; seed mode; dataset activation changes between requests; no historical identity exposed.
- Hybrid: preference+behavior+popularity hybrid; preference+behavior hybrid with popularity absent; preference+popularity returns pure preference; behavior+popularity returns pure behavior; popularity-only; all unavailable; all scores tied; exact feedback exclusion; weight-version change; `content-demo-v1`/product-similarity regression; deterministic tie-break; explanation/item mismatch.
- Persistence and availability: MongoDB unavailable; seed mode; missing environment variables; transaction failure; retry after timeout; account deleted during ranking; product changed during ranking; required repository failure is not disguised as an algorithm fallback.
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

Rules: PERS-03 feedback schema is the only planned new personalization collection; PERS-04 through PERS-09 add no destructive migration; feature flags and algorithm versions are explicit; the frontend already uses `/me` from PERS-02; backward compatibility and the restricted legacy route remain; no profile/popularity cache is added without measured need; explicit MongoDB never falls back silently to seed; DATA-15 verification is read-only during PERS work; cross-repository implementation remains backend-contract-first.

## Decision Register (Recorded Or Proposed)

Recorded at PERS-00:

- BDEC-016 / FDEC-011 — Personalization architecture freeze (endpoint, durable-vs-TTL, opt-out split, version/mode names, profile recompute-on-demand, normalization, hybrid weight assumptions, demo account labelling).

Planned decisions for later milestones (not yet recorded in `DECISION_LOG.md`):

- BDEC-027 — Profile recompute-on-demand; direct durable state versus opt-in passive analytics split. Recorded during PERS-03.
- BDEC-028 — Durable exact-item feedback authoritative; `not-interested`/`already-own` only; pessimistic creates; show-fewer deferred. Recorded during PERS-05.
- BDEC-029 — Behavioral affinity uses current durable state plus weak opt-in passive events; removals are not negative taste; raw search text is unavailable. Recorded during PERS-06.
- BDEC-030 — Production popularity uses active-dataset historical rating count, mean-rating/id tie-break; offline evaluation remains train-only. Recorded during PERS-07.
- BDEC-031 — Hybrid blending requires preference + behavioral affinity, adds popularity when available, uses the `0.45/0.35/0.20` v1 assumption, and performs no second min-max normalization. If either personalized component is absent, return the pure lower component mode/version. Product similarity remains separate. Recorded during PERS-08.

PERS-00 through PERS-02 resolved identity/session architecture. The 2026-08-09/10 plan review and PERS-06 through PERS-08 implementation resolve the method shape above. Remaining approval is limited to production enablement of the new ranking flags and any later PERS-09 closure. All weights remain documented assumptions, not learned or validated-optimal values.

Implementation update (2026-08-10): BDEC-027 through BDEC-031 are recorded in `DECISION_LOG.md`. PERS-03 recomputes the profile on demand; PERS-04 uses equal absolute group weights; PERS-05 stores only durable exact-item feedback; PERS-06 adds bounded behavior and the server opt-out backstop; PERS-07 adds candidate-owned historical popularity; and PERS-08 adds the true hybrid/mode matrix. All remain default-off and no quality or optimality claim is made. PERS-09 remains deferred.

## Honesty Contract

No milestone, doc, test, or UI copy may claim measured recommendation quality, real-customer personalization (beyond the authenticated session-owned ranking defined here), or that behavior tests equal quality evidence. Synthetic fixtures and showcase accounts are clearly labelled as demonstrations. The existing `insufficient-evidence` evaluator status and its evidence threshold are unchanged and not completed by this roadmap.
