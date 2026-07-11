# Backend Recommender System

This document specifies the current deterministic demo algorithm.

## Implemented Method

The current recommender is deterministic content-based ranking over the approved demo catalog.

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

`recommendForProduct` compares the repository's bounded candidate set (maximum 1,000) with one source record, sorts by score and title, applies the artist cap, and returns ranks, reasons, and the algorithm version.

## User Recommendations

- Restricted legacy `demo-user`: aggregate similarity to one synthetic purchase, three synthetic wishlist items, and documented favorite genres.
- Other legacy IDs: identical `cold-start` mode without any private profile read.
- `GET /api/recommendations/me`: verified customers receive the same `cold-start` ranking through a session-owned subject; requests without a valid customer session receive `anonymous-fallback`; administrators are rejected.

PERS-02 changes identity and mode labelling, not ranking. The system still does not use saved preferences or behavior and makes no recommendation-quality claim.

## Algorithm Version

The default is `content-demo-v1`; `RECOMMENDER_ALGORITHM_VERSION` can override the label for controlled comparisons.

## Request Logging

Every recommendation response receives server-generated `requestId` and `listId`. MongoDB mode persists the exact ordered list, scores, ranks, reasons, exclusions, mode, algorithm version, surface, and safe subject before returning it. Seed mode and usage-data opt-out return attribution IDs without persistence. The logging service removes internal exclusions from the public envelope.

## Deferred Methods

Collaborative filtering, matrix factorization, hybrid ranking, learned weights, and production popularity ranking remain deferred. Interaction ingestion, request logging, frontend capture, and BFP-02 Part B evaluation are active. Popularity exists only as a fair offline baseline; the current dataset is below the evidence threshold, so no quality metrics are reported.

## Personalization Roadmap

PERS-00 through PERS-02 are complete: architecture decisions are frozen, the legacy route is identity-safe, and the session-owned endpoint is live behind default-on rollback flags. PERS-03 onward remains planned: recomputed profiles, preference-aware ranking, explicit feedback, behavioral signals, popularity, and hybrid orchestration. `content-demo-v1` remains the regression behavior; collaborative filtering and matrix factorization are excluded. The evaluator remains `insufficient-evidence`, so no quality claim is made.
