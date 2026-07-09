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

- `demo-user`: aggregate similarity to one synthetic purchase, three synthetic wishlist items, and documented favorite genres.
- Other valid IDs: explicit `cold-start` mode using recent available demo catalog items with a generic reason.

The system does not read real user history or claim production personalization.

## Algorithm Version

The default is `content-demo-v1`; `RECOMMENDER_ALGORITHM_VERSION` can override the label for controlled comparisons.

## Request Logging

Every recommendation response receives server-generated `requestId` and `listId`. MongoDB mode persists the exact ordered list, scores, ranks, reasons, exclusions, mode, algorithm version, surface, and safe subject before returning it. Seed mode and usage-data opt-out return attribution IDs without persistence. The logging service removes internal exclusions from the public envelope.

## Deferred Methods

Collaborative filtering, matrix factorization, hybrid ranking, learned weights, and production popularity ranking remain deferred. Interaction ingestion, request logging, frontend capture, and BFP-02 Part B evaluation are active. Popularity exists only as a fair offline baseline; the current dataset is below the evidence threshold, so no quality metrics are reported.

## Personalization Roadmap (Planned)

`PERSONALIZATION_IMPLEMENTATION_PLAN.md` plans, without implementing, a genuine personalization system scheduled after BFP-07, FFP-07, and FFP-08. It introduces a session-owned endpoint, a recomputed recommendation profile, preference-aware ranking, first-class negative feedback, differentiated behavioral signals, an aggregate-evidence popularity baseline, and a hybrid orchestrator, all behind per-milestone flags with `content-demo-v1` preserved for regression. Collaborative filtering and matrix factorization are explicitly excluded. No quality claim is made; the `insufficient-evidence` evaluator status and its evidence threshold are unchanged.
