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

`recommendForProduct` compares every available candidate with one source record, sorts by score and title, applies the artist cap, and returns ranks, reasons, and the algorithm version.

## User Recommendations

- `demo-user`: aggregate similarity to one synthetic purchase, three synthetic wishlist items, and documented favorite genres.
- Other valid IDs: explicit `cold-start` mode using recent available demo catalog items with a generic reason.

The system does not read real user history or claim production personalization.

## Algorithm Version

The default is `content-demo-v1`; `RECOMMENDER_ALGORITHM_VERSION` can override the label for controlled comparisons.

## Deferred Methods

Collaborative filtering, matrix factorization, hybrid ranking, learned weights, popularity signals, and recommendation logs require persistent interactions and a separate explicit task.
