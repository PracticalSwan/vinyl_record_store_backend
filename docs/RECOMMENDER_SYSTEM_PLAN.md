# Backend Recommender System

This document specifies the current deterministic demo algorithm and the implemented default-off PERS-04 through PERS-08 component modes. No mode in this document is a measured-quality result.

## Implemented Method

The current recommender is deterministic content-based ranking over the active catalog. DATA-00 through DATA-15 expanded the data boundary but did not change the algorithm.

### Pairwise Weights

| Signal | Weight | Explanation |
| --- | --- | --- |
| Same artist | 6 | `Same artist as <title>.` |
| Same genre | 4 | `Shares the <genre> genre.` |
| Same decade | 2 | `Released in the same decade as <title>.` |
| Same label | 1 | `Released by <label>.` |
| In stock | 1 | Availability boost. |
| Low stock | 0.5 | Smaller availability boost. |

Out-of-stock candidates are excluded. Product recommendations exclude the source item. Demo-profile recommendations exclude all seed profile items. Final lists allow at most two records per artist.

## Product Recommendations

`recommendForProduct` compares the repository's bounded candidate set (up to 5,000 in MongoDB mode) with one source record, sorts by score and title, applies the artist cap, and returns ranks, reasons, and the algorithm version. Nullable artist/label/stock fields contribute no invented match or availability score; unknown artists use a safe diversity key.

## User Recommendations

- Restricted legacy `demo-user`: aggregate similarity to one synthetic purchase, three synthetic wishlist items, and documented favorite genres.
- Other legacy IDs: identical `cold-start` mode without any private profile read.
- `GET /api/recommendations/me`: verified customers receive the effective pure preference/behavior/popularity mode or `personalized-hybrid` only when its default-off flags and evidence contract allow it; otherwise they receive `cold-start`; requests without a valid customer session receive `popularity` when aggregate evidence is enabled and available, otherwise `anonymous-fallback`; administrators are rejected.

PERS-03 through PERS-08 add the server-internal profile, exact feedback suppression, preference/behavior/popularity components, and the hybrid mode. PERS-09 closes their service/repository/pure-scorer composition, exact logging, account-deletion lifecycle, and regression boundaries without changing the algorithms. All ranking flags default off, so the disabled path preserves `content-demo-v1`/cold-start behavior and makes no recommendation-quality claim.

## Algorithm Version

The default is `content-demo-v1`; `RECOMMENDER_ALGORITHM_VERSION` can override the label for controlled comparisons.

## Request Logging

Every recommendation response receives server-generated `requestId` and `listId`. MongoDB mode persists the exact ordered list, scores, ranks, reasons, exclusions, mode, algorithm version, surface, and safe subject before returning it. Seed mode and usage-data opt-out return attribution IDs without persistence. The logging service removes internal exclusions from the public envelope.

## Preference Profile (PERS-04, implemented default-off)

When `PERS_PROFILE_DOMAIN` and `PERS_PREFERENCE_RANKING` are both enabled for a verified customer, the service scores one active candidate set with `preference-profile-v1`. Six equal absolute group weights (favorite genre, disliked genre, favorite artist, format, budget, condition) are a fixed classroom v1 assumption, not learned or quality-validated weights. Favorite/disliked conflicts are removed from both groups; null research-only commerce fields are neutral; scores are bounded directly to `[0,1]`; and the two-result-per-artist cap is applied only after complete candidate scoring. The legacy and product-similarity modes remain unchanged.

## Exact Feedback (PERS-03/PERS-05, implemented default-off)

The recomputed profile reads preferences, ratings, wishlist, cart, exact feedback, and at most 500 recent interactions only when their effective gates allow it. `not-interested` and `already-own` are durable exact-item exclusions only; they never propagate to an artist or genre. `PUT` is idempotent and replaces the current kind; `DELETE` is an idempotent undo. Account deletion removes feedback in the same transaction. No `show-fewer-like-this` or public feedback-list route exists.

## Behavioral Affinity (PERS-06, implemented default-off)

`behavior-profile-v1` is a pure, bounded artist/primary-genre/format scorer over current durable ratings, wishlist, cart, feedback, and optional opted-in passive click/view/search-result-click events. Passive evidence uses UTC-day deduplication, 0-7/8-30/31-90-day bands, per-product and attribute caps, and no raw search text. Exact feedback exclusions happen before scoring; negative affinity lowers scores without becoming a positive reason. The interaction route rejects an exact `X-Tracking-Enabled: false` batch after origin validation, while direct account actions remain functional.

## Historical Popularity (PERS-07, implemented default-off)

`popularity-v1` aggregates `historicalAmazonRatings` only for the uniform `datasetKey` already present on the one loaded candidate set. The repository returns `{ productPublicId, ratingCount, meanRating }` only; historical identities never leave that boundary. Count DESC, mean DESC/null-last, public ID/title ties and the standalone artist cap are deterministic. Seed/null/zero-evidence requests use the existing fallback. Production all-row aggregation remains separate from the offline evaluator's train-only baseline.

## Personalized Hybrid (PERS-08, implemented default-off)

`personalized-hybrid-v1` combines complete pre-diversity maps with fixed classroom assumptions preference `0.45`, behavior `0.35`, and popularity `0.20`. A true hybrid requires preference and behavior; popularity joins when available and weights renormalize once at request level. Preference-only, behavior-only, and popularity-only responses keep their pure modes/versions. Exact exclusions and the artist cap are applied once; product-to-product similarity remains separate.

## Historical Evaluation And Deferred Live Methods

The explicitly authorized post-PERS sequence completed a sealed offline-academic evaluation and evidence-based decision gate. NEXT-01 measured random, positive-popularity, and content validation baselines on the pinned v3 historical dataset. NEXT-02 rejected neighborhood CF and classical SVD and approved one dependency-free observed-rating `biased-matrix-factorization-v1` experiment. NEXT-03 tried exactly eight frozen validation configurations, selected 16 factors / 0.005 learning rate / 0.02 regularization / 50 epochs, then consumed the final test once after source and authorization reproduction. It did not change any production ranker or feature-flag default.

Collaborative filtering, classical SVD, matrix factorization, learned ranking, and learned weights remain excluded from the live application. Historical Amazon subjects are not Groovehaus customers, and no learned historical user representation may be attached to an application account. On the common 1,708-subject positive-target test cohort, content led descriptively (NDCG@10 `0.043214`) over popularity (`0.022427`) and biased MF (`0.002301`); MF used no fallback and produced nearly identical lists. No uncertainty test was run, so this is not a universal superiority claim. The live interaction evaluator still has insufficient evidence and no historical metric validates the preference, behavior, production popularity, or hybrid modes.

## Personalization Roadmap

PERS-00 through PERS-09 are complete; PERS-04 through PERS-08 remain behind default-off gates. PERS-09 moved persistence reads into the recommendation service, retained pure preference/behavior/popularity/exclusion/hybrid modules, and added consolidated one-candidate-set, failure, privacy, logging, and product-similarity regression protection. The live behavioral content-affinity, active-dataset historical rating-count popularity, and `personalized-hybrid-v1` approaches remain unchanged. Score blending happens only when preference and behavior are both available; popularity joins that hybrid when available. If either personalized component is missing, the response uses the pure lower component score/version. Exact feedback is an exclusion/signal rule, not a separate recommender. `content-demo-v1` remains the rollback behavior. No quality claim is made.

NEXT-04 selected an environment-only MongoDB/v3 Profile B classroom demonstration: preference ranking and exact feedback on, behavior/popularity/hybrid off. This is not a source-default or production rollout. See `DEMO_PERSONALIZATION_RUNBOOK.md` for the exact environment, temporary-customer flow, failure behavior, and rollback.
