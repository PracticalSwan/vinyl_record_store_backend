# Backend Recommender System Plan

## Problem Definition

The backend recommender ranks vinyl records for the frontend and returns explanation reasons. The goal is to support user decisions, not only sort products.

## MVP Method

Start with content-based recommendation.

Inputs:

- Source product ID for product-based recommendations.
- User ID and interaction history for user-based recommendations.
- Vinyl record metadata.
- Stock status.

Outputs:

- Ranked records.
- Scores or ranks.
- Explanation reasons.
- Algorithm version.

## Planned Signals

- Views.
- Purchases.
- Wishlist additions.
- Cart additions.
- Ratings.
- Likes and dislikes.
- Searches.

## Planned Metadata

- Title.
- Artist.
- Album.
- Genre.
- Subgenre.
- Label.
- Release year.
- Release era.
- Country.
- Tags.
- Mood.
- Format.
- Condition.
- Price.
- Stock.

## Suggested Scoring

| Match | Suggested Effect |
| --- | --- |
| Same artist | High score |
| Related artist | Medium/high score if mapped later |
| Shared genre | High score |
| Shared subgenre | High score |
| Shared tags, mood, era, or label | Medium score |
| In stock | Required or strong boost |
| Already bought | Exclude by default |
| Popular or highly rated | Small boost |
| Diversity | Avoid one-artist or one-genre lists |

Scoring weights are not final. Document actual weights before implementation.

## Pseudocode Only

```text
Build a preference profile from a product or user history.
Find candidate records from MongoDB Atlas.
Remove records already purchased by the user.
Prefer in-stock records.
Score candidates by artist, genre, subgenre, tags, mood, era, label, rating, and stock.
Generate explanation reasons from the strongest matches.
Sort by score.
Apply diversity rules.
Log the recommendation output with algorithm version.
Return top records to the API layer.
```

## Explanation Strategy

The backend should return explanation reasons that the frontend can display:

- Same artist.
- Similar artist.
- Same genre or subgenre.
- Same release era.
- Same label.
- Shared mood or tags.
- Similar to wishlist, cart, rating history, or purchase history.
- In stock.

## Cold-Start Strategy

For a new user:

- Use popular in-stock records.
- Use onboarding preferences if added later.
- Use browsing behavior as soon as it exists.

For a new record:

- Use metadata similarity.
- Do not require interaction data before it can be recommended.

## Diversity Strategy

- Limit repeated artists in one recommendation list.
- Avoid only one genre unless the user requested that genre.
- Include close matches and related alternatives.
- Do not let popularity fully override relevance.

## Future Hybrid Method

Add collaborative or hybrid recommendation only when interaction data is large enough to support it. Record the evidence and decision in `docs/DECISION_LOG.md`.

## Documentation Update Rules

Update this file when backend recommendation signals, scoring, exclusions, candidate generation, explanation output, diversity rules, algorithm versioning, or evaluation methods change.

