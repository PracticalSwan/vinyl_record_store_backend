# Backend Recommender System

This document specifies the current deterministic demo algorithm.

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
- `GET /api/recommendations/me`: verified customers receive `preference-profile` only when the default-off profile and preference flags are enabled and applicable signals exist; otherwise they receive the existing `cold-start`; requests without a valid customer session receive `anonymous-fallback`; administrators are rejected.

PERS-03 through PERS-05 add a server-internal profile, exact feedback suppression, and an optional knowledge-based preference branch. All new flags default off, so the disabled path still does not use saved preferences or feedback and makes no recommendation-quality claim.

## Algorithm Version

The default is `content-demo-v1`; `RECOMMENDER_ALGORITHM_VERSION` can override the label for controlled comparisons.

## Request Logging

Every recommendation response receives server-generated `requestId` and `listId`. MongoDB mode persists the exact ordered list, scores, ranks, reasons, exclusions, mode, algorithm version, surface, and safe subject before returning it. Seed mode and usage-data opt-out return attribution IDs without persistence. The logging service removes internal exclusions from the public envelope.

## Preference Profile (PERS-04, implemented default-off)

When `PERS_PROFILE_DOMAIN` and `PERS_PREFERENCE_RANKING` are both enabled for a verified customer, the service scores one active candidate set with `preference-profile-v1`. Six equal absolute group weights (favorite genre, disliked genre, favorite artist, format, budget, condition) are a fixed classroom v1 assumption, not learned or quality-validated weights. Favorite/disliked conflicts are removed from both groups; null research-only commerce fields are neutral; scores are bounded directly to `[0,1]`; and the two-result-per-artist cap is applied only after complete candidate scoring. The legacy and product-similarity modes remain unchanged.

## Exact Feedback (PERS-03/PERS-05, implemented default-off)

The recomputed profile reads preferences, ratings, wishlist, cart, exact feedback, and at most 500 recent interactions only when their effective gates allow it. `not-interested` and `already-own` are durable exact-item exclusions only; they never propagate to an artist or genre. `PUT` is idempotent and replaces the current kind; `DELETE` is an idempotent undo. Account deletion removes feedback in the same transaction. No `show-fewer-like-this` or public feedback-list route exists.

## Deferred Methods

Collaborative filtering, SVD/matrix factorization, learned ranking, and learned weights remain excluded from the planned project scope. The live app has only three showcase customers and the historical matrix is about 0.37% dense. User-user CF cannot treat historical subjects as app users; item-item CF is technically possible from historical co-ratings but is intentionally omitted because it would add a separate model/artifact/evaluation pipeline for limited project benefit. Interaction ingestion, request logging, frontend capture, and the evidence-gated offline evaluator remain active. No quality metric is authorized by this plan.

## Personalization Roadmap

PERS-00 through PERS-05 are complete behind default-off gates. PERS-06 through PERS-09 remain planning-only. The 2026-08-09/10 plan review selects the remaining approaches: live behavioral content-affinity (`behavior-profile-v1`), active-dataset historical rating-count popularity (`popularity-v1`), and `personalized-hybrid-v1`. Score blending happens only when preference and behavior are both available; popularity joins that hybrid when available. If either personalized component is missing, the response uses the pure lower component score/version rather than blending under that lower label. Exact negative feedback is an exclusion/signal rule, not a separate recommender. The existing public product-to-product content similarity remains separate and unchanged; it is not duplicated inside the user hybrid. `content-demo-v1` remains the regression behavior. No quality claim is made.
