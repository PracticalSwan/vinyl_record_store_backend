# Professor Recommender Compliance — 2026-09-12

## Selected course algorithms

The live Groovehaus recommendation path now satisfies the professor's two-batch requirement with the smallest architecture that fits the available data.

### Batch 1 — Item-Based Collaborative Filtering (Chapter 6)

Version: `item-cf-v1`

Evidence:
- the signed-in customer's positive durable signals: ratings >= 4, wishlist items, and positive cart items;
- historical Amazon v3 positive ratings from the `train` and `validation` splits only;
- no historical `test` row is read by the live collaborative repository;
- historical reviewer pseudonyms are used only inside the repository to count co-positive item relationships and never leave that boundary.

Mechanics:
1. For each account anchor item, count historical positive support for the anchor and candidate item.
2. Count users who positively rated both items.
3. Require at least 2 co-positive users.
4. Compute binary cosine similarity: `coPositive / sqrt(anchorSupport * candidateSupport)`.
5. Apply significance shrinkage: `coPositive / (coPositive + 5)`.
6. Aggregate supported item similarities over the customer's anchors and normalize the request-local candidate scores to `[0, 1]`.
7. Exclude products already known through the account profile before ranking and keep deterministic tie/artist-diversity behavior.

Sparse-data fallback: if no candidate has supported collaborative evidence, Item-CF reports unavailable. The orchestrator then falls back to the remaining preference/behavior/popularity path rather than inventing neighbors.

### Batch 2 — Weighted Hybrid (Chapter 10)

Version: `weighted-hybrid-v2`

Fixed component weights when all four signals are available:

| Component | Weight |
| --- | ---: |
| Saved preferences | 0.405 |
| Durable behavior | 0.315 |
| Item-Based CF | 0.100 |
| Aggregate popularity | 0.180 |

Only available components participate and their configured weights are renormalized to sum to 1. Therefore, when Item-CF is unavailable, the remaining `0.405 : 0.315 : 0.180` ratio renormalizes exactly to the previous `0.45 : 0.35 : 0.20` behavior.

The 10% collaborative cap is intentional. A live Atlas support audit found useful but sparse item-item overlap for the three protected showcase profiles. Higher CF weights visibly degraded the Soul profile, while 10% keeps collaborative evidence active without allowing sparse historical neighbors to overpower stronger account-owned intent.

## Evidence and evaluation boundaries

A development support audit used historical **training** positives only and found all 15 showcase anchor products present. With minimum co-positive overlap 2, candidate-neighbor counts were:

| Persona | Supported candidate neighbors |
| --- | ---: |
| Jazz | 5 |
| Rock | 72 |
| Soul | 12 |

This is feasibility evidence, not a new final quality metric. The permanently consumed historical final test remains untouched and must never be rerun. Existing historical random/popularity/content/MF results remain historical evidence only and do not validate the live account/hybrid path.

## Why the other professor-listed algorithms were not selected

- **User-Based CF:** live accounts are too sparse for stable user-neighbor sets; item relations are more reusable and easier to explain.
- **Constraint-Based / Case-Based knowledge recommendation:** feasible, but would duplicate existing explicit-preference and content rules while adding less course value than real collaborative evidence.
- **Time-Aware / Location-Aware:** no reliable location context is needed and collecting it solely for the assignment would be unjustified; time context is not strong enough to displace the simpler hybrid.
- **KNN:** would substantially overlap the existing content-similarity path and risk relabeling existing logic rather than adding a distinct ML stage.
- **Decision Tree / Random Forest:** available labeled interaction data is insufficient for a defensible live supervised target without added complexity.
- **Switching Hybrid:** the system still falls back by evidence availability, but the professor-compliant Batch-2 algorithm is explicitly the weighted blend because multiple normalized signals genuinely combine in the live score.
- **Matrix Factorization:** not one of the specifically listed Batch-1 options, and the previously evaluated biased-MF candidate was weak offline and remains disabled.

## Production feature flags

Source defaults remain fail-closed. The professor/demo production profile enables:

```text
PERS_PROFILE_DOMAIN=true
PERS_PREFERENCE_RANKING=true
PERS_NEGATIVE_FEEDBACK=true
PERS_BEHAVIORAL_RANKING=true
PERS_POPULARITY=true
PERS_ITEM_CF=true
PERS_HYBRID=true
```

The frontend does not recompute these scores. It renders the backend-selected mode/version and, for `weighted-hybrid-v2`, shows the course-facing label `Item-Based Collaborative Filtering + Weighted Hybrid` on the Recommendations page.

## Five-minute professor demo

1. Open the production storefront signed out. Show the general popularity/fallback path and explain that collaborative evidence requires an account anchor.
2. Sign in as one protected showcase customer and open **Recommendations**.
3. Point to **Course method: Item-Based Collaborative Filtering + Weighted Hybrid**. Explain that Item-CF uses positively rated/saved records as anchors, requires at least two historical co-likes, and contributes a bounded 10% to the weighted hybrid.
4. Point to the recommendation reasons and confirm rated/wishlisted known products are not repeated.
5. Sign out and repeat briefly with the Rock and Soul showcase accounts to show that the same algorithm changes output with different account evidence.
6. Explain fallback: when supported item neighbors do not exist, collaborative scoring becomes unavailable and the remaining preference/behavior/popularity weights renormalize safely.

Do not reveal credentials, historical pseudonyms, raw reviewer rows, or environment secrets during the demo.

## CodeGraph workflow

CodeGraph is initialized independently in both child Git repositories. Use it first for structural navigation of recommender/API/UI call flow and blast radius, then verify exact behavior with direct reads/tests/runtime evidence. `.codegraph/` is local cache state and is ignored by Git.
